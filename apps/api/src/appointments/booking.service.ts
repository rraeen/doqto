import {
  CreateAppointmentRequestSchema,
  HOLD_MINUTES,
  MyAppointmentsQuerySchema,
  type CreateAppointmentResponse,
  type MyAppointment,
  type Page,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Clinic } from '../clinics/clinic.schema';
import { AppException } from '../common/http/app-exception';
import { decodeOffset, encodeOffset } from '../common/http/offset-cursor';
import { zodCheck } from '../common/http/zod-check';
import { AppConfig } from '../config/app-config.service';
import { Doctor } from '../doctors/doctor.schema';
import { PaymentsService } from '../payments/payments.service';
import { Appointment, AppointmentDocument, STATUS_HISTORY_MAX } from './appointment.schema';
import { toAppointment, type AppointmentRow } from './appointment.mappers';
import { SlotsService } from './slots.service';
import { VisitCodeVault } from './visit-code-vault';

/** A patient can hold this many unpaid slots at once, so nobody can sweep a doctor's day. */
export const MAX_OPEN_HOLDS = 3;

/** What the patient sees as "upcoming": still to happen or in progress. */
const UPCOMING = [
  'pending_payment',
  'pending_confirmation',
  'confirmed',
  'checked_in',
  'in_consult',
];
const PAST = ['completed', 'no_show', 'cancelled_by_patient', 'cancelled_by_clinic', 'expired'];
/** The patient may read the visit code from the doctor's confirmation until the visit starts. */
const CODE_VISIBLE = ['confirmed', 'checked_in', 'in_consult'];

export const conflict = (message: string) =>
  new AppException(HttpStatus.CONFLICT, 'CONFLICT', message);
const slotTaken = () =>
  new AppException(HttpStatus.CONFLICT, 'SLOT_TAKEN', 'That slot was just booked. Pick another.');
const isDuplicateKey = (e: unknown) => (e as { code?: unknown } | null)?.code === 11000;

export const historyEntry = (status: string, at: Date, by?: string, note?: string) => ({
  $push: {
    statusHistory: {
      $each: [
        { status, at, ...(by ? { by: new Types.ObjectId(by) } : {}), ...(note ? { note } : {}) },
      ],
      $slice: -STATUS_HISTORY_MAX,
    },
  },
});

