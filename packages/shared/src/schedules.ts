/**
 * Weekly schedules and exceptions (DB doc 3.4). Contract v2 (BE-12). Slots are computed from
 * these on read and never stored. Times are IST wall-clock `HH:mm`.
 */
import { z } from 'zod';
import { IsoDateTimeSchema, IstDateSchema, ObjectIdSchema, TimeOfDaySchema } from './common';

export const SLOT_MINUTES_MIN = 5;
export const SLOT_MINUTES_MAX = 60;
export const BOOKING_WINDOW_DAYS_MAX = 30;
export const BOOKING_WINDOW_DAYS_DEFAULT = 7;
/** Share of each block's slots kept for walk-ins when patients book online (TDD 6.1). */
export const WALK_IN_SHARE_DEFAULT = 0.3;
export const SCHEDULE_BLOCKS_MAX = 21;
export const SCHEDULE_EXCEPTIONS_MAX = 60;

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** One consulting session, e.g. 10:00 to 13:00 in 10-minute slots. Phase 1 keeps capacity 1. */
export const TimeBlockSchema = z
  .object({
    start: TimeOfDaySchema,
    end: TimeOfDaySchema,
    slotMinutes: z.number().int().min(SLOT_MINUTES_MIN).max(SLOT_MINUTES_MAX),
  })
  .refine((b) => minutes(b.end) - minutes(b.start) >= b.slotMinutes, {
    message: 'end must be at least one slot after start',
    path: ['end'],
  });
export type TimeBlock = z.infer<typeof TimeBlockSchema>;

/** `day`: 0 is Sunday, as in JavaScript `getDay()`. */
export const WeeklyBlockSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start: TimeOfDaySchema,
    end: TimeOfDaySchema,
    slotMinutes: z.number().int().min(SLOT_MINUTES_MIN).max(SLOT_MINUTES_MAX),
    capacityPerSlot: z.literal(1).default(1),
  })
  .refine((b) => minutes(b.end) - minutes(b.start) >= b.slotMinutes, {
    message: 'end must be at least one slot after start',
    path: ['end'],
  });
export type WeeklyBlock = z.infer<typeof WeeklyBlockSchema>;

/** `leave`: no slots that day. `custom`: these blocks replace the weekly ones for that day. */
export const ScheduleExceptionSchema = z.discriminatedUnion('type', [
  z.object({ date: IstDateSchema, type: z.literal('leave') }),
  z.object({
    date: IstDateSchema,
    type: z.literal('custom'),
    blocks: z.array(TimeBlockSchema).min(1).max(6),
  }),
]);
export type ScheduleException = z.infer<typeof ScheduleExceptionSchema>;

type BlockLike = { start: string; end: string };
const overlaps = (blocks: BlockLike[]) => {
  const sorted = [...blocks].sort((a, b) => minutes(a.start) - minutes(b.start));
  return sorted.some((b, i) => i > 0 && minutes(b.start) < minutes(sorted[i - 1]!.end));
};

/**
 * `PUT /doctor/schedules/:clinicId` replaces the whole schedule for one doctor at one clinic.
 * Blocks on the same day must not overlap; one exception per date.
 */
export const PutScheduleRequestSchema = z
  .object({
    weekly: z.array(WeeklyBlockSchema).max(SCHEDULE_BLOCKS_MAX),
    exceptions: z.array(ScheduleExceptionSchema).max(SCHEDULE_EXCEPTIONS_MAX).default([]),
    bookingWindowDays: z
      .number()
      .int()
      .min(1)
      .max(BOOKING_WINDOW_DAYS_MAX)
      .default(BOOKING_WINDOW_DAYS_DEFAULT),
    walkInShare: z.number().min(0).max(1).default(WALK_IN_SHARE_DEFAULT),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((s, ctx) => {
    for (let day = 0; day <= 6; day++) {
      if (overlaps(s.weekly.filter((b) => b.day === day))) {
        ctx.addIssue({ code: 'custom', path: ['weekly'], message: `Blocks overlap on day ${day}` });
      }
    }
    const dates = s.exceptions.map((e) => e.date);
    if (new Set(dates).size !== dates.length) {
      ctx.addIssue({ code: 'custom', path: ['exceptions'], message: 'One exception per date' });
    }
    s.exceptions.forEach((e, i) => {
      if (e.type === 'custom' && overlaps(e.blocks)) {
        ctx.addIssue({
          code: 'custom',
          path: ['exceptions', i, 'blocks'],
          message: 'Blocks overlap',
        });
      }
    });
  });
export type PutScheduleRequest = z.input<typeof PutScheduleRequestSchema>;

/** `?doctorId=` on the schedule routes: required when clinic staff edit a doctor's schedule. */
export const ScheduleQuerySchema = z.object({ doctorId: ObjectIdSchema.optional() });
export type ScheduleQuery = z.infer<typeof ScheduleQuerySchema>;

export const ScheduleSchema = z.object({
  doctorId: ObjectIdSchema,
  clinicId: ObjectIdSchema,
  weekly: z.array(WeeklyBlockSchema),
  exceptions: z.array(ScheduleExceptionSchema),
  bookingWindowDays: z.number().int(),
  walkInShare: z.number(),
  isActive: z.boolean(),
  /** `null` when no schedule has been saved yet (the response is then the default, empty). */
  updatedAt: IsoDateTimeSchema.nullable(),
});
export type Schedule = z.infer<typeof ScheduleSchema>;
