import {
  ACTIVE_APPOINTMENT_STATUSES,
  doctorReference,
  PROFILE_REQUIREMENTS,
  type Appointment,
  type RatingSummary,
  type ReviewRatings,
  type ReviewState,
  type VisitReason,
  type WouldRecommend,
  RATING_DIMENSIONS,
  type Address,
  type AdminDoctorQueueItem,
  type ClinicPrivate,
  type DoctorListItem,
  type DoctorPrivateProfile,
  type DoctorProfile,
  type GeoPoint,
  type Registration,
  OTP_MAX_ATTEMPTS,
  OTP_REQUEST_LIMIT,
  OTP_REQUEST_WINDOW_SECONDS,
  OTP_TTL_SECONDS,
  type Language,
  type Me,
} from '@doqto/shared';
import { DEMO_OTP_CODE } from '@/lib/demo';
import { seedReviews } from './review-seed';
import { SEED_CLINICS, SEED_DOCTORS } from './seed';

type ProfileRequirement = (typeof PROFILE_REQUIREMENTS)[number];

/** The fixed demo OTP (TDD 13). The mocks behave like the API in demo mode. */
export const MOCK_OTP = DEMO_OTP_CODE;
export const MOCK_ADMIN_PHONE = '+919999999999';

interface OtpRow {
  expiresAt: number;
  attempts: number;
}

interface MockState {
  users: Record<string, Me>;
  /** User id of the signed-in user; stands in for the httpOnly cookies the real API sets. */
  sessionUserId: string | null;
  otps: Record<string, OtpRow>;
  otpRequests: Record<string, number[]>;
  doctors: Record<string, MockDoctor>;
  clinics: Record<string, MockClinic>;
  appointments: Record<string, MockAppointment>;
  reviews: Record<string, MockReview>;
  pushSubscriptions: Record<string, MockPushSubscription[]>;
  /** Users who already got their example finished visits (see `ensurePastVisits`). */
  pastVisitsFor: Record<string, true>;
}

/** Stored doctor; `missing`, `isListed`, `city` and `clinicIds` are derived on read like the API. */
export type MockDoctor = Omit<
  DoctorPrivateProfile,
  'missing' | 'isListed' | 'city' | 'clinicIds' | 'registration'
> & {
  userId: string;
  phone: string;
  registration: Registration;
  documentUploaded: boolean;
  /** Object URL of the uploaded scan (mock stand-in for the signed URL). */
  documentUrl: string | null;
};

/** A stored booking: the contract's `Appointment` plus what the API keeps server-side. */
export type MockAppointment = Appointment & {
  userId: string;
  patientPhone: string;
  /** Doqto fee in paise, copied from the doctor when booked. */
  bookingFee: number;
  /** Set when payment confirms; only ever returned once, with the confirmation. */
  visitCode: string | null;
};

/** A stored review: what the API keeps, with the author and the fraud-check outcome. */
export interface MockReview {
  id: string;
  appointmentId: string;
  doctorId: string;
  userId: string;
  /** First name and last initial. */
  reviewerName: string;
  ratings: ReviewRatings;
  wouldRecommend: WouldRecommend;
  reason: VisitReason;
  text: string | null;
  waitedMinutes: number | null;
  state: ReviewState;
  submittedAt: string;
  editedAt: string | null;
  publishedAt: string | null;
  visitMonth: string;
  reply: { text: string; at: string } | null;
  reports: number;
}

/** A device a patient registered for Web Push. */
export interface MockPushSubscription {
  id: string;
  endpoint: string;
}

/** Switches for the mocks. Tests turn the example finished visits off to keep counts exact. */
export const mockConfig = { seedPastVisits: true };

export interface MockClinic {
  id: string;
  name: string;
  phone: string | null;
  address: Address;
  location: GeoPoint | null;
  photoUrls: string[];
  ownerUserId: string;
  doctorIds: string[];
  staffUserIds: string[];
  createdAt: string;
}

const STORAGE_KEY = 'doqto_mock_db';

function emptyState(): MockState {
  return {
    users: {},
    sessionUserId: null,
    otps: {},
    otpRequests: {},
    doctors: Object.fromEntries(SEED_DOCTORS.map((d) => [d.id, d])),
    clinics: Object.fromEntries(SEED_CLINICS.map((c) => [c.id, c])),
    appointments: {},
    reviews: seedReviews(),
    pushSubscriptions: {},
    pastVisitsFor: {},
  };
}

