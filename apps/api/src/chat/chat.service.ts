import {
  CHAT_OPEN_DAYS_AFTER_VISIT,
  SendChatMessageRequestSchema,
  type ChatMessage,
  type ChatMessagesResponse,
  type ChatSender,
  type ChatThread,
  type ChatThreadsResponse,
} from '@doqto/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Appointment } from '../appointments/appointment.schema';
import { conflict } from '../appointments/booking.service';
import { AppException } from '../common/http/app-exception';
import { zodCheck } from '../common/http/zod-check';
import { addDays, istDate } from '../common/time/ist';
import { Doctor } from '../doctors/doctor.schema';
import { ChatMessageDoc } from './chat-message.schema';

/** A thread exists once the doctor has accepted the booking. */
const LIVE = ['confirmed', 'checked_in', 'in_consult'];
const THREAD_STATUSES = [...LIVE, 'completed'];
/** Threads of visits older than this are not listed (they can still be opened by link). */
const LIST_DAYS = 30;
const PAGE = 200;

/** Who is looking: the patient who booked, or the doctor the booking is with. */
export type ChatViewer =
  { side: 'patient'; userId: string } | { side: 'doctor'; doctorId: Types.ObjectId };

const other = (side: ChatSender): ChatSender => (side === 'patient' ? 'doctor' : 'patient');

