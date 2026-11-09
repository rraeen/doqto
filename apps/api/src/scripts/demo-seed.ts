/**
 * BE-11 demo seed: 3 clinics, 5 verified and listed doctors with weekly schedules, clinic staff
 * and (when DEMO_ADMIN_PHONE is set) one admin, all `isDemo: true`. Idempotent (upserts by
 * phone, clinic name and the unique `{ doctorId, clinicId }` schedule key). Refuses to run unless
 * PROVIDER_MODE is demo and the database name starts with `doqto_demo` (TDD 13), checked before
 * the app boots and again on the live connection.
 *
 *   PROVIDER_MODE=demo MONGODB_DB_NAME=doqto_demo pnpm --filter @doqto/api seed:demo
 *
 * Every seeded account logs in with the demo OTP 123456. The +91 90000 0xxxx phones are demo-only
 * placeholders that may belong to real people, so seeded users are not opted in to WhatsApp.
 * The admin phone is never in the source: anyone who knew it could read uploaded scans.
 */
import { PhoneSchema, type SpecialtyKey } from '@doqto/shared';
import type { Model, Types } from 'mongoose';
import { Clinic } from '../clinics/clinic.schema';
import { Doctor } from '../doctors/doctor.schema';
import { computeIsListed } from '../doctors/listing';
import { baseSlug, uniqueSlug } from '../doctors/slug';
import { databaseNameFromUri, DEMO_DB_PREFIX, toGeoJsonPoint } from '../integrations';
import { ScheduleEntity } from '../schedules/schedule.schema';
import { User } from '../users/user.schema';

interface SeedDoctor {
  phone: string;
  name: string;
  gender: 'female' | 'male';
  specialties: readonly SpecialtyKey[];
  degree: string;
  years: number;
  consultFee: number;
  clinic: string;
  languages: readonly string[];
}

const EXTRA_FIRST = [
  'Aarav',
  'Neha',
  'Imran',
  'Pooja',
  'Sandeep',
  'Ritu',
  'Mohit',
  'Kavita',
  'Arjun',
  'Seema',
];
const EXTRA_LAST = ['Verma', 'Singh', 'Agarwal', 'Saxena', 'Ansari'];
const EXTRA_SPECIALTIES: [SpecialtyKey, string][] = [
  ['general_physician', 'MBBS, MD (Medicine)'],
  ['paediatrics', 'MBBS, DCH'],
  ['dermatology', 'MBBS, MD (Dermatology)'],
  ['orthopaedics', 'MBBS, MS (Ortho)'],
  ['gynaecology', 'MBBS, MS (Obs & Gyn)'],
  ['ent', 'MBBS, MS (ENT)'],
  ['dentistry', 'BDS, MDS'],
];
const EXTRA_CLINICS = ['bareilly-civil-lines', 'bareilly-rajendra-nagar', 'moradabad-civil-lines'];

/** 20 more demo doctors (so search has something to page through), spread over the 3 clinics. */
export const EXTRA_DOCTORS: SeedDoctor[] = Array.from({ length: 20 }, (_, i) => {
  const [specialty, degree] = EXTRA_SPECIALTIES[i % EXTRA_SPECIALTIES.length]!;
  return {
    phone: `+9190000000${16 + i}`,
    name: `${EXTRA_FIRST[i % EXTRA_FIRST.length]} ${EXTRA_LAST[Math.floor(i / 2) % EXTRA_LAST.length]}`,
    gender: i % 2 === 0 ? 'female' : 'male',
    specialties: [specialty],
    degree,
    years: 5 + ((i * 3) % 20),
    consultFee: 20000 + (i % 6) * 5000,
    clinic: EXTRA_CLINICS[i % EXTRA_CLINICS.length]!,
    languages: ['Hindi', 'English'],
  };
});