function load(): MockState {
  if (typeof localStorage === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const fresh = emptyState();
    const saved = { ...fresh, ...(JSON.parse(raw) as Partial<MockState>) };
    // Doctors and clinics added to the seed later still reach a browser that saved an older state;
    // anything saved (edits, new doctors) wins over the seed.
    return {
      ...saved,
      doctors: { ...fresh.doctors, ...saved.doctors },
      clinics: { ...fresh.clinics, ...saved.clinics },
    };
  } catch {
    return emptyState();
  }
}

let state = load();

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the mocks keep working in memory.
  }
}

export function resetMockDb() {
  state = emptyState();
  persist();
}

function objectId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type OtpRequestResult =
  { ok: true; expiresAt: number } | { ok: false; retryAfterSeconds: number };

export function recordOtpRequest(phone: string, now = Date.now()): OtpRequestResult {
  const windowMs = OTP_REQUEST_WINDOW_SECONDS * 1000;
  const recent = (state.otpRequests[phone] ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= OTP_REQUEST_LIMIT) {
    const oldest = recent[0] ?? now;
    return { ok: false, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  state.otpRequests[phone] = [...recent, now];
  const expiresAt = now + OTP_TTL_SECONDS * 1000;
  // A new request replaces any earlier unused OTP.
  state.otps[phone] = { expiresAt, attempts: 0 };
  persist();
  return { ok: true, expiresAt };
}

export type OtpCheckResult =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'locked' }
  | { ok: false; reason: 'invalid'; attemptsLeft: number };

export function checkOtp(phone: string, code: string, now = Date.now()): OtpCheckResult {
  const row = state.otps[phone];
  if (!row || row.expiresAt <= now) return { ok: false, reason: 'expired' };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'locked' };
  if (code !== MOCK_OTP) {
    row.attempts += 1;
    persist();
    const attemptsLeft = OTP_MAX_ATTEMPTS - row.attempts;
    return attemptsLeft <= 0
      ? { ok: false, reason: 'locked' }
      : { ok: false, reason: 'invalid', attemptsLeft };
  }
  // Used OTPs cannot be replayed.
  delete state.otps[phone];
  persist();
  return { ok: true };
}

export function findOrCreateUser(
  phone: string,
  whatsappOptIn: boolean | undefined,
): { user: Me; isNewUser: boolean } {
  const existing = Object.values(state.users).find((u) => u.phone === phone);
  if (existing) return { user: existing, isNewUser: false };
  const user: Me = {
    id: objectId(),
    phone,
    name: null,
    // Mock-only convenience: this number signs in as an admin, to try the verification screens.
    roles: phone === MOCK_ADMIN_PHONE ? ['patient', 'admin'] : ['patient'],
    language: 'en',
    whatsappOptIn: whatsappOptIn ?? true,
    status: 'active',
    clinicIds: [],
    isDemo: true,
    createdAt: new Date().toISOString(),
  };
  state.users[user.id] = user;
  persist();
  return { user, isNewUser: true };
}

export function startSession(userId: string) {
  state.sessionUserId = userId;
  persist();
}

export function endSession() {
  state.sessionUserId = null;
  persist();
}

export function sessionUser(): Me | null {
  return state.sessionUserId ? (state.users[state.sessionUserId] ?? null) : null;
}

export function updateUser(
  id: string,
  patch: { name?: string; language?: Language; whatsappOptIn?: boolean },
): Me | null {
  const user = state.users[id];
  if (!user) return null;
  const next = { ...user, ...patch };
  state.users[id] = next;
  persist();
  return next;
}

export function objectIdForMocks(): string {
  return objectId();
}

export function save() {
  persist();
}

export function userById(id: string): Me | null {
  return state.users[id] ?? null;
}

export function addRole(userId: string, role: Me['roles'][number]) {
  const user = state.users[userId];
  if (user && !user.roles.includes(role)) {
    state.users[userId] = { ...user, roles: [...user.roles, role] };
    persist();
  }
}

/* ---------- Appointments ---------- */

export function appointmentById(id: string): MockAppointment | null {
  return state.appointments[id] ?? null;
}

export function putAppointment(appt: MockAppointment) {
  state.appointments[appt.id] = appt;
  persist();
}

/** Marks holds that ran out as `expired`, like the API's minute job (BE-28). */
export function expireHolds(now = Date.now()) {
  let changed = false;
  for (const a of Object.values(state.appointments)) {
    if (a.status === 'pending_payment' && a.holdExpiresAt && Date.parse(a.holdExpiresAt) <= now) {
      a.status = 'expired';
      a.holdExpiresAt = null;
      changed = true;
    }
  }
  if (changed) persist();
}

