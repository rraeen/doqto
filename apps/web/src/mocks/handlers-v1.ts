import {
  AddStaffRequestSchema,
  AdminDoctorDetailSchema,
  AdminDoctorQueueItemSchema,
  ClinicPrivateSchema,
  CreateClinicRequestSchema,
  DoctorListItemSchema,
  DoctorOnboardingRequestSchema,
  DoctorPrivateProfileSchema,
  DoctorProfileSchema,
  ENDPOINTS,
  GeocodeResponseSchema,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  REGISTRATION_DOC_MAX_BYTES,
  REGISTRATION_DOC_TYPES,
  RegistrationDocumentResponseSchema,
  UpdateClinicRequestSchema,
  UpdateDoctorProfileRequestSchema,
  VerifyDoctorRequestSchema,
  pageSchema,
  type GeoPoint,
  type LatLng,
} from '@doqto/shared';
import { delay, http } from 'msw';
import { z } from 'zod';
import * as db from './db';
import { apiError, ok, parseBody, unauthenticated, url } from './respond';

const toPoint = (p: LatLng): GeoPoint => ({ type: 'Point', coordinates: [p.lng, p.lat] });

function requireUser() {
  const user = db.sessionUser();
  return user ? { error: undefined, user } : { error: unauthenticated() };
}

function requireDoctor() {
  const auth = requireUser();
  if (auth.error) return auth;
  const doctor = db.doctorByUser(auth.user.id);
  return doctor
    ? { error: undefined, user: auth.user, doctor }
    : { error: apiError(404, 'NOT_FOUND', 'No doctor profile for this account') };
}

/** Checks a multipart `file` like the API does (type and size). */
async function readFile(request: Request, types: readonly string[], maxBytes: number) {
  const form = await request.formData();
  const entry = form.get('file');
  // Duck-typed: under Vitest the request's File comes from Node, not from jsdom's Blob.
  if (entry === null || typeof entry === 'string')
    return { error: apiError(400, 'VALIDATION_FAILED', 'Attach a file') };
  const file = entry as File;
  if (!types.includes(file.type) || file.size > maxBytes || file.size === 0) {
    return {
      error: apiError(400, 'VALIDATION_FAILED', 'Unsupported file', {
        issues: [
          { path: 'file', message: `Allowed: ${types.join(', ')}, up to ${maxBytes} bytes` },
        ],
      }),
    };
  }
  return { file, url: await mockFileUrl(file) };
}

/**
 * Small files become data URLs so they survive a reload (the mock store is in localStorage);
 * bigger ones get an object URL that lasts until the tab closes.
 */
async function mockFileUrl(file: File): Promise<string> {
  if (file.size <= 150_000) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `data:${file.type};base64,${btoa(binary)}`;
  }
  if (typeof URL.createObjectURL === 'function') return URL.createObjectURL(file);
  return `https://mock-storage.doqto.test/${encodeURIComponent(file.name)}`;
}

function clinicForManager(id: string, userId: string) {
  const clinic = db.clinicById(id);
  if (!clinic) return { error: apiError(404, 'NOT_FOUND', 'Clinic not found') };
  if (!db.canManageClinic(clinic, userId))
    return { error: apiError(403, 'FORBIDDEN', 'Not your clinic') };
  return { clinic };
}

const requireAdmin = () => {
  const auth = requireUser();
  if (auth.error) return auth;
  return auth.user.roles.includes('admin')
    ? auth
    : { error: apiError(403, 'FORBIDDEN', 'Admins only') };
};

/** Offset cursors are enough for mocks; the real API's cursors are opaque too. */
function paginate<T>(items: T[], cursor: string | null, limit: number) {
  const start = cursor ? Number(cursor) || 0 : 0;
  const page = items.slice(start, start + limit);
  return { items: page, nextCursor: start + limit < items.length ? String(start + limit) : null };
}

