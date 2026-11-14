/**
 * Labs: a lab that Doqto approved is listed for patients, who pick tests and send a booking
 * request (no online payment: the lab accepts or rejects, the patient pays at the lab). The lab
 * then collects the sample (at the lab or at the patient's home), and uploads the report.
 */
import { z } from 'zod';
import { IsoDateTimeSchema, ObjectIdSchema } from './common';

/** The path of the day a sample can be collected in. */
export const LAB_COLLECTION_MODES = ['lab', 'home'] as const;
export const LabCollectionModeSchema = z.enum(LAB_COLLECTION_MODES);
export type LabCollectionMode = z.infer<typeof LabCollectionModeSchema>;

/** Rough parts of a day: the lab confirms the exact time when it accepts. */
export const LAB_WINDOWS = ['morning', 'afternoon', 'evening'] as const;
export const LabWindowSchema = z.enum(LAB_WINDOWS);
export type LabWindow = z.infer<typeof LabWindowSchema>;

/**
 * requested -> accepted -> sample_collected -> processing -> report_ready -> completed.
 * A lab can reject a request; the patient can cancel until the sample is collected; a request
 * nobody answers within a day expires; a patient who is not there for a collection is a no_show.
 */
export const LAB_BOOKING_STATUSES = [
  'requested',
  'accepted',
  'sample_collected',
  'processing',
  'report_ready',
  'completed',
  'rejected',
  'cancelled_by_patient',
  'expired',
  'no_show',
] as const;
export const LabBookingStatusSchema = z.enum(LAB_BOOKING_STATUSES);
export type LabBookingStatus = z.infer<typeof LabBookingStatusSchema>;

/** Hours a request can wait for the lab before it expires. */
export const LAB_REQUEST_EXPIRY_HOURS = 24;
export const LAB_TESTS_PER_BOOKING_MAX = 20;
/** The most a single test can cost, in paise (₹50,000). */
export const LAB_TEST_PRICE_MAX_PAISE = 5_000_000;

export const LAB_OPEN_STATUSES: readonly LabBookingStatus[] = [
  'requested',
  'accepted',
  'sample_collected',
  'processing',
  'report_ready',
];
/** A patient can still cancel until the lab has the sample. */
export const LAB_PATIENT_CANCELLABLE: readonly LabBookingStatus[] = ['requested', 'accepted'];

// ---- Catalogue (the lab's tests and the groups they are in) --------------------------------

export const LabCategorySchema = z.object({ id: ObjectIdSchema, name: z.string() });
export type LabCategory = z.infer<typeof LabCategorySchema>;

export const LabTestSchema = z.object({
  id: ObjectIdSchema,
  name: z.string(),
  categoryId: ObjectIdSchema.nullable(),
  categoryName: z.string().nullable(),
  pricePaise: z.number().int().nonnegative(),
  sampleType: z.string().nullable(),
  preparation: z.string().nullable(),
  turnaroundHours: z.number().int().positive().nullable(),
  homeCollection: z.boolean(),
  active: z.boolean(),
});
export type LabTest = z.infer<typeof LabTestSchema>;

export const LabCatalogueSchema = z.object({
  categories: z.array(LabCategorySchema),
  tests: z.array(LabTestSchema),
});
export type LabCatalogue = z.infer<typeof LabCatalogueSchema>;

/** `POST /console/workspaces/:id/lab/categories` */
export const CreateLabCategoryRequestSchema = z
  .object({ name: z.string().trim().min(2).max(60) })
  .strict();
export type CreateLabCategoryRequest = z.infer<typeof CreateLabCategoryRequestSchema>;

const testFields = {
  name: z.string().trim().min(2).max(120),
  categoryId: ObjectIdSchema.nullable(),
  pricePaise: z.number().int().min(0).max(LAB_TEST_PRICE_MAX_PAISE),
  sampleType: z.string().trim().max(60).nullable(),
  preparation: z.string().trim().max(400).nullable(),
  turnaroundHours: z.number().int().min(1).max(720).nullable(),
  homeCollection: z.boolean(),
  active: z.boolean(),
};

/** `POST /console/workspaces/:id/lab/tests` */
export const CreateLabTestRequestSchema = z
  .object({
    name: testFields.name,
    pricePaise: testFields.pricePaise,
    categoryId: testFields.categoryId.optional(),
    sampleType: testFields.sampleType.optional(),
    preparation: testFields.preparation.optional(),
    turnaroundHours: testFields.turnaroundHours.optional(),
    homeCollection: testFields.homeCollection.optional(),
    active: testFields.active.optional(),
  })
  .strict();
export type CreateLabTestRequest = z.infer<typeof CreateLabTestRequestSchema>;