export const SEED = {
  adminName: 'Doqto Admin',
  /** Mon to Sat, 10:00 to 13:00 and 17:00 to 20:00 in 10-minute slots. */
  weekly: [1, 2, 3, 4, 5, 6].flatMap((day) => [
    { day, start: '10:00', end: '13:00', slotMinutes: 10, capacityPerSlot: 1 },
    { day, start: '17:00', end: '20:00', slotMinutes: 10, capacityPerSlot: 1 },
  ]),
  clinics: [
    {
      key: 'bareilly-civil-lines',
      name: 'Sharma Family Clinic',
      phone: '+919000000101',
      address: {
        line1: '14 Station Road',
        area: 'Civil Lines',
        city: 'Bareilly',
        district: 'Bareilly',
        state: 'Uttar Pradesh',
        pincode: '243001',
      },
      location: { lat: 28.3594, lng: 79.4237 },
      staff: { phone: '+919000000201', name: 'Pooja (front desk)' },
    },
    {
      key: 'bareilly-rajendra-nagar',
      name: 'Shifa Child Care',
      phone: '+919000000102',
      address: {
        line1: '22 Rajendra Nagar Main Road',
        area: 'Rajendra Nagar',
        city: 'Bareilly',
        district: 'Bareilly',
        state: 'Uttar Pradesh',
        pincode: '243122',
      },
      location: { lat: 28.3796, lng: 79.4419 },
      staff: { phone: '+919000000202', name: 'Imran (front desk)' },
    },
    {
      key: 'moradabad-civil-lines',
      name: 'Gupta Eye and Dental Centre',
      phone: '+919000000103',
      address: {
        line1: '5 Kanth Road',
        area: 'Civil Lines',
        city: 'Moradabad',
        district: 'Moradabad',
        state: 'Uttar Pradesh',
        pincode: '244001',
      },
      location: { lat: 28.8386, lng: 78.7733 },
      staff: { phone: '+919000000203', name: 'Neha (front desk)' },
    },
  ],
  doctors: [
    {
      phone: '+919000000011',
      name: 'Anita Sharma',
      gender: 'female',
      specialties: ['general_physician'],
      degree: 'MBBS, MD (Medicine)',
      years: 14,
      consultFee: 30000,
      clinic: 'bareilly-civil-lines',
      languages: ['Hindi', 'English'],
    },
    {
      phone: '+919000000012',
      name: 'Rakesh Sharma',
      gender: 'male',
      specialties: ['orthopaedics'],
      degree: 'MBBS, MS (Ortho)',
      years: 20,
      consultFee: 50000,
      clinic: 'bareilly-civil-lines',
      languages: ['Hindi', 'English'],
    },
    {
      phone: '+919000000013',
      name: 'Sana Qureshi',
      gender: 'female',
      specialties: ['paediatrics'],
      degree: 'MBBS, DCH',
      years: 9,
      consultFee: 40000,
      clinic: 'bareilly-rajendra-nagar',
      languages: ['Hindi', 'Urdu', 'English'],
    },
    {
      phone: '+919000000014',
      name: 'Vivek Gupta',
      gender: 'male',
      specialties: ['ophthalmology'],
      degree: 'MBBS, MS (Ophthalmology)',
      years: 12,
      consultFee: 40000,
      clinic: 'moradabad-civil-lines',
      languages: ['Hindi', 'English'],
    },
    {
      phone: '+919000000015',
      name: 'Meera Gupta',
      gender: 'female',
      specialties: ['dentistry'],
      degree: 'BDS, MDS',
      years: 8,
      consultFee: 30000,
      clinic: 'moradabad-civil-lines',
      languages: ['Hindi', 'English'],
    },
  ],
} as const;

export interface SeedModels {
  users: Model<User>;
  doctors: Model<Doctor>;
  clinics: Model<Clinic>;
  schedules: Model<ScheduleEntity>;
}

export interface SeedTarget {
  mode: string | undefined;
  dbName: string | undefined;
  uri?: string;
}

/** The seed only ever writes to a demo database in demo mode. */
export function assertSeedTarget(t: SeedTarget): void {
  const problems: string[] = [];
  if (t.mode !== 'demo') problems.push(`PROVIDER_MODE must be demo (got "${t.mode ?? ''}")`);
  if (!t.dbName?.startsWith(DEMO_DB_PREFIX)) {
    problems.push(`MONGODB_DB_NAME must start with ${DEMO_DB_PREFIX} (got "${t.dbName ?? ''}")`);
  }
  const uriDb = t.uri ? databaseNameFromUri(t.uri) : undefined;
  if (uriDb !== undefined && !uriDb.startsWith(DEMO_DB_PREFIX)) {
    problems.push(`MONGODB_URI points at database "${uriDb}"`);
  }
  if (problems.length) throw new Error(`Refusing to seed:\n  - ${problems.join('\n  - ')}`);
}