/** Same rule as the API: case, spacing and a leading "Dr" do not count as a rename. */
function comparableName(name: string) {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^\s*dr\.?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mock stand-in for the API's review fingerprint: changes when anything the admin checks changes. */
function reviewToken(d: db.MockDoctor): string {
  const input = JSON.stringify([d.name, d.registration, d.documentUrl, d.verification.status]);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    a = Math.imul(a ^ input.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ input.charCodeAt(i), 0x5bd1e995) >>> 0;
  }
  return `rt_${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

export const handlersV1 = [
  /* ---------- Doctor self-service (FE-05) ---------- */
  http.get(url(ENDPOINTS.doctor.profile), () => {
    const auth = requireDoctor();
    if (auth.error) return auth.error;
    return ok(DoctorPrivateProfileSchema, db.toPrivateProfile(auth.doctor));
  }),

  http.post(url(ENDPOINTS.doctor.onboarding), async ({ request }) => {
    const auth = requireUser();
    if (auth.error) return auth.error;
    const body = await parseBody(request, DoctorOnboardingRequestSchema);
    if (body.error) return body.error;
    await delay(400);
    // Checked after the delay, right before the write, like the API's unique `userId` index.
    if (db.doctorByUser(auth.user.id)) return apiError(409, 'CONFLICT', 'Already onboarded');
    const now = new Date().toISOString();
    const doctor: db.MockDoctor = {
      id: db.objectIdForMocks(),
      userId: auth.user.id,
      phone: auth.user.phone,
      slug: db.slugFor(body.data.name, null),
      name: body.data.name,
      gender: body.data.gender ?? null,
      photoUrl: null,
      bio: null,
      languages: body.data.languages ?? [],
      qualifications: body.data.qualifications,
      specialties: body.data.specialties,
      experienceYears: body.data.experienceYears ?? null,
      registration: body.data.registration,
      documentUploaded: false,
      documentUrl: null,
      verification: { status: 'pending', notes: null, verifiedAt: null },
      consultFee: null,
      bookingFee: null,
      createdAt: now,
      updatedAt: now,
    };
    db.putDoctor(doctor);
    db.addRole(auth.user.id, 'doctor');
    return ok(DoctorPrivateProfileSchema, db.toPrivateProfile(doctor), 201);
  }),

  http.patch(url(ENDPOINTS.doctor.profile), async ({ request }) => {
    const auth = requireDoctor();
    if (auth.error) return auth.error;
    const body = await parseBody(request, UpdateDoctorProfileRequestSchema);
    if (body.error) return body.error;
    await delay(300);
    const { registration, ...rest } = body.data;
    const next: db.MockDoctor = { ...auth.doctor };
    for (const [key, value] of Object.entries(rest)) {
      (next as Record<string, unknown>)[key] = value;
    }
    if (rest.name !== undefined && comparableName(rest.name) !== comparableName(auth.doctor.name)) {
      // A real rename needs review again (BE-07): the admin checked the registration against it.
      next.verification = { status: 'pending', notes: null, verifiedAt: null };
    }
    if (registration) {
      next.registration = registration;
      // Changing the registration sends the profile back to review (CONTRACT.md).
      next.verification = { status: 'pending', notes: null, verifiedAt: null };
    }
    db.putDoctor(next);
    return ok(DoctorPrivateProfileSchema, db.toPrivateProfile(next));
  }),

  http.put(url(ENDPOINTS.doctor.registrationDocument), async ({ request }) => {
    const auth = requireDoctor();
    if (auth.error) return auth.error;
    const upload = await readFile(request, REGISTRATION_DOC_TYPES, REGISTRATION_DOC_MAX_BYTES);
    if (upload.error) return upload.error;
    await delay(600);
    db.putDoctor({
      ...auth.doctor,
      documentUploaded: true,
      documentUrl: upload.url,
      verification: { status: 'pending', notes: null, verifiedAt: null },
    });
    return ok(RegistrationDocumentResponseSchema, {
      uploadedAt: new Date().toISOString(),
      contentType: upload.file.type as (typeof REGISTRATION_DOC_TYPES)[number],
      sizeBytes: upload.file.size,
    });
  }),

  http.put(url(ENDPOINTS.doctor.photo), async ({ request }) => {
    const auth = requireDoctor();
    if (auth.error) return auth.error;
    const upload = await readFile(request, PHOTO_TYPES, PHOTO_MAX_BYTES);
    if (upload.error) return upload.error;
    await delay(400);
    const next = { ...auth.doctor, photoUrl: upload.url };
    db.putDoctor(next);
    return ok(DoctorPrivateProfileSchema, db.toPrivateProfile(next));
  }),

  /* ---------- Clinics (FE-06) ---------- */
  http.get(url(ENDPOINTS.clinics.mine), () => {
    const auth = requireUser();
    if (auth.error) return auth.error;
    const items = db.clinicsForUser(auth.user.id).map((c) => db.toPrivateClinic(c, auth.user.id));
    return ok(z.object({ items: z.array(ClinicPrivateSchema) }), { items });
  }),

  http.post(url(ENDPOINTS.clinics.create), async ({ request }) => {
    const auth = requireDoctor();
    if (auth.error) return auth.error;
    const body = await parseBody(request, CreateClinicRequestSchema);
    if (body.error) return body.error;
    await delay(400);
    const clinic: db.MockClinic = {
      id: db.objectIdForMocks(),
      name: body.data.name,
      phone: body.data.phone ?? null,
      address: body.data.address,
      location: body.data.location ? toPoint(body.data.location) : null,
      photoUrls: [],
      ownerUserId: auth.user.id,
      doctorIds: [auth.doctor.id],
      staffUserIds: [],
      createdAt: new Date().toISOString(),
    };
    db.putClinic(clinic);
    // Slug follows the first clinic's city until the doctor is listed.
    if (auth.doctor.verification.status !== 'verified') {
      db.putDoctor({ ...auth.doctor, slug: db.slugFor(auth.doctor.name, clinic.address.city) });
    }
    return ok(ClinicPrivateSchema, db.toPrivateClinic(clinic, auth.user.id), 201);
  }),

  http.get(url('/clinics/:id'), ({ params }) => {
    const auth = requireUser();
    if (auth.error) return auth.error;
    const clinic = db.clinicById(String(params.id));
    if (!clinic) return apiError(404, 'NOT_FOUND', 'Clinic not found');
    if (!db.clinicsForUser(auth.user.id).some((c) => c.id === clinic.id)) {
      return apiError(403, 'FORBIDDEN', 'Not your clinic');
    }
    return ok(ClinicPrivateSchema, db.toPrivateClinic(clinic, auth.user.id));
  }),

  http.patch(url('/clinics/:id'), async ({ request, params }) => {
    const auth = requireUser();
    if (auth.error) return auth.error;
    const found = clinicForManager(String(params.id), auth.user.id);
    if (found.error) return found.error;
    const body = await parseBody(request, UpdateClinicRequestSchema);
    if (body.error) return body.error;
    await delay(300);
    const { location, ...rest } = body.data;
    const next: db.MockClinic = { ...found.clinic };
    if (rest.name !== undefined) next.name = rest.name;
    if (rest.phone !== undefined) next.phone = rest.phone;
    if (rest.address !== undefined) next.address = rest.address;
    if (location !== undefined) next.location = location ? toPoint(location) : null;
    db.putClinic(next);
    return ok(ClinicPrivateSchema, db.toPrivateClinic(next, auth.user.id));
  }),

  http.post(url('/clinics/:id/photos'), async ({ request, params }) => {
    const auth = requireUser();
    if (auth.error) return auth.error;
    const found = clinicForManager(String(params.id), auth.user.id);
    if (found.error) return found.error;
    if (found.clinic.photoUrls.length >= 6) return apiError(409, 'CONFLICT', 'Photo limit reached');
    const upload = await readFile(request, PHOTO_TYPES, PHOTO_MAX_BYTES);
    if (upload.error) return upload.error;
    await delay(400);
    const next = { ...found.clinic, photoUrls: [...found.clinic.photoUrls, upload.url] };
    db.putClinic(next);
    return ok(ClinicPrivateSchema, db.toPrivateClinic(next, auth.user.id));
  }),

  http.delete(url('/clinics/:id/photos/:index'), ({ params }) => {
    const auth = requireUser();
    if (auth.error) return auth.error;
    const found = clinicForManager(String(params.id), auth.user.id);
    if (found.error) return found.error;
    const index = Number(params.index);
    if (!(index >= 0 && index < found.clinic.photoUrls.length))
      return apiError(404, 'NOT_FOUND', 'No such photo');
    const next = {
      ...found.clinic,
      photoUrls: found.clinic.photoUrls.filter((_, i) => i !== index),
    };
    db.putClinic(next);
    return ok(ClinicPrivateSchema, db.toPrivateClinic(next, auth.user.id));
  }),

  http.post(url('/clinics/:id/staff'), async ({ request, params }) => {
    const auth = requireUser();
    if (auth.error) return auth.error;
    const found = clinicForManager(String(params.id), auth.user.id);
    if (found.error) return found.error;
    const body = await parseBody(request, AddStaffRequestSchema);
    if (body.error) return body.error;
    await delay(300);
    const staff = db.staffUser(body.data.phone, body.data.name);
    if (found.clinic.staffUserIds.includes(staff.id))
      return apiError(409, 'CONFLICT', 'Already staff');
    const next = { ...found.clinic, staffUserIds: [...found.clinic.staffUserIds, staff.id] };
    db.putClinic(next);
    return ok(ClinicPrivateSchema, db.toPrivateClinic(next, auth.user.id));
  }),

  http.delete(url('/clinics/:id/staff/:userId'), ({ params }) => {
    const auth = requireUser();
    if (auth.error) return auth.error;
    const found = clinicForManager(String(params.id), auth.user.id);
    if (found.error) return found.error;
    const userId = String(params.userId);
    if (!found.clinic.staffUserIds.includes(userId)) return apiError(404, 'NOT_FOUND', 'Not staff');
    const next = {
      ...found.clinic,
      staffUserIds: found.clinic.staffUserIds.filter((u) => u !== userId),
    };
    db.putClinic(next);
    return ok(ClinicPrivateSchema, db.toPrivateClinic(next, auth.user.id));
  }),

  http.get(url(ENDPOINTS.geo.geocode), async ({ request }) => {
    const auth = requireUser();
    if (auth.error) return auth.error;
    const city = new URL(request.url).searchParams.get('city')?.toLowerCase();
    await delay(300);
    const known: Record<string, { lat: number; lng: number }> = {
      bareilly: { lat: 28.367, lng: 79.4304 },
      lucknow: { lat: 26.8467, lng: 80.9462 },
      kanpur: { lat: 26.4499, lng: 80.3319 },
    };
    const hit = city ? known[city] : undefined;
    return ok(GeocodeResponseSchema, {
      items: hit
        ? [
            {
              ...hit,
              label: `${city?.replace(/^./, (c) => c.toUpperCase())} (city centre)`,
              precision: 'approximate',
            },
          ]
        : [],
    });
  }),

  /* ---------- Admin verification (FE-07) ---------- */
  http.get(url(ENDPOINTS.admin.doctors), ({ request }) => {
    const auth = requireAdmin();
    if (auth.error) return auth.error;
    const q = new URL(request.url).searchParams;
    const page = paginate(
      db.adminQueue(q.get('status') ?? 'pending'),
      q.get('cursor'),
      Number(q.get('limit')) || 20,
    );
    return ok(pageSchema(AdminDoctorQueueItemSchema), page);
  }),

  http.get(url('/admin/doctors/:id'), ({ params }) => {
    const auth = requireAdmin();
    if (auth.error) return auth.error;
    const doctor = db.doctorById(String(params.id));
    if (!doctor) return apiError(404, 'NOT_FOUND', 'Doctor not found');
    return ok(AdminDoctorDetailSchema, {
      doctor: db.toPrivateProfile(doctor),
      phone: doctor.phone,
      reviewToken: reviewToken(doctor),
      documentUrl: doctor.documentUrl,
      documentUrlExpiresAt: doctor.documentUrl
        ? new Date(Date.now() + 5 * 60_000).toISOString()
        : null,
    });
  }),

  http.post(url('/admin/doctors/:id/verify'), async ({ request, params }) => {
    const auth = requireAdmin();
    if (auth.error) return auth.error;
    const doctor = db.doctorById(String(params.id));
    if (!doctor) return apiError(404, 'NOT_FOUND', 'Doctor not found');
    const body = await parseBody(request, VerifyDoctorRequestSchema);
    if (body.error) return body.error;
    if (body.data.reviewToken !== reviewToken(doctor) || doctor.verification.status !== 'pending') {
      return apiError(409, 'CONFLICT', 'The profile changed since you opened it');
    }
    if (body.data.decision === 'approve' && !doctor.documentUploaded) {
      return apiError(409, 'CONFLICT', 'No registration document uploaded');
    }
    await delay(300);
    const next: db.MockDoctor = {
      ...doctor,
      verification:
        body.data.decision === 'approve'
          ? {
              status: 'verified',
              notes: body.data.notes ?? null,
              verifiedAt: new Date().toISOString(),
            }
          : { status: 'rejected', notes: body.data.notes ?? null, verifiedAt: null },
    };
    db.putDoctor(next);
    return ok(DoctorPrivateProfileSchema, db.toPrivateProfile(next));
  }),

  /* ---------- Public search and profile (FE-08, FE-09) ---------- */
  http.get(url(ENDPOINTS.doctors.search), async ({ request }) => {
    const q = new URL(request.url).searchParams;
    const city = q.get('city') ?? undefined;
    const nearRaw = q.get('near');
    if (!city && !nearRaw) {
      return apiError(400, 'VALIDATION_FAILED', 'Provide city or near', {
        issues: [{ path: 'city', message: 'Provide city or near' }],
      });
    }
    const [lat, lng] = (nearRaw ?? '').split(',').map(Number);
    const near =
      nearRaw && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat: lat as number, lng: lng as number }
        : undefined;
    await delay(300);
    const all = db.searchListed({
      city,
      near,
      specialty: q.get('specialty') ?? undefined,
      q: q.get('q') ?? undefined,
      radiusKm: Number(q.get('radiusKm')) || 25,
    });
    return ok(
      pageSchema(DoctorListItemSchema),
      paginate(all, q.get('cursor'), Number(q.get('limit')) || 20),
    );
  }),

  http.get(url('/doctors/:slug'), ({ params }) => {
    const profile = db.mockPublicProfile(String(params.slug));
    return profile
      ? ok(DoctorProfileSchema, profile)
      : apiError(404, 'NOT_FOUND', 'Doctor not found');
  }),
];
