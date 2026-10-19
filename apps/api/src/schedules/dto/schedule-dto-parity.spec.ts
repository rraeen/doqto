import { PutScheduleRequestSchema, ScheduleQuerySchema } from '@doqto/shared';
import { expectParity } from '../../common/testing/dto-parity';
import { PutScheduleDto, ScheduleQueryDto } from './schedule.dto';

const block = { day: 1, start: '10:00', end: '13:00', slotMinutes: 10 };

// Field rules only. Cross-field rules (end after start, overlaps, one exception per date) are the
// Zod refinements the service applies after the DTO, so they are not parity cases.
describe('schedule DTOs match the shared contract', () => {
  expectParity([
    [
      'PUT /doctor/schedules/:clinicId',
      PutScheduleDto,
      PutScheduleRequestSchema,
      [
        { weekly: [block] },
        { weekly: [], exceptions: [{ date: '2026-10-19', type: 'leave' }] },
        {
          weekly: [],
          exceptions: [
            {
              date: '2026-10-19',
              type: 'custom',
              blocks: [{ start: '09:00', end: '10:00', slotMinutes: 15 }],
            },
          ],
        },
        { weekly: [], exceptions: [{ date: '2026-10-19', type: 'custom' }] },
        { weekly: [{ ...block, capacityPerSlot: 1 }] },
        { weekly: [{ ...block, capacityPerSlot: 2 }] },
        { weekly: [{ ...block, day: 7 }] },
        { weekly: [{ ...block, slotMinutes: 3 }] },
        { weekly: [{ ...block, start: '25:00' }] },
        { weekly: [], walkInShare: 1.5 },
        { weekly: [], bookingWindowDays: 31 },
        { weekly: [], isActive: null },
        { weekly: null },
        { weekly: [], doctorId: 'x' },
      ],
    ],
    [
      '?doctorId=',
      ScheduleQueryDto,
      ScheduleQuerySchema,
      [{}, { doctorId: 'a'.repeat(24) }, { doctorId: 'nope' }],
    ],
  ]);
});