/**
 * Messages between a patient and the doctor of one booking. Whoever is not a party to the booking
 * gets "not found", so a booking id never confirms that someone else's chat exists.
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessageDoc.name) private readonly messages: Model<ChatMessageDoc>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
  ) {}

  /** The doctor can write while the visit is ahead or under way, and for a week after it. */
  private isOpen(a: Pick<Appointment, 'status' | 'date'>, now: Date): boolean {
    if (LIVE.includes(a.status)) return true;
    return a.status === 'completed' && istDate(now) <= addDays(a.date, CHAT_OPEN_DAYS_AFTER_VISIT);
  }

  private async party(viewer: ChatViewer, appointmentId: string) {
    const mine = isValidObjectId(appointmentId)
      ? await this.appointments
          .findOne({
            _id: appointmentId,
            status: { $in: THREAD_STATUSES },
            ...(viewer.side === 'patient'
              ? { patientUserId: new Types.ObjectId(viewer.userId) }
              : { doctorId: viewer.doctorId }),
          })
          .lean()
          .exec()
      : null;
    if (!mine) throw AppException.notFound('Conversation not found');
    return mine;
  }

  private toMessage(m: ChatMessageDoc & { _id: Types.ObjectId }): ChatMessage {
    return {
      id: m._id.toHexString(),
      appointmentId: m.appointmentId.toHexString(),
      from: m.from,
      text: m.text,
      at: m.createdAt.toISOString(),
    };
  }

  private thread(
    a: Appointment & { _id: Types.ObjectId },
    viewer: ChatViewer,
    extra: {
      doctor?: Pick<Doctor, 'name' | 'slug' | 'specialties' | 'photoUrl'>;
      last: ChatMessage | null;
      unread: number;
    },
    now: Date,
  ): ChatThread {
    const patient = viewer.side === 'patient';
    return {
      appointmentId: a._id.toHexString(),
      withName: patient ? (extra.doctor?.name ?? 'Doctor') : a.patientName,
      specialty: patient ? (extra.doctor?.specialties?.[0] ?? null) : null,
      doctorSlug: patient ? (extra.doctor?.slug ?? null) : null,
      photoUrl: patient ? (extra.doctor?.photoUrl ?? null) : null,
      appointmentDate: a.date,
      appointmentStatus: a.status,
      open: this.isOpen(a, now),
      unread: extra.unread,
      lastMessage: extra.last,
    };
  }

  /** Conversations of the viewer: recent visits first by the latest message, then by date. */
  async list(viewer: ChatViewer, now = new Date()): Promise<ChatThreadsResponse> {
    const since = addDays(istDate(now), -LIST_DAYS);
    const rows = await this.appointments
      .find({
        status: { $in: THREAD_STATUSES },
        date: { $gte: since },
        ...(viewer.side === 'patient'
          ? { patientUserId: new Types.ObjectId(viewer.userId) }
          : { doctorId: viewer.doctorId }),
      })
      .sort({ date: -1, slotStart: -1 })
      .limit(PAGE)
      .lean()
      .exec();
    if (rows.length === 0) return { items: [] };

    const ids = rows.map((r) => r._id);
    const from = other(viewer.side);
    const stats = await this.messages
      .aggregate<{
        _id: Types.ObjectId;
        last: ChatMessageDoc & { _id: Types.ObjectId };
        unread: number;
      }>([
        { $match: { appointmentId: { $in: ids } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: '$appointmentId',
            last: { $last: '$$ROOT' },
            unread: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$from', from] },
                      { $eq: [{ $ifNull: ['$readAt', null] }, null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .exec();
    const byId = new Map(stats.map((s) => [s._id.toHexString(), s]));

    const doctors =
      viewer.side === 'patient'
        ? new Map(
            (
              await this.doctors
                .find(
                  { _id: { $in: rows.map((r) => r.doctorId) } },
                  { name: 1, slug: 1, specialties: 1, photoUrl: 1 },
                )
                .lean()
                .exec()
            ).map((d) => [d._id.toHexString(), d]),
          )
        : new Map<string, Pick<Doctor, 'name' | 'slug' | 'specialties' | 'photoUrl'>>();

    const items = rows.map((a) => {
      const s = byId.get(a._id.toHexString());
      return this.thread(
        a,
        viewer,
        {
          doctor: doctors.get(a.doctorId.toHexString()),
          last: s ? this.toMessage(s.last) : null,
          unread: s?.unread ?? 0,
        },
        now,
      );
    });
    // Conversations with messages first (newest message on top), the rest by visit date.
    items.sort((x, y) => {
      const a = x.lastMessage?.at ?? '';
      const b = y.lastMessage?.at ?? '';
      if (a !== b) return a < b ? 1 : -1;
      return x.appointmentDate < y.appointmentDate
        ? 1
        : x.appointmentDate > y.appointmentDate
          ? -1
          : 0;
    });
    return { items };
  }

  /**
   * The thread with its messages. With `after` only the newer ones come back (the screen polls with
   * this). Reading marks the other side's messages as read.
   */
  async open(
    viewer: ChatViewer,
    appointmentId: string,
    after?: string,
    now = new Date(),
  ): Promise<ChatMessagesResponse> {
    const a = await this.party(viewer, appointmentId);
    await this.messages
      .updateMany(
        { appointmentId: a._id, from: other(viewer.side), readAt: { $exists: false } },
        { $set: { readAt: now } },
      )
      .exec();
    const since = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : undefined;
    const rows = since
      ? await this.messages
          .find({ appointmentId: a._id, createdAt: { $gt: since } })
          .sort({ createdAt: 1 })
          .limit(PAGE)
          .lean()
          .exec()
      : (
          await this.messages
            .find({ appointmentId: a._id })
            .sort({ createdAt: -1 })
            .limit(PAGE)
            .lean()
            .exec()
        ).reverse();
    const last = await this.messages
      .findOne({ appointmentId: a._id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const doctor =
      viewer.side === 'patient'
        ? ((await this.doctors
            .findById(a.doctorId, { name: 1, slug: 1, specialties: 1, photoUrl: 1 })
            .lean()
            .exec()) ?? undefined)
        : undefined;
    return {
      thread: this.thread(
        a,
        viewer,
        { doctor, last: last ? this.toMessage(last) : null, unread: 0 },
        now,
      ),
      messages: rows.map((m) => this.toMessage(m)),
    };
  }

  async send(
    viewer: ChatViewer,
    appointmentId: string,
    raw: unknown,
    now = new Date(),
  ): Promise<ChatMessage> {
    const { text } = zodCheck(SendChatMessageRequestSchema, raw);
    const a = await this.party(viewer, appointmentId);
    if (!this.isOpen(a, now)) {
      throw conflict('This conversation is closed. Book a new visit to message the doctor again.');
    }
    const doc = await this.messages.create({
      appointmentId: a._id,
      patientUserId: a.patientUserId,
      doctorId: a.doctorId,
      from: viewer.side,
      text,
    });
    return this.toMessage(doc.toObject() as ChatMessageDoc & { _id: Types.ObjectId });
  }

  /** Account deletion: every message of this patient goes. */
  async deleteAllOfPatient(userId: Types.ObjectId): Promise<void> {
    await this.messages.deleteMany({ patientUserId: userId }).exec();
  }
}
