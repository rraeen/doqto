import type { Appointment, DaySheetItem } from '@doqto/shared';
import type { AppointmentDocument } from './appointment.schema';

const iso = (d?: Date | null) => (d ? d.toISOString() : null);

/** Front-desk view of one appointment (clinic team only: carries the patient phone). */
export function toDaySheetItem(a: AppointmentDocument): DaySheetItem {
  return {
    id: a._id.toHexString(),
    doctorId: a.doctorId.toHexString(),
    clinicId: a.clinicId.toHexString(),
    patientName: a.patientName,
    patientPhone: a.patientPhone,
    date: a.date,
    slotStart: iso(a.slotStart),
    slotEnd: iso(a.slotEnd),
    source: a.source,
    status: a.status,
    queueToken: a.queueToken ?? null,
    effectiveTime: iso(a.effectiveTime),
    checkInAt: iso(a.checkInAt),
    consultStartAt: iso(a.consultStartAt),
    consultEndAt: iso(a.consultEndAt),
    visitVerified: Boolean(a.visitVerifiedAt),
    hasVisitCode: Boolean(a.visitCode?.hash),
    rescheduled: (a.rescheduleCount ?? 0) > 0,
    createdAt: a.createdAt.toISOString(),
  };
}

const ORDER: Record<string, number> = {
  in_consult: 0,
  checked_in: 1,
  confirmed: 2,
  pending_payment: 3,
  completed: 4,
  no_show: 5,
  cancelled_by_patient: 6,
  cancelled_by_clinic: 6,
  expired: 7,
};

const time = (d?: Date) => d?.getTime() ?? Number.MAX_SAFE_INTEGER;

/**
 * Front-desk order: in consult, the waiting queue by effective time then token, booked but not
 * arrived by slot (walk-ins without a slot after them, by creation), then the closed ones.
 */
export function compareForDaySheet(a: AppointmentDocument, b: AppointmentDocument): number {
  const group = (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9);
  if (group !== 0) return group;
  if (a.status === 'checked_in') {
    return (
      time(a.effectiveTime) - time(b.effectiveTime) || (a.queueToken ?? 0) - (b.queueToken ?? 0)
    );
  }
  if (a.status === 'completed') return time(a.consultEndAt) - time(b.consultEndAt);
  return time(a.slotStart) - time(b.slotStart) || a.createdAt.getTime() - b.createdAt.getTime();
}

// ---------------------------------------------------------------- patient view (contract v3)

/** A stored appointment as read by `.lean()` or as a document: only the fields the mappers use. */
export type AppointmentRow = Pick<
  AppointmentDocument,
  | '_id'
  | 'doctorId'
  | 'clinicId'
  | 'patientName'
  | 'date'
  | 'slotStart'
  | 'slotEnd'
  | 'source'
  | 'status'
  | 'holdExpiresAt'
  | 'queueToken'
  | 'checkInAt'
  | 'visitVerifiedAt'
  | 'reviewUnlockAt'
  | 'createdAt'
>;

/** The patient's view of one appointment (`Appointment` in the contract). */
export function toAppointment(a: AppointmentRow): Appointment {
  return {
    id: a._id.toHexString(),
    doctorId: a.doctorId.toHexString(),
    clinicId: a.clinicId.toHexString(),
    patientName: a.patientName,
    date: a.date,
    slotStart: iso(a.slotStart),
    slotEnd: iso(a.slotEnd),
    source: a.source,
    status: a.status,
    holdExpiresAt: a.status === 'pending_payment' ? iso(a.holdExpiresAt) : null,
    queueToken: a.queueToken ?? null,
    checkInAt: iso(a.checkInAt),
    visitVerified: Boolean(a.visitVerifiedAt),
    reviewUnlockAt: iso(a.reviewUnlockAt),
    createdAt: a.createdAt.toISOString(),
  };
}