/** BE-24/25/26 booking: hold a slot, list the patient's own appointments, read one. */
@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @InjectModel(Clinic.name) private readonly clinics: Model<Clinic>,
    private readonly slots: SlotsService,
    private readonly payments: PaymentsService,
    private readonly vault: VisitCodeVault,
    private readonly config: AppConfig,
  ) {}

  /** An appointment the signed-in patient booked. Someone else's is a 404, never a 403. */
  async loadOwn(userId: string, id: string): Promise<AppointmentDocument> {
    const a = isValidObjectId(id) ? await this.appointments.findById(id).exec() : null;
    if (!a || a.patientUserId.toHexString() !== userId) {
      throw AppException.notFound('Appointment not found');
    }
    return a;
  }

  // ------------------------------------------------------------------ hold expiry

  /**
   * Releases unpaid holds that ran out (TDD 6.1 step 5). The unique slot index counts an expired
   * `pending_payment` as taken until its status changes, so this runs every minute and also just
   * before a booking asks for a slot, so a lapsed hold never blocks someone for a minute.
   */
  async expireHolds(now = new Date(), only?: { doctorId: Types.ObjectId; slotStart: Date }) {
    const r = await this.appointments
      .updateMany(
        {
          status: 'pending_payment',
          holdExpiresAt: { $lte: now },
          ...(only ? { doctorId: only.doctorId, slotStart: only.slotStart } : {}),
        },
        { $set: { status: 'expired' }, ...historyEntry('expired', now, undefined, 'hold ended') },
      )
      .exec();
    return r.modifiedCount;
  }

  // ------------------------------------------------------------------ book

  async create(userId: string, raw: unknown, now = new Date()): Promise<CreateAppointmentResponse> {
    const body = zodCheck(CreateAppointmentRequestSchema, raw);
    const clinicId = new Types.ObjectId(body.clinicId);
    const patientUserId = new Types.ObjectId(userId);

    // Each lookup is a round trip to the database, so the ones that do not depend on each other
    // run together: the doctor, how many unpaid holds the patient has, and the schedule check.
    const [doctor, open] = await Promise.all([
      this.slots.bookableDoctor(body.doctorId, body.clinicId),
      this.appointments
        .countDocuments({ patientUserId, status: 'pending_payment', holdExpiresAt: { $gt: now } })
        .exec(),
    ]);
    if (open >= MAX_OPEN_HOLDS) {
      throw conflict('You have unpaid bookings waiting. Pay or let them expire first.');
    }
    const [slot] = await Promise.all([
      this.slots.resolveOnlineSlot(doctor._id, clinicId, body.slotStart, now),
      // A lapsed hold on this very slot must not block the new booking.
      this.expireHolds(now, { doctorId: doctor._id, slotStart: new Date(body.slotStart) }),
    ]);
    let created: AppointmentDocument;
    try {
      created = await this.appointments.create({
        doctorId: doctor._id,
        clinicId,
        patientUserId,
        patientName: body.patientName,
        patientPhone: body.patientPhone,
        date: slot.date,
        slotStart: slot.start,
        slotEnd: slot.end,
        source: 'online',
        status: 'pending_payment',
        holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
        bookingFee: doctor.bookingFee,
        ...(body.reason ? { visitReason: body.reason } : {}),
        statusHistory: [{ status: 'pending_payment', at: now, by: patientUserId }],
        isDemo: this.config.isDemo,
      });
    } catch (e) {
      // The unique partial index on { doctorId, slotStart } (DB doc 5).
      if (isDuplicateKey(e)) throw slotTaken();
      throw e;
    }

    try {
      const order = await this.payments.createOrder({
        id: created.id,
        patientUserId,
        amount: doctor.bookingFee,
        isDemo: this.config.isDemo,
      });
      return { appointment: toAppointment(created), order };
    } catch (e) {
      // No order means nothing to pay: free the slot straight away.
      await this.appointments.deleteOne({ _id: created._id }).exec();
      throw e;
    }
  }

  // ------------------------------------------------------------------ read

  async mine(userId: string, raw: unknown, now = new Date()): Promise<Page<MyAppointment>> {
    const q = zodCheck(MyAppointmentsQuerySchema, raw);
    const offset = decodeOffset(q.cursor);
    const filter: Record<string, unknown> = { patientUserId: new Types.ObjectId(userId) };
    // An unpaid hold that ran out is "past" the moment it lapses, even before the minute job.
    const lapsed = { status: 'pending_payment', holdExpiresAt: { $lte: now } };
    if (q.tab === 'upcoming') {
      filter.status = { $in: UPCOMING };
      filter.$nor = [lapsed];
    } else if (q.tab === 'past') {
      filter.$or = [{ status: { $in: PAST } }, lapsed];
    }
    const rows = await this.appointments
      .find(filter)
      .sort(q.tab === 'upcoming' ? { slotStart: 1, _id: 1 } : { slotStart: -1, _id: -1 })
      .skip(offset)
      .limit(q.limit + 1)
      .lean()
      .exec();
    const page = rows.slice(0, q.limit);
    return {
      items: await this.present(page, now),
      nextCursor: rows.length > q.limit ? encodeOffset(offset + q.limit) : null,
    };
  }

  async byId(userId: string, id: string, now = new Date()): Promise<MyAppointment> {
    const a = await this.loadOwn(userId, id);
    return (await this.present([a.toObject()], now))[0] as MyAppointment;
  }

  /** The patient's list shape: doctor, clinic, fee, the visit code when allowed, the open order. */
  async present(
    rows: (AppointmentRow & Partial<Appointment>)[],
    now = new Date(),
  ): Promise<MyAppointment[]> {
    if (rows.length === 0) return [];
    const doctorIds = [...new Set(rows.map((r) => r.doctorId.toHexString()))];
    const clinicIds = [...new Set(rows.map((r) => r.clinicId.toHexString()))];
    const unpaid = rows.filter((r) => r.status === 'pending_payment').map((r) => r._id);
    const [doctors, clinics, orders] = await Promise.all([
      this.doctors
        .find({ _id: { $in: doctorIds } }, { name: 1, slug: 1, specialties: 1, photoUrl: 1 })
        .lean()
        .exec(),
      this.clinics
        .find({ _id: { $in: clinicIds } }, { name: 1, 'address.area': 1 })
        .lean()
        .exec(),
      this.payments.openOrders(unpaid),
    ]);
    const doctorById = new Map(doctors.map((d) => [d._id.toHexString(), d]));
    const clinicById = new Map(clinics.map((c) => [c._id.toHexString(), c]));
    return rows.map((r) => {
      const d = doctorById.get(r.doctorId.toHexString());
      const c = clinicById.get(r.clinicId.toHexString());
      const code = CODE_VISIBLE.includes(r.status) ? this.vault.open(r.visitCodeSealed) : null;
      const base = toAppointment(r);
      // A hold that ran out but is not yet swept reads as expired, so the app stops offering to pay.
      const lapsed =
        r.status === 'pending_payment' &&
        r.holdExpiresAt &&
        r.holdExpiresAt.getTime() <= now.getTime();
      return {
        ...base,
        status: lapsed ? 'expired' : base.status,
        holdExpiresAt: lapsed ? null : base.holdExpiresAt,
        doctor: {
          id: r.doctorId.toHexString(),
          name: d?.name ?? '',
          slug: d?.slug ?? '',
          specialties: d?.specialties ?? [],
          photoUrl: d?.photoUrl ?? null,
        },
        clinic: {
          id: r.clinicId.toHexString(),
          name: c?.name ?? '',
          area: c?.address?.area ?? null,
        },
        bookingFee: r.bookingFee ?? 0,
        visitCode: code,
        order:
          !lapsed && r.status === 'pending_payment'
            ? (orders.get(r._id.toHexString()) ?? null)
            : null,
      };
    });
  }
}