/** `PATCH /console/workspaces/:id/lab/tests/:testId`: any of the fields. */
export const UpdateLabTestRequestSchema = z
  .object({
    name: testFields.name.optional(),
    pricePaise: testFields.pricePaise.optional(),
    categoryId: testFields.categoryId.optional(),
    sampleType: testFields.sampleType.optional(),
    preparation: testFields.preparation.optional(),
    turnaroundHours: testFields.turnaroundHours.optional(),
    homeCollection: testFields.homeCollection.optional(),
    active: testFields.active.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change');
export type UpdateLabTestRequest = z.infer<typeof UpdateLabTestRequestSchema>;

// ---- What patients see of a lab ------------------------------------------------------------

export const LabListItemSchema = z.object({
  id: ObjectIdSchema,
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  nablAccredited: z.boolean(),
  homeCollection: z.boolean(),
  turnaroundHours: z.number().int().nullable(),
  testCount: z.number().int().nonnegative(),
  /** With a search: the names of this lab's tests that matched it (a few). */
  matchedTests: z.array(z.string()),
});
export type LabListItem = z.infer<typeof LabListItemSchema>;

export const LabListSchema = z.object({ items: z.array(LabListItemSchema) });
export type LabList = z.infer<typeof LabListSchema>;

/** A lab with the tests it offers (only the ones switched on). */
export const LabProfileSchema = LabListItemSchema.extend({
  address: z.string(),
  catalogue: LabCatalogueSchema,
});
export type LabProfile = z.infer<typeof LabProfileSchema>;

// ---- Bookings ------------------------------------------------------------------------------

export const LabCollectionSchema = z.object({
  mode: LabCollectionModeSchema,
  /** The day (IST) the patient wants the sample collected or to visit the lab. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  window: LabWindowSchema,
  /** For home collection: where to come. */
  address: z.string().nullable(),
});
export type LabCollection = z.infer<typeof LabCollectionSchema>;

/** `POST /labs/:slug/bookings`: a request, not a payment. */
export const CreateLabBookingRequestSchema = z
  .object({
    testIds: z.array(ObjectIdSchema).min(1).max(LAB_TESTS_PER_BOOKING_MAX),
    patientName: z.string().trim().min(2).max(120),
    mode: LabCollectionModeSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    window: LabWindowSchema,
    address: z.string().trim().min(5).max(400).optional(),
    note: z.string().trim().max(400).optional(),
  })
  .strict()
  .refine((v) => v.mode !== 'home' || Boolean(v.address), {
    path: ['address'],
    message: 'Enter the address for home collection',
  });
export type CreateLabBookingRequest = z.infer<typeof CreateLabBookingRequestSchema>;

const BookingItemSchema = z.object({
  testId: ObjectIdSchema,
  name: z.string(),
  pricePaise: z.number().int().nonnegative(),
});

const HistorySchema = z.object({ status: LabBookingStatusSchema, at: IsoDateTimeSchema });

/** A booking as the patient sees it. */
export const LabBookingSchema = z.object({
  id: ObjectIdSchema,
  /** A short code the patient can read out at the lab. */
  code: z.string(),
  status: LabBookingStatusSchema,
  lab: z.object({ id: ObjectIdSchema, slug: z.string(), name: z.string(), city: z.string() }),
  patientName: z.string(),
  items: z.array(BookingItemSchema),
  totalPaise: z.number().int().nonnegative(),
  collection: LabCollectionSchema,
  note: z.string().nullable(),
  /** Why the lab said no. */
  rejectReason: z.string().nullable(),
  history: z.array(HistorySchema),
  /** The report can be downloaded when this is true. */
  reportReady: z.boolean(),
  createdAt: IsoDateTimeSchema,
});
export type LabBooking = z.infer<typeof LabBookingSchema>;

export const LabBookingListSchema = z.object({ items: z.array(LabBookingSchema) });
export type LabBookingList = z.infer<typeof LabBookingListSchema>;

/** A booking as the lab sees it: with the patient's contact and who is collecting. */
export const LabConsoleBookingSchema = LabBookingSchema.omit({ lab: true }).extend({
  patientPhone: z.string(),
  assignedTo: z.object({ accountId: ObjectIdSchema, name: z.string() }).nullable(),
  reportUploadedAt: IsoDateTimeSchema.nullable(),
});
export type LabConsoleBooking = z.infer<typeof LabConsoleBookingSchema>;

export const LabConsoleBookingListSchema = z.object({
  items: z.array(LabConsoleBookingSchema),
  /** Whether report upload is switched on (it waits for the data-protection review in live). */
  reportsEnabled: z.boolean(),
});
export type LabConsoleBookingList = z.infer<typeof LabConsoleBookingListSchema>;

/** `POST /console/workspaces/:id/lab/bookings/:bookingId/decision` */
export const LabBookingDecisionRequestSchema = z
  .object({
    decision: z.enum(['accept', 'reject']),
    reason: z.string().trim().min(3).max(300).optional(),
  })
  .strict()
  .refine((v) => v.decision !== 'reject' || Boolean(v.reason), {
    path: ['reason'],
    message: 'Tell the patient why',
  });
export type LabBookingDecisionRequest = z.infer<typeof LabBookingDecisionRequestSchema>;

/** The steps a lab moves a booking through after accepting it. */
export const LAB_PROGRESS_STEPS = ['collected', 'no_show', 'processing', 'completed'] as const;
export const LabProgressRequestSchema = z
  .object({ step: z.enum(LAB_PROGRESS_STEPS) })
  .strict();
export type LabProgressRequest = z.infer<typeof LabProgressRequestSchema>;

/** `PUT .../bookings/:bookingId/assignee` */
export const LabAssignRequestSchema = z
  .object({ accountId: ObjectIdSchema.nullable() })
  .strict();
export type LabAssignRequest = z.infer<typeof LabAssignRequestSchema>;

/** The people who can be given a collection: the owner and staff with the collection permission. */
export const LabCollectorsSchema = z.object({
  items: z.array(z.object({ accountId: ObjectIdSchema, name: z.string() })),
});
export type LabCollectors = z.infer<typeof LabCollectorsSchema>;

/** `GET /me/lab-bookings/:id/report`: a short-lived link to the PDF. */
export const LabReportLinkSchema = z.object({
  url: z.string(),
  expiresAt: IsoDateTimeSchema,
  /** A name for the saved file, such as `lab-report-K7Q2MX.pdf`. */
  fileName: z.string(),
});
export type LabReportLink = z.infer<typeof LabReportLinkSchema>;

/** Report files: PDF or an image of one, up to 5 MB (the same rule as patient records). */
export const LAB_REPORT_MAX_BYTES = 5 * 1024 * 1024;
