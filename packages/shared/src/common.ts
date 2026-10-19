/**
 * Conventions every schema follows (DB doc section 1, BE-02):
 * - ids are 24-char hex ObjectId strings;
 * - instants are ISO 8601 UTC strings (`2026-10-10T04:30:00.000Z`);
 * - a clinic day is an IST date string `YYYY-MM-DD`;
 * - money is an integer number of paise (₹15 = 1500);
 * - phones are E.164 (`+919876543210`). Phase 1 accepts Indian mobile numbers only.
 */
import { z } from 'zod';

export const OBJECT_ID_REGEX = /^[a-f0-9]{24}$/;
export const IST_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_OF_DAY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PHONE_E164_IN_REGEX = /^\+91[6-9]\d{9}$/;
export const PHONE_FORMAT_MESSAGE =
  'Expected an Indian mobile number in E.164 format, like +919876543210';

export const ObjectIdSchema = z.string().regex(OBJECT_ID_REGEX, 'Expected a 24-character hex id');
export type ObjectId = z.infer<typeof ObjectIdSchema>;

export const IsoDateTimeSchema = z.iso.datetime();
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

export const IstDateSchema = z.string().regex(IST_DATE_REGEX, 'Expected YYYY-MM-DD');
export type IstDate = z.infer<typeof IstDateSchema>;

/** `HH:mm`, 24-hour, IST wall-clock (schedules). */
export const TimeOfDaySchema = z.string().regex(TIME_OF_DAY_REGEX, 'Expected HH:mm');
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;

/** Indian mobile number in E.164: +91 followed by 10 digits starting 6-9. */
export const PhoneSchema = z.string().regex(PHONE_E164_IN_REGEX, PHONE_FORMAT_MESSAGE);
export type Phone = z.infer<typeof PhoneSchema>;

export const PaiseSchema = z.number().int().nonnegative();
export type Paise = z.infer<typeof PaiseSchema>;

/** Cursor pagination query (`?cursor=&limit=20`). The cursor is opaque to clients. */
export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 50;
export const CursorQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});
export type CursorQuery = z.infer<typeof CursorQuerySchema>;

export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    /** Pass back as `cursor` to get the next page; `null` when there are no more items. */
    nextCursor: z.string().nullable(),
  });
}
export type Page<T> = { items: T[]; nextCursor: string | null };

/** GeoJSON Point, `[lng, lat]` order (DB doc 3.3). */
export const GeoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;