export function appointmentsOfUser(userId: string): MockAppointment[] {
  return Object.values(state.appointments).filter((a) => a.userId === userId);
}

/** Start times of bookings that still hold a slot with this doctor. */
export function heldSlotStarts(doctorId: string, clinicId: string): Set<string> {
  const held = new Set<string>();
  for (const a of Object.values(state.appointments)) {
    if (a.doctorId !== doctorId || a.clinicId !== clinicId || !a.slotStart) continue;
    if (ACTIVE_APPOINTMENT_STATUSES.some((st) => st === a.status)) held.add(a.slotStart);
  }
  return held;
}

/* ---------- Push, data export and deleting an account ---------- */

export function pushSubscriptionsOf(userId: string): MockPushSubscription[] {
  return state.pushSubscriptions[userId] ?? [];
}

export function setPushSubscriptions(userId: string, list: MockPushSubscription[]) {
  state.pushSubscriptions[userId] = list;
  persist();
}

export function allReviewsOf(userId: string): MockReview[] {
  return Object.values(state.reviews).filter((x) => x.userId === userId);
}

export function allReviews(): MockReview[] {
  return Object.values(state.reviews);
}

/**
 * Deletes a patient like the API will (BE-42): the user and sign-in go, the name and phone on
 * their appointments are blanked, and their reviews stay as "Verified patient".
 */
export function deleteUser(userId: string) {
  delete state.users[userId];
  delete state.pushSubscriptions[userId];
  for (const a of Object.values(state.appointments)) {
    if (a.userId !== userId) continue;
    a.patientName = 'Deleted user';
    a.patientPhone = '';
    a.visitCode = null;
  }
  for (const r of Object.values(state.reviews)) {
    if (r.userId === userId) r.reviewerName = 'Verified patient';
  }
  if (state.sessionUserId === userId) state.sessionUserId = null;
  persist();
}

/* ---------- Reviews ---------- */

export function reviewById(id: string): MockReview | null {
  return state.reviews[id] ?? null;
}

export function putReview(review: MockReview) {
  state.reviews[review.id] = review;
  persist();
}

export function reviewForAppointment(appointmentId: string): MockReview | null {
  return Object.values(state.reviews).find((x) => x.appointmentId === appointmentId) ?? null;
}

/** Reviews the public can see for a doctor: published only, newest first. */
export function publicReviewsOf(doctorId: string): MockReview[] {
  return Object.values(state.reviews)
    .filter((x) => x.doctorId === doctorId && x.state === 'published')
    .sort((a, b) => Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? ''));
}

/** Only a patient's most recent published review of a doctor counts towards the score. */
export function countedReviewsOf(doctorId: string): MockReview[] {
  const latest = new Map<string, MockReview>();
  for (const x of publicReviewsOf(doctorId)) if (!latest.has(x.userId)) latest.set(x.userId, x);
  return [...latest.values()];
}

