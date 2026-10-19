import {
  CheckInRequestSchema,
  CreateClinicAppointmentRequestSchema,
  DaySheetQuerySchema,
  QueueMoveRequestSchema,
  QueueNextRequestSchema,
  UpdateStatusRequestSchema,
} from '@doqto/shared';
import { expectParity } from '../../common/testing/dto-parity';
import {
  CheckInDto,
  CreateClinicAppointmentDto,
  DaySheetQueryDto,
  QueueMoveDto,
  QueueNextDto,
  UpdateStatusDto,
} from './clinic-console.dto';

const id = 'a'.repeat(24);
const entry = {
  clinicId: id,
  doctorId: id,
  source: 'phone_manual',
  patientName: 'Ram',
  patientPhone: '+919876543210',
};

// Field rules only; the Zod refinements (walk-in slot, running-late delay) run in the services.
describe('clinic console DTOs match the shared contract', () => {
  expectParity([
    [
      'day sheet query',
      DaySheetQueryDto,
      DaySheetQuerySchema,
      [
        { clinicId: id },
        { clinicId: id, date: '2026-10-12' },
        { clinicId: id, date: '12-10-2026' },
        {},
      ],
    ],
    [
      'POST /clinic/appointments',
      CreateClinicAppointmentDto,
      CreateClinicAppointmentRequestSchema,
      [
        entry,
        { ...entry, date: '2026-10-12', slotStart: '2026-10-12T04:30:00.000Z' },
        { ...entry, source: 'online' },
        { ...entry, patientPhone: '9876543210' },
        { ...entry, patientName: '' },
        { ...entry, date: null },
        { ...entry, status: 'completed' },
      ],
    ],
    [
      'check-in',
      CheckInDto,
      CheckInRequestSchema,
      [
        { appointmentId: id, method: 'visit_code', code: '1234' },
        { appointmentId: id, method: 'otp', code: '123456' },
        { appointmentId: id, method: 'otp', code: '12' },
        { appointmentId: id, method: 'magic', code: '1234' },
        { appointmentId: id, method: 'otp', code: '123456', force: true },
      ],
    ],
    [
      'queue next',
      QueueNextDto,
      QueueNextRequestSchema,
      [
        { clinicId: id, doctorId: id },
        { clinicId: id, doctorId: id, currentAppointmentId: null },
        { clinicId: id, doctorId: id, currentAppointmentId: 'x' },
      ],
    ],
    [
      'queue move',
      QueueMoveDto,
      QueueMoveRequestSchema,
      [
        { beforeAppointmentId: id },
        { beforeAppointmentId: id, reason: 'Elderly' },
        { beforeAppointmentId: id, reason: 'x'.repeat(81) },
        {},
      ],
    ],
    [
      'PUT /clinic/status',
      UpdateStatusDto,
      UpdateStatusRequestSchema,
      [
        { clinicId: id, doctorId: id, state: 'in_clinic' },
        { clinicId: id, doctorId: id, state: 'running_late', delayMinutes: 30 },
        { clinicId: id, doctorId: id, state: 'in_clinic', message: null },
        { clinicId: id, doctorId: id, state: 'in_clinic', message: 'x'.repeat(81) },
        { clinicId: id, doctorId: id, state: 'asleep' },
        { clinicId: id, doctorId: id, state: 'in_clinic', delayMinutes: 301 },
        { clinicId: id, doctorId: id, state: 'in_clinic', etaAt: 'soon' },
      ],
    ],
  ]);
});
