import {
  CancelAppointmentRequestSchema,
  CreateAppointmentRequestSchema,
  MyAppointmentsQuerySchema,
  RescheduleAppointmentRequestSchema,
  SlotsQuerySchema,
} from '@doqto/shared';
import { expectParity } from '../../common/testing/dto-parity';
import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  MyAppointmentsQueryDto,
  RescheduleAppointmentDto,
  SlotsQueryDto,
} from './appointments.dto';

const id = 'a'.repeat(24);
const create = {
  doctorId: id,
  clinicId: id,
  slotStart: '2026-10-21T04:30:00.000Z',
  patientName: 'Asha Devi',
  patientPhone: '+919876543210',
};

describe('appointment DTOs match the shared contract', () => {
  expectParity([
    [
      'SlotsQuery',
      SlotsQueryDto,
      SlotsQuerySchema,
      [
        { clinicId: id, date: '2026-10-21' },
        { clinicId: id },
        { clinicId: id, date: '21-10-2026' },
        { clinicId: 'x', date: '2026-10-21' },
        { clinicId: id, date: '2026-10-21', x: 1 },
      ],
    ],
    [
      'CreateAppointment',
      CreateAppointmentDto,
      CreateAppointmentRequestSchema,
      [
        create,
        { ...create, reason: 'checkup' },
        { ...create, reason: 'astrology' },
        { ...create, patientName: 'A' },
        { ...create, patientName: '  Asha  ' },
        { ...create, patientPhone: '9876543210' },
        { ...create, slotStart: 'tomorrow' },
        { ...create, extra: 1 },
        { doctorId: id },
      ],
    ],
    [
      'MyAppointmentsQuery',
      MyAppointmentsQueryDto,
      MyAppointmentsQuerySchema,
      [{}, { tab: 'upcoming' }, { tab: 'past', limit: 5 }, { tab: 'all' }, { limit: 0 }, { x: 1 }],
    ],
    [
      'CancelAppointment',
      CancelAppointmentDto,
      CancelAppointmentRequestSchema,
      [{}, { reason: 'change_of_plan' }, { reason: 'bored' }, { x: 1 }],
    ],
    [
      'RescheduleAppointment',
      RescheduleAppointmentDto,
      RescheduleAppointmentRequestSchema,
      [
        { slotStart: '2026-10-21T04:30:00.000Z' },
        {},
        { slotStart: 'x' },
        { slotStart: '2026-10-21T04:30:00.000Z', x: 1 },
      ],
    ],
  ]);
});
