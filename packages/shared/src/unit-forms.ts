/**
 * The application form for each service (clinic or doctor, lab, pharmacy). One definition per
 * kind drives both the console form and the API check, so they cannot drift apart. Labels and
 * hints are texts in the console (`form.<kind>.<key>`), not here.
 *
 * Which fields each kind needs is a starting list. Licence and registration rules vary by state:
 * have them confirmed before launch.
 */
import { z } from 'zod';
import { IST_DATE_REGEX } from './common';
import { SPECIALTIES } from './specialties';
import { WORKSPACE_TYPES, type WorkspaceType } from './console-auth';

export type FormFieldType = 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'date';

export interface FormField {
  key: string;
  type: FormFieldType;
  required: boolean;
  /** text and textarea. Defaults to 200 (text) or 1000 (textarea). */
  maxLength?: number;
  /** number */
  min?: number;
  max?: number;
  /** select: the allowed values. */
  options?: readonly string[];
  /** text: the value must match this (anchored) expression. */
  pattern?: string;
}

const text = (key: string, required = true, extra: Partial<FormField> = {}): FormField => ({
  key,
  type: 'text',
  required,
  ...extra,
});
const area = (key: string, required = true, extra: Partial<FormField> = {}): FormField => ({
  key,
  type: 'textarea',
  required,
  ...extra,
});
const bool = (key: string): FormField => ({ key, type: 'boolean', required: true });

export const UNIT_FORMS: Record<WorkspaceType, readonly FormField[]> = {
  clinic: [
    text('displayName', true, { maxLength: 120 }),
    {
      key: 'specialty',
      type: 'select',
      required: true,
      options: SPECIALTIES.map((s) => s.key),
    },
    text('qualifications', true, { maxLength: 200 }),
    text('registrationNumber', true, { maxLength: 60 }),
    text('registrationCouncil', true, { maxLength: 120 }),
    { key: 'registrationYear', type: 'number', required: true, min: 1950, max: 2100 },
    { key: 'experienceYears', type: 'number', required: true, min: 0, max: 70 },
    text('city', true, { maxLength: 80 }),
    text('state', true, { maxLength: 80 }),
    text('pincode', true, { pattern: '[1-9]\\d{5}' }),
    area('address', true, { maxLength: 400 }),
    { key: 'consultationFeeRupees', type: 'number', required: true, min: 0, max: 100000 },
    text('languages', false, { maxLength: 120 }),
    area('about', false, { maxLength: 1000 }),
  ],
  lab: [
    text('labName', true, { maxLength: 120 }),
    text('ownerName', true, { maxLength: 120 }),
    text('city', true, { maxLength: 80 }),
    area('address', true, { maxLength: 400 }),
    text('registrationNumber', true, { maxLength: 60 }),
    bool('nablAccredited'),
    bool('homeCollection'),
    area('testsOffered', true, { maxLength: 1000 }),
    { key: 'turnaroundHours', type: 'number', required: false, min: 1, max: 720 },
  ],
  pharmacy: [
    text('storeName', true, { maxLength: 120 }),
    text('ownerName', true, { maxLength: 120 }),
    text('city', true, { maxLength: 80 }),
    area('address', true, { maxLength: 400 }),
    text('drugLicenceNumber', true, { maxLength: 60 }),
    { key: 'drugLicenceValidUntil', type: 'date', required: true },
    text('pharmacistName', true, { maxLength: 120 }),
    text('pharmacistRegistrationNumber', true, { maxLength: 60 }),
    text('gstNumber', false, { pattern: '\\d{2}[A-Z]{5}\\d{4}[A-Z][A-Z\\d]Z[A-Z\\d]' }),
    bool('homeDelivery'),
  ],
};

/** The profile field that names the service in lists. */
export const UNIT_NAME_FIELD: Record<WorkspaceType, string> = {
  clinic: 'displayName',
  lab: 'labName',
  pharmacy: 'storeName',
};

function fieldSchema(f: FormField): z.ZodType {
  let s: z.ZodType;
  switch (f.type) {
    case 'text':
    case 'textarea': {
      let str = z.string().trim().max(f.maxLength ?? (f.type === 'text' ? 200 : 1000));
      if (f.pattern) str = str.regex(new RegExp(`^${f.pattern}$`), 'Not in the expected format');
      s = f.required ? str.min(1, 'Required') : str;
      break;
    }
    case 'number':
      s = z
        .number()
        .int()
        .min(f.min ?? 0)
        .max(f.max ?? 1_000_000_000);
      break;
    case 'select':
      s = z.enum(f.options as [string, ...string[]]);
      break;
    case 'boolean':
      s = z.boolean();
      break;
    case 'date':
      s = z.string().regex(IST_DATE_REGEX, 'Expected YYYY-MM-DD');
      break;
  }
  return f.required ? s : s.optional();
}

/** Strict: an unknown field is an error, so nothing the form did not ask for is stored. */
export function unitProfileSchema(kind: WorkspaceType) {
  return z
    .object(Object.fromEntries(UNIT_FORMS[kind].map((f) => [f.key, fieldSchema(f)])))
    .strict();
}

/** Empty optional text counts as not given. */
export function cleanProfile(kind: WorkspaceType, raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of UNIT_FORMS[kind]) {
    const v = raw[f.key];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '' && !f.required))
      continue;
    out[f.key] = v;
  }
  // Keep unknown keys so the strict schema reports them.
  for (const k of Object.keys(raw)) if (!(k in out) && !UNIT_FORMS[kind].some((f) => f.key === k)) out[k] = raw[k];
  return out;
}

export interface ProfileIssue {
  path: string;
  message: string;
}

export function checkUnitProfile(
  kind: WorkspaceType,
  raw: Record<string, unknown>,
): { ok: true; profile: Record<string, unknown> } | { ok: false; issues: ProfileIssue[] } {
  const parsed = unitProfileSchema(kind).safeParse(cleanProfile(kind, raw));
  if (parsed.success) return { ok: true, profile: parsed.data as Record<string, unknown> };
  return {
    ok: false,
    issues: parsed.error.issues.flatMap((i) =>
      i.code === 'unrecognized_keys'
        ? i.keys.map((k) => ({ path: k, message: 'Not a field of this form' }))
        : [{ path: i.path.length ? String(i.path[0]) : '', message: i.message }],
    ),
  };
}

/** `POST /console/applications`: apply for one or more services at once, each with its form. */
export const ApplyRequestSchema = z
  .object({
    applications: z
      .array(z.object({ kind: z.enum(WORKSPACE_TYPES), profile: z.record(z.string(), z.unknown()) }).strict())
      .min(1)
      .max(WORKSPACE_TYPES.length)
      .refine((a) => new Set(a.map((x) => x.kind)).size === a.length, 'Apply for each service once'),
  })
  .strict();
export type ApplyRequest = z.infer<typeof ApplyRequestSchema>;