/** The mock's stand-in for the API's rating job; `null` under 5 counted reviews. */
export function reviewSummaryFor(doctorId: string): RatingSummary | null {
  const counted = countedReviewsOf(doctorId);
  if (counted.length < 5) return null;
  const mean = (pick: (x: MockReview) => number) =>
    Math.round((counted.reduce((n, x) => n + pick(x), 0) / counted.length) * 10) / 10;
  const dims = Object.fromEntries(
    RATING_DIMENSIONS.map((d) => [
      d,
      Math.min(
        5,
        Math.max(
          1,
          mean((x) => x.ratings[d]),
        ),
      ),
    ]),
  ) as Record<(typeof RATING_DIMENSIONS)[number], number>;
  const yes = counted.filter((x) => x.wouldRecommend === 'yes').length;
  return {
    count: counted.length,
    recommendPct: Math.round((yes / counted.length) * 100),
    ...dims,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Gives a new patient three finished visits to try reviewing: one that ended 3 days ago (open),
 * one 2 hours ago (opens tomorrow) and one 45 days ago (closed). The real app has real visits.
 */
export function ensurePastVisits(userId: string, now = Date.now()) {
  if (!mockConfig.seedPastVisits || state.pastVisitsFor[userId]) return;
  const doctor = state.doctors['5eed00000000000000000201'];
  const clinic = doctor ? clinicsOfDoctor(doctor.id)[0] : undefined;
  if (!doctor || !clinic) return;
  const ended = [3 * 86_400_000, 2 * 3_600_000, 45 * 86_400_000];
  for (const ago of ended) {
    const end = now - ago;
    const start = end - 15 * 60_000;
    const date = new Date(start + 5.5 * 3_600_000).toISOString().slice(0, 10);
    const appt: MockAppointment = {
      id: objectId(),
      doctorId: doctor.id,
      clinicId: clinic.id,
      patientName: state.users[userId]?.name ?? 'Patient',
      date,
      slotStart: new Date(start).toISOString(),
      slotEnd: new Date(end).toISOString(),
      source: 'online',
      status: 'completed',
      holdExpiresAt: null,
      queueToken: 3,
      checkInAt: new Date(start).toISOString(),
      visitVerified: true,
      reviewUnlockAt: new Date(end + 24 * 3_600_000).toISOString(),
      createdAt: new Date(start - 86_400_000).toISOString(),
      userId,
      patientPhone: state.users[userId]?.phone ?? '+919000000000',
      bookingFee: doctor.bookingFee ?? 1500,
      visitCode: null,
    };
    state.appointments[appt.id] = appt;
  }
  state.pastVisitsFor[userId] = true;
  persist();
}

/* ---------- Doctors ---------- */

export function doctorByUser(userId: string): MockDoctor | null {
  return Object.values(state.doctors).find((d) => d.userId === userId) ?? null;
}

export function doctorById(id: string): MockDoctor | null {
  return state.doctors[id] ?? null;
}

export function putDoctor(doc: MockDoctor) {
  state.doctors[doc.id] = { ...doc, updatedAt: new Date().toISOString() };
  persist();
}

export function clinicsOfDoctor(doctorId: string): MockClinic[] {
  return Object.values(state.clinics).filter((c) => c.doctorIds.includes(doctorId));
}

function missingFor(d: MockDoctor): ProfileRequirement[] {
  const has: Record<ProfileRequirement, boolean> = {
    registration_document: d.documentUploaded,
    clinic: clinicsOfDoctor(d.id).length > 0,
    specialties: d.specialties.length > 0,
    qualifications: d.qualifications.length > 0,
    booking_fee: d.bookingFee !== null,
  };
  return PROFILE_REQUIREMENTS.filter((r) => !has[r]);
}

export function toPrivateProfile(d: MockDoctor): DoctorPrivateProfile {
  const clinics = clinicsOfDoctor(d.id);
  const missing = missingFor(d);
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    gender: d.gender,
    photoUrl: d.photoUrl,
    bio: d.bio,
    languages: d.languages,
    qualifications: d.qualifications,
    specialties: d.specialties,
    experienceYears: d.experienceYears,
    registration: { ...d.registration, documentUploaded: d.documentUploaded },
    verification: d.verification,
    consultFee: d.consultFee,
    bookingFee: d.bookingFee,
    clinicIds: clinics.map((c) => c.id),
    city: clinics[0]?.address.city ?? null,
    isListed: d.verification.status === 'verified' && missing.length === 0,
    missing,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function slugFor(name: string, city: string | null): string {
  const part = (v: string) =>
    v
      .toLowerCase()
      .replace(/^dr\.?\s*/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const base = `dr-${part(name)}${city ? `-${part(city)}` : ''}`;
  const taken = new Set(Object.values(state.doctors).map((d) => d.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/* ---------- Clinics ---------- */

export function clinicById(id: string): MockClinic | null {
  return state.clinics[id] ?? null;
}

export function putClinic(clinic: MockClinic) {
  state.clinics[clinic.id] = clinic;
  persist();
}

export function clinicsForUser(userId: string): MockClinic[] {
  const doctor = doctorByUser(userId);
  return Object.values(state.clinics).filter(
    (c) =>
      c.ownerUserId === userId ||
      (doctor !== null && c.doctorIds.includes(doctor.id)) ||
      c.staffUserIds.includes(userId),
  );
}

export function canManageClinic(clinic: MockClinic, userId: string): boolean {
  const doctor = doctorByUser(userId);
  return clinic.ownerUserId === userId || (doctor !== null && clinic.doctorIds.includes(doctor.id));
}

export function mapsUrl(location: GeoPoint | null): string | null {
  if (!location) return null;
  const [lng, lat] = location.coordinates;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function toPublicClinic(c: MockClinic) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    location: c.location,
    photoUrls: c.photoUrls,
    timezone: 'Asia/Kolkata' as const,
    mapsUrl: mapsUrl(c.location),
  };
}

export function toPrivateClinic(c: MockClinic, viewerId: string): ClinicPrivate {
  return {
    ...toPublicClinic(c),
    ownerUserId: c.ownerUserId,
    doctorIds: c.doctorIds,
    staff: c.staffUserIds.map((uid) => {
      const u = state.users[uid];
      return {
        userId: uid,
        name: u?.name ?? null,
        phone: u?.phone ?? '+919000000000',
        addedAt: c.createdAt,
      };
    }),
    canManage: canManageClinic(c, viewerId),
    createdAt: c.createdAt,
  };
}

/** Finds or creates a staff user by phone, like `POST /clinics/:id/staff`. */
export function staffUser(phone: string, name: string | undefined): Me {
  const { user } = findOrCreateUser(phone, false);
  const next: Me = {
    ...user,
    name: user.name ?? name ?? null,
    roles: user.roles.includes('clinic_staff') ? user.roles : [...user.roles, 'clinic_staff'],
  };
  state.users[user.id] = next;
  persist();
  return next;
}

/* ---------- Public directory ---------- */

function listedDoctors(): MockDoctor[] {
  return Object.values(state.doctors).filter((d) => toPrivateProfile(d).isListed);
}

function distanceMeters(a: GeoPoint, lat: number, lng: number): number {
  const [lng1, lat1] = a.coordinates;
  const rad = Math.PI / 180;
  const dLat = (lat - lat1) * rad;
  const dLng = (lng - lng1) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export interface MockSearch {
  city?: string;
  specialty?: string;
  near?: { lat: number; lng: number };
  radiusKm: number;
  q?: string;
}

export function searchListed(query: MockSearch): DoctorListItem[] {
  const results: DoctorListItem[] = [];
  for (const d of listedDoctors()) {
    const clinics = clinicsOfDoctor(d.id);
    if (
      query.specialty &&
      !d.specialties.includes(query.specialty as MockDoctor['specialties'][number])
    )
      continue;
    if (query.q) {
      const needle = query.q.toLowerCase();
      const byName = d.name.toLowerCase().includes(needle);
      const byId = d.id === query.q || doctorReference(d.id).toLowerCase() === needle;
      if (!byName && !byId) continue;
    }
    let primary = clinics[0];
    let distance: number | null = null;
    if (query.near) {
      const near = query.near;
      const withDistance = clinics
        .filter((c) => c.location)
        .map((c) => ({ c, m: distanceMeters(c.location as GeoPoint, near.lat, near.lng) }))
        .sort((x, y) => x.m - y.m);
      const best = withDistance[0];
      if (!best || best.m > query.radiusKm * 1000) continue;
      primary = best.c;
      distance = Math.round(best.m);
    } else if (
      query.city &&
      !clinics.some((c) => c.address.city.toLowerCase() === query.city?.toLowerCase())
    ) {
      continue;
    }
    results.push({
      id: d.id,
      slug: d.slug,
      name: d.name,
      photoUrl: d.photoUrl,
      specialties: d.specialties,
      experienceYears: d.experienceYears,
      city: primary?.address.city ?? '',
      consultFee: d.consultFee,
      ratingSummary: reviewSummaryFor(d.id),
      distanceMeters: distance,
      primaryClinic: primary
        ? { id: primary.id, name: primary.name, area: primary.address.area ?? null }
        : null,
    });
  }
  return results.sort(
    (a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0) || a.name.localeCompare(b.name),
  );
}

export function mockPublicProfile(slug: string): DoctorProfile | null {
  const d = listedDoctors().find((x) => x.slug === slug || x.id === slug);
  if (!d) return null;
  const clinics = clinicsOfDoctor(d.id);
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    gender: d.gender,
    photoUrl: d.photoUrl,
    bio: d.bio,
    languages: d.languages,
    qualifications: d.qualifications,
    specialties: d.specialties,
    experienceYears: d.experienceYears,
    verificationStatus: d.verification.status,
    city: clinics[0]?.address.city ?? '',
    consultFee: d.consultFee,
    bookingFee: d.bookingFee,
    clinics: clinics.map(toPublicClinic),
    ratingSummary: reviewSummaryFor(d.id),
    todayStatus: null,
  };
}

/* ---------- Admin ---------- */

export function adminQueue(status: string): AdminDoctorQueueItem[] {
  return Object.values(state.doctors)
    .filter((d) => d.verification.status === status)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((d) => {
      const p = toPrivateProfile(d);
      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        city: p.city,
        specialties: d.specialties,
        registration: d.registration,
        documentUploaded: d.documentUploaded,
        verificationStatus: d.verification.status,
        submittedAt: d.createdAt,
      };
    });
}
