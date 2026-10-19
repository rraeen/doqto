import { type AppointmentPosition, type WaitRange } from '@doqto/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ClinicAccessService } from '../clinics/clinic-access.service';
import { AppException } from '../common/http/app-exception';
import { istDate } from '../common/time/ist';
import { DoctorStatusService } from '../status/doctor-status.service';
import { DEFAULT_CONSULT_MINUTES } from '@doqto/shared';
import { Appointment, AppointmentDocument } from './appointment.schema';

/** TDD 6.3: shown as a range, about 20% either side. */
export function waitRange(minutes: number): WaitRange {
  return { min: Math.max(0, Math.floor(minutes * 0.8)), max: Math.ceil(minutes * 1.2) };
}

/**
 * Estimated wait in minutes: tokens ahead times the average consult, plus the time until the
 * doctor's ETA while they have not started or are running late (TDD 6.3).
 */
export function estimateWaitMinutes(input: {
  tokensAhead: number;
  avgConsultMinutes: number;
  state: string;
  etaAt: Date | null;
  now: Date;
}): number {
  const arrival =
    (input.state === 'not_started' || input.state === 'running_late') && input.etaAt
      ? Math.max(0, (input.etaAt.getTime() - input.now.getTime()) / 60_000)
      : 0;
  return input.tokensAhead * input.avgConsultMinutes + arrival;
}

/** BE-18 `GET /appointments/:id/position`: the patient's place in today's queue. */
@Injectable()
export class PositionService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    private readonly access: ClinicAccessService,
    private readonly status: DoctorStatusService,
  ) {}

  /** The patient themselves, or the clinic team. Anyone else gets 404. */
  private async load(userId: string, id: string): Promise<AppointmentDocument> {
    const a = isValidObjectId(id) ? await this.appointments.findById(id).exec() : null;
    if (!a) throw AppException.notFound('Appointment not found');
    if (a.patientUserId.equals(new Types.ObjectId(userId))) return a;
    try {
      await this.access.requireClinic(userId, a.clinicId);
    } catch {
      throw AppException.notFound('Appointment not found');
    }
    return a;
  }

  async position(userId: string, id: string, now = new Date()): Promise<AppointmentPosition> {
    const a = await this.load(userId, id);
    const st = await this.status.find(a.doctorId, a.date);
    const state = st?.state ?? 'not_started';
    const scope = { doctorId: a.doctorId, clinicId: a.clinicId, date: a.date };
    let tokensAhead: number | null = null;
    if (a.date === istDate(now)) {
      if (a.status === 'in_consult') tokensAhead = 0;
      else if (a.status === 'checked_in' || a.status === 'confirmed') {
        // Not arrived yet: placed at the slot (or now, for an unslotted entry).
        const mine = a.status === 'checked_in' ? a.effectiveTime! : (a.slotStart ?? now);
        const ahead: Record<string, unknown>[] = [{ effectiveTime: { $lt: mine } }];
        if (a.status === 'checked_in' && a.queueToken) {
          ahead.push({ effectiveTime: mine, queueToken: { $lt: a.queueToken } });
        }
        const [inConsult, waiting] = await Promise.all([
          this.appointments.countDocuments({ ...scope, status: 'in_consult' }).exec(),
          this.appointments
            .countDocuments({ ...scope, status: 'checked_in', _id: { $ne: a._id }, $or: ahead })
            .exec(),
        ]);
        tokensAhead = inConsult + waiting;
      }
    }
    let estimatedWaitMinutes: WaitRange | null = null;
    if (tokensAhead !== null && state !== 'on_leave' && state !== 'done_for_day') {
      estimatedWaitMinutes =
        a.status === 'in_consult'
          ? { min: 0, max: 0 }
          : waitRange(
              estimateWaitMinutes({
                tokensAhead,
                avgConsultMinutes: st?.avgConsultMinutes ?? DEFAULT_CONSULT_MINUTES,
                state,
                etaAt: st?.etaAt ?? null,
                now,
              }),
            );
    }
    return {
      appointmentId: a._id.toHexString(),
      status: a.status,
      queueToken: a.queueToken ?? null,
      currentToken: st?.currentToken ?? null,
      tokensAhead,
      estimatedWaitMinutes,
      doctorState: state,
      delayMinutes: st?.delayMinutes ?? 0,
      updatedAt: now.toISOString(),
    };
  }
}
