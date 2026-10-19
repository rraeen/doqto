import type {
  DoctorOnboardingRequest,
  DoctorPrivateProfile,
  Gender,
  SpecialtyKey,
  UpdateDoctorProfileRequest,
} from '@doqto/shared';
import type { Translate } from '@/i18n/translate';
import { paiseToRupeesInput, rupeesToPaise } from '@/lib/money';

/** Everything the doctor form edits, as strings where the user types numbers. */
export interface DoctorForm {
  name: string;
  gender: Gender | null;
  languages: string[];
  experienceYears: string;
  bio: string;
  qualifications: { degree: string; institute: string; year: string }[];
  specialties: SpecialtyKey[];
  council: string;
  regNumber: string;
  regYear: string;
  consultFee: string;
  bookingFee: string;
}

export type FormErrors = Partial<Record<string, string>>;

export const emptyQualification = () => ({ degree: '', institute: '', year: '' });

export function emptyDoctorForm(name = ''): DoctorForm {
  return {
    name,
    gender: null,
    languages: ['Hindi'],
    experienceYears: '',
    bio: '',
    qualifications: [emptyQualification()],
    specialties: [],
    council: '',
    regNumber: '',
    regYear: '',
    consultFee: '',
    bookingFee: '15',
  };
}

export function formFromProfile(p: DoctorPrivateProfile): DoctorForm {
  return {
    name: p.name,
    gender: p.gender,
    languages: p.languages,
    experienceYears: p.experienceYears === null ? '' : String(p.experienceYears),
    bio: p.bio ?? '',
    qualifications: p.qualifications.length
      ? p.qualifications.map((q) => ({
          degree: q.degree,
          institute: q.institute ?? '',
          year: q.year === undefined ? '' : String(q.year),
        }))
      : [emptyQualification()],
    specialties: p.specialties,
    council: p.registration.council,
    regNumber: p.registration.number,
    regYear: String(p.registration.year),
    consultFee: paiseToRupeesInput(p.consultFee),
    bookingFee: paiseToRupeesInput(p.bookingFee),
  };
}

const int = (v: string) => (v.trim() === '' ? undefined : Number(v.trim()));

export interface Limits {
  maxSpecialties: number;
  bookingFeeMin: number;
  bookingFeeMax: number;
  consultFeeMax: number;
}

export type Section = 'about' | 'qualifications' | 'specialties' | 'registration' | 'fees';

const YEAR_MIN = 1950;
const thisYear = () => new Date().getFullYear();

function checkYear(v: string, required: boolean, t: Translate): string | undefined {
  if (!v.trim()) return required ? t('form.required') : undefined;
  const n = Number(v);
  const max = thisYear();
  return Number.isInteger(n) && n >= YEAR_MIN && n <= max
    ? undefined
    : t('form.invalidYear', { min: YEAR_MIN, max });
}

/** Client-side checks mirroring the contract limits; the API validates again. */
export function validateSection(
  section: Section,
  f: DoctorForm,
  limits: Limits,
  t: Translate,
): FormErrors {
  const e: FormErrors = {};
  if (section === 'about') {
    if (f.name.trim().length < 2) e.name = f.name.trim() ? t('form.tooShort') : t('form.required');
    if (f.experienceYears.trim()) {
      const n = Number(f.experienceYears);
      if (!Number.isInteger(n) || n < 0 || n > 70)
        e.experienceYears = t('form.invalidNumber', { min: 0, max: 70 });
    }
  }
  if (section === 'qualifications') {
    f.qualifications.forEach((q, i) => {
      if (!q.degree.trim()) e[`qualifications.${i}.degree`] = t('form.required');
      const year = checkYear(q.year, false, t);
      if (year) e[`qualifications.${i}.year`] = year;
    });
  }
  if (section === 'specialties') {
    if (f.specialties.length === 0) e.specialties = t('form.required');
    else if (f.specialties.length > limits.maxSpecialties) {
      e.specialties = t('doctor.specialtiesMax', { max: limits.maxSpecialties });
    }
  }
  if (section === 'registration') {
    if (f.council.trim().length < 2) e.council = t('form.required');
    if (!f.regNumber.trim()) e.regNumber = t('form.required');
    const year = checkYear(f.regYear, true, t);
    if (year) e.regYear = year;
  }
  if (section === 'fees') {
    const consult = rupeesToPaise(f.consultFee);
    if (consult !== null && !(consult >= 0 && consult <= limits.consultFeeMax)) {
      e.consultFee = t('form.invalidNumber', { min: 0, max: limits.consultFeeMax / 100 });
    }
    const booking = rupeesToPaise(f.bookingFee);
    if (booking === null) e.bookingFee = t('form.required');
    else if (!(booking >= limits.bookingFeeMin && booking <= limits.bookingFeeMax)) {
      e.bookingFee = t('form.invalidNumber', {
        min: limits.bookingFeeMin / 100,
        max: limits.bookingFeeMax / 100,
      });
    }
  }
  return e;
}