export async function seedDemo(
  models: SeedModels,
  options: { adminPhone?: string; mode: string | undefined; withExtras?: boolean },
): Promise<{ doctors: number; clinics: number; admin: boolean }> {
  const { users, doctors, clinics, schedules } = models;
  // Again on the real connection, so every caller is covered (not just the CLI).
  assertSeedTarget({ mode: options.mode, dbName: users.db.name });
  const adminPhone = options.adminPhone ? PhoneSchema.parse(options.adminPhone) : undefined;
  const now = new Date();
  const upsertUser = async (phone: string, name: string, roles: string[]) =>
    (await users
      .findOneAndUpdate(
        { phone },
        {
          $addToSet: { roles: { $each: roles } },
          $setOnInsert: {
            phone,
            name,
            phoneVerifiedAt: now,
            language: 'hi',
            whatsappOptIn: false,
            status: 'active',
          },
          $set: { isDemo: true },
        },
        { upsert: true, new: true },
      )
      .exec())!;

  const admin = adminPhone ? await upsertUser(adminPhone, SEED.adminName, ['admin']) : null;
  // The core five are what the e2e tests expect; the CLI adds the extra doctors for paging demos.
  const seedDoctors: readonly SeedDoctor[] = [
    ...SEED.doctors,
    ...(options.withExtras ? EXTRA_DOCTORS : []),
  ];
  const doctorUsers = new Map<string, Awaited<ReturnType<typeof upsertUser>>>();
  for (const d of seedDoctors)
    doctorUsers.set(d.phone, await upsertUser(d.phone, `Dr ${d.name}`, ['doctor']));

  const clinicByKey = new Map<string, Clinic & { _id: Types.ObjectId }>();
  for (const c of SEED.clinics) {
    // The first seeded doctor at each clinic owns it, as in the real flow (not the admin).
    const owner = doctorUsers.get(SEED.doctors.find((d) => d.clinic === c.key)!.phone)!;
    const doc = (await clinics
      .findOneAndUpdate(
        { name: c.name, 'address.city': c.address.city, isDemo: true },
        {
          $set: {
            ownerUserId: owner._id,
            phone: c.phone,
            address: c.address,
            location: toGeoJsonPoint(c.location),
            timezone: 'Asia/Kolkata',
            isDemo: true,
          },
          $setOnInsert: { photos: [], doctorIds: [], staffUserIds: [], staffLog: [] },
        },
        { upsert: true, new: true },
      )
      .exec())!;
    clinicByKey.set(c.key, doc);
    const staff = await upsertUser(c.staff.phone, c.staff.name, ['clinic_staff']);
    await users.updateOne({ _id: staff._id }, { $addToSet: { clinicIds: doc._id } }).exec();
    await clinics
      .updateOne(
        { _id: doc._id, staffUserIds: { $ne: staff._id } },
        {
          $addToSet: { staffUserIds: staff._id },
          $push: { staffLog: { userId: staff._id, addedAt: now, addedBy: owner._id } },
        },
      )
      .exec();
  }

  for (const d of seedDoctors) {
    const clinic = clinicByKey.get(d.clinic)!;
    const user = doctorUsers.get(d.phone)!;
    const existing = await doctors
      .findOne({ userId: user._id }, { _id: 1, slug: 1, slugLocked: 1 })
      .exec();
    // One slug rule (doctors/slug.ts); a slug someone else already holds gets a suffix.
    const slug = existing?.slugLocked
      ? existing.slug
      : await uniqueSlug(
          baseSlug(`Dr ${d.name}`, clinic.address.city),
          async (s) =>
            (await doctors
              .exists({ slug: s, ...(existing ? { _id: { $ne: existing._id } } : {}) })
              .exec()) !== null,
        );
    const fields = {
      userId: user._id,
      slug,
      name: `Dr ${d.name}`,
      gender: d.gender,
      bio: `${d.years} years of practice in ${clinic.address.city}.`,
      languages: [...d.languages],
      qualifications: [{ degree: d.degree }],
      specialties: [...d.specialties],
      experienceYears: d.years,
      registration: {
        council: 'Uttar Pradesh Medical Council',
        number: `DEMO-${d.phone.slice(-4)}`,
        year: 2026 - d.years,
        // Demo placeholder: there is no real scan behind this key (the admin link 404s).
        docKey: `demo/registration-${d.phone.slice(-4)}.pdf`,
        docContentType: 'application/pdf',
        docSizeBytes: 1,
        docUploadedAt: now,
      },
      verification: {
        status: 'verified' as const,
        ...(admin ? { verifiedBy: admin._id } : {}),
        verifiedAt: now,
        submittedAt: now,
      },
      clinicIds: [clinic._id],
      consultFee: d.consultFee,
      bookingFee: 1500,
      city: clinic.address.city.toLowerCase(),
      isDemo: true,
    };
    const isListed = computeIsListed(fields);
    const doc = (await doctors
      .findOneAndUpdate(
        { userId: user._id },
        { $set: { ...fields, isListed, slugLocked: isListed } },
        { upsert: true, new: true },
      )
      .exec())!;
    await clinics.updateOne({ _id: clinic._id }, { $addToSet: { doctorIds: doc._id } }).exec();
    await schedules
      .updateOne(
        { doctorId: doc._id, clinicId: clinic._id },
        {
          $set: { weekly: SEED.weekly, isActive: true },
          $setOnInsert: { exceptions: [], bookingWindowDays: 7, walkInShare: 0.3 },
        },
        { upsert: true },
      )
      .exec();
  }
  return { doctors: seedDoctors.length, clinics: SEED.clinics.length, admin: admin !== null };
}