export function validateAll(
  sections: Section[],
  f: DoctorForm,
  limits: Limits,
  t: Translate,
): FormErrors {
  return Object.assign({}, ...sections.map((s) => validateSection(s, f, limits, t))) as FormErrors;
}

function qualificationsOf(f: DoctorForm) {
  return f.qualifications.map((q) => ({
    degree: q.degree.trim(),
    ...(q.institute.trim() ? { institute: q.institute.trim() } : {}),
    ...(q.year.trim() ? { year: Number(q.year) } : {}),
  }));
}

function registrationOf(f: DoctorForm) {
  return { council: f.council.trim(), number: f.regNumber.trim(), year: Number(f.regYear) };
}

export function toOnboardingRequest(f: DoctorForm): DoctorOnboardingRequest {
  const experienceYears = int(f.experienceYears);
  return {
    name: f.name.trim(),
    ...(f.gender ? { gender: f.gender } : {}),
    ...(f.languages.length ? { languages: f.languages } : {}),
    qualifications: qualificationsOf(f),
    specialties: f.specialties,
    ...(experienceYears === undefined ? {} : { experienceYears }),
    registration: registrationOf(f),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only the fields that changed, so an unrelated save never resets verification. */
export function toProfilePatch(
  f: DoctorForm,
  p: DoctorPrivateProfile,
): UpdateDoctorProfileRequest | null {
  const patch: Record<string, unknown> = {};
  const set = (key: keyof UpdateDoctorProfileRequest, next: unknown, prev: unknown) => {
    if (!same(next, prev)) patch[key] = next;
  };
  set('name', f.name.trim(), p.name);
  set('gender', f.gender, p.gender);
  set('bio', f.bio.trim() || null, p.bio);
  set('languages', f.languages, p.languages);
  set('experienceYears', int(f.experienceYears) ?? null, p.experienceYears);
  set('qualifications', qualificationsOf(f), p.qualifications);
  set('specialties', f.specialties, p.specialties);
  set('consultFee', rupeesToPaise(f.consultFee), p.consultFee);
  set('bookingFee', rupeesToPaise(f.bookingFee), p.bookingFee);
  const { documentUploaded: _uploaded, ...prevRegistration } = p.registration;
  set('registration', registrationOf(f), prevRegistration);
  return Object.keys(patch).length ? (patch as UpdateDoctorProfileRequest) : null;
}

/** Maps API `VALIDATION_FAILED` issues (`path: "qualifications.0.degree"`) onto form fields. */
export function errorsFromIssues(issues: unknown, fallback: string): FormErrors {
  if (!Array.isArray(issues)) return {};
  const map: Record<string, string> = {
    'registration.council': 'council',
    'registration.number': 'regNumber',
    'registration.year': 'regYear',
  };
  const e: FormErrors = {};
  for (const issue of issues as { path?: unknown }[]) {
    if (typeof issue.path !== 'string') continue;
    e[map[issue.path] ?? issue.path] = fallback;
  }
  return e;
}

/** Matches the API: case, spacing and a leading "Dr" are not a rename that needs review. */
export function comparableName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^\s*dr\.?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
