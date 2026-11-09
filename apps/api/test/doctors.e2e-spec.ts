import {
  AdminDoctorDetailSchema,
  ApiErrorSchema,
  ClinicPrivateSchema,
  DoctorListItemSchema,
  DoctorPrivateProfileSchema,
  DoctorProfileSchema,
  pageSchema,
  AdminDoctorQueueItemSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { type Connection, Types } from 'mongoose';
import request from 'supertest';
import { Clinic } from '../src/clinics/clinic.schema';
import { Doctor } from '../src/doctors/doctor.schema';
import { SEED, seedDemo } from '../src/scripts/demo-seed';
import { ScheduleEntity } from '../src/schedules/schedule.schema';
import { User } from '../src/users/user.schema';
import { createTestApp } from './app';
import { login, nextPhone, PDF, PNG, type Session } from './helpers';

const onboarding = (name: string, specialty = 'general_physician') => ({
  name,
  qualifications: [{ degree: 'MBBS', institute: 'KGMU', year: 2010 }],
  specialties: [specialty],
  experienceYears: 12,
  registration: {
    council: 'Uttar Pradesh Medical Council',
    number: `UPMC-${name.length}`,
    year: 2011,
  },
});
const address = (city: string) => ({
  line1: '12 Station Road',
  area: 'Civil Lines',
  city,
  state: 'Uttar Pradesh',
  pincode: '243001',
});
const code = (body: unknown) => ApiErrorSchema.parse(body).error.code;

describe('doctors, clinics, admin verification and search (sprint 2)', () => {
  let app: INestApplication;
  let db: Connection;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
  });
  afterAll(async () => {
    await db.dropDatabase();
    await app.close();
  });

  async function makeAdmin(): Promise<Session> {
    const phone = nextPhone('96');
    await login(app, phone);
    await db.collection('users').updateOne({ phone }, { $addToSet: { roles: 'admin' } });
    return login(app, phone); // fresh token carries the admin role
  }

  /** Onboarded doctor with a clinic, document and booking fee: everything except verification. */
  async function readyDoctor(
    name: string,
    city: string,
    specialty?: string,
    location = { lat: 28.36, lng: 79.42 },
  ) {
    const s = await login(app);
    await http()
      .post('/api/v1/doctor/onboarding')
      .set('Authorization', s.auth)
      .send(onboarding(name, specialty))
      .expect(201);
    await http()
      .patch('/api/v1/doctor/profile')
      .set('Authorization', s.auth)
      .send({ bookingFee: 1500 })
      .expect(200);
    await http()
      .put('/api/v1/doctor/registration-document')
      .set('Authorization', s.auth)
      .attach('file', PDF, 'reg.pdf')
      .expect(200);
    const clinic = await http()
      .post('/api/v1/clinics')
      .set('Authorization', s.auth)
      .send({ name: `${name} Clinic`, address: address(city), location })
      .expect(201);
    const profile = await http()
      .get('/api/v1/doctor/profile')
      .set('Authorization', s.auth)
      .expect(200);
    return {
      session: s,
      clinic: ClinicPrivateSchema.parse(clinic.body),
      profile: DoctorPrivateProfileSchema.parse(profile.body),
    };
  }

  describe('onboarding and profile (BE-07)', () => {
    it('creates a pending draft, adds role doctor and lists what is missing', async () => {
      const s = await login(app);
      const res = await http()
        .post('/api/v1/doctor/onboarding')
        .set('Authorization', s.auth)
        .send(onboarding('Dr. Anita Sharma'))
        .expect(201);
      const p = DoctorPrivateProfileSchema.parse(res.body);
      expect(p).toMatchObject({
        slug: 'dr-anita-sharma',
        isListed: false,
        verification: { status: 'pending' },
      });
      expect(p.missing).toEqual(['registration_document', 'clinic', 'booking_fee']);
      const user = await db.collection('users').findOne({ phone: s.user.phone });
      expect(user?.roles).toEqual(expect.arrayContaining(['patient', 'doctor']));
      const again = await http()
        .post('/api/v1/doctor/onboarding')
        .set('Authorization', s.auth)
        .send(onboarding('X Y'))
        .expect(409);
      expect(code(again.body)).toBe('CONFLICT');
    });

    it('rejects trust fields and unknown fields on PATCH', async () => {
      const s = await login(app);
      await http()
        .post('/api/v1/doctor/onboarding')
        .set('Authorization', s.auth)
        .send(onboarding('Ravi Kumar'))
        .expect(201);
      for (const body of [
        { ratingSummary: { count: 99 } },
        { verification: { status: 'verified' } },
        { isListed: true },
        { slug: 'dr-best' },
        { bookingFee: 99_999 },
        { specialties: ['astrology'] },
        // null for a required field is a 400, never a 500 or a stored null (RD BE-07 should-fix 1).
        { specialties: null },
        { qualifications: null },
        { name: null },
        { registration: null },
        { languages: null },
      ]) {
        const res = await http()
          .patch('/api/v1/doctor/profile')
          .set('Authorization', s.auth)
          .send(body)
          .expect(400);
        expect(code(res.body)).toBe('VALIDATION_FAILED');
      }
      const ok = await http()
        .patch('/api/v1/doctor/profile')
        .set('Authorization', s.auth)
        .send({ bio: 'Family doctor', consultFee: 30000 })
        .expect(200);
      expect(ok.body).toMatchObject({ bio: 'Family doctor', consultFee: 30000, isListed: false });
    });

    it('a doctor only ever edits their own profile', async () => {
      const a = await readyDoctor('Asha Rani', 'Agra');
      const b = await login(app);
      await http()
        .post('/api/v1/doctor/onboarding')
        .set('Authorization', b.auth)
        .send(onboarding('Bina Devi'))
        .expect(201);
      await http()
        .patch('/api/v1/doctor/profile')
        .set('Authorization', b.auth)
        .send({ bio: 'Changed by B' })
        .expect(200);
      const aProfile = await http()
        .get('/api/v1/doctor/profile')
        .set('Authorization', a.session.auth)
        .expect(200);
      expect(aProfile.body.bio).toBeNull();
      // A non-doctor has no profile at all.
      const patient = await login(app);
      await http().get('/api/v1/doctor/profile').set('Authorization', patient.auth).expect(404);
    });

    it('stores the registration scan privately and checks file contents', async () => {
      const s = await login(app);
      await http()
        .post('/api/v1/doctor/onboarding')
        .set('Authorization', s.auth)
        .send(onboarding('Kiran Bedi'))
        .expect(201);
      const bad = await http()
        .put('/api/v1/doctor/registration-document')
        .set('Authorization', s.auth)
        .attach('file', Buffer.from('not really a pdf'), {
          filename: 'reg.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
      expect(code(bad.body)).toBe('VALIDATION_FAILED');
      await http()
        .put('/api/v1/doctor/registration-document')
        .set('Authorization', s.auth)
        .expect(400);
      const ok = await http()
        .put('/api/v1/doctor/registration-document')
        .set('Authorization', s.auth)
        .attach('file', PDF, 'reg.pdf')
        .expect(200);
      expect(ok.body).toMatchObject({ contentType: 'application/pdf' });
      const doc = await db
        .collection('doctors')
        .findOne({ userId: (await db.collection('users').findOne({ phone: s.user.phone }))?._id });
      expect(doc?.registration.docKey).toMatch(/^doctors\/[a-f0-9]{24}\/registration-/);
      const photo = await http()
        .put('/api/v1/doctor/photo')
        .set('Authorization', s.auth)
        .attach('file', PNG, 'me.png')
        .expect(200);
      expect(photo.body.photoUrl).toMatch(/^https?:\/\//);
    });
  });

  describe('clinics and staff (BE-08)', () => {
    it('links doctor and clinic both ways, sets city and the city slug', async () => {
      const { clinic, profile } = await readyDoctor('Neha Singh', 'Bareilly');
      expect(profile.clinicIds).toEqual([clinic.id]);
      expect(clinic.doctorIds).toEqual([profile.id]);
      expect(profile.city).toBe('bareilly');
      expect(profile.slug).toBe('dr-neha-singh-bareilly');
      expect(profile.missing).toEqual([]);
      expect(clinic.mapsUrl).toContain('google.com/maps');
      expect(clinic.location?.coordinates).toEqual([79.42, 28.36]);
    });

    it('scopes every clinic route by role', async () => {
      const owner = await readyDoctor('Omkar Nath', 'Mathura');
      const other = await readyDoctor('Prem Lal', 'Mathura');
      const patient = await login(app);
      const id = owner.clinic.id;

      // Owner adds a staff phone; the user is created with role clinic_staff.
      const staffPhone = nextPhone('95');
      const added = await http()
        .post(`/api/v1/clinics/${id}/staff`)
        .set('Authorization', owner.session.auth)
        .send({ phone: staffPhone, name: 'Front Desk' })
        .expect(201);
      expect(ClinicPrivateSchema.parse(added.body).staff.map((s) => s.phone)).toEqual([staffPhone]);
      await http()
        .post(`/api/v1/clinics/${id}/staff`)
        .set('Authorization', owner.session.auth)
        .send({ phone: staffPhone })
        .expect(409);
      const staffUser = await db.collection('users').findOne({ phone: staffPhone });
      expect(staffUser?.roles).toContain('clinic_staff');
      expect(staffUser?.clinicIds.map(String)).toEqual([id]);
      const staff = await login(app, staffPhone);
      // Their own first login, even though the clinic created the account (RD BE-08 should-fix 1).
      expect(staff.isNewUser).toBe(true);
      expect(staff.user.roles).toEqual(expect.arrayContaining(['patient', 'clinic_staff']));
      expect(staff.user.whatsappOptIn).toBe(true);
      const staffRow = await db.collection('users').findOne({ phone: staffPhone });
      expect(staffRow?.consentLog).toHaveLength(1);
      expect(staffRow?.phoneVerifiedAt).toBeInstanceOf(Date);

      // Staff can read but not manage; other doctors and patients get nothing.
      const asStaff = await http()
        .get(`/api/v1/clinics/${id}`)
        .set('Authorization', staff.auth)
        .expect(200);
      expect(asStaff.body.canManage).toBe(false);
      expect(asStaff.body.staff).toEqual([]); // no co-workers' phones for read-only staff
      await http()
        .patch(`/api/v1/clinics/${id}`)
        .set('Authorization', staff.auth)
        .send({ name: 'Hacked' })
        .expect(403);
      await http()
        .get(`/api/v1/clinics/${id}`)
        .set('Authorization', other.session.auth)
        .expect(403);
      await http()
        .patch(`/api/v1/clinics/${id}`)
        .set('Authorization', other.session.auth)
        .send({ name: 'Hacked' })
        .expect(403);
      await http()
        .post(`/api/v1/clinics/${id}/staff`)
        .set('Authorization', other.session.auth)
        .send({ phone: nextPhone() })
        .expect(403);
      await http().get(`/api/v1/clinics/${id}`).set('Authorization', patient.auth).expect(403);
      await http().get(`/api/v1/clinics/${id}`).expect(401);
      await http()
        .get('/api/v1/clinics/000000000000000000000000')
        .set('Authorization', owner.session.auth)
        .expect(404);

      const mine = await http()
        .get('/api/v1/clinics/mine')
        .set('Authorization', staff.auth)
        .expect(200);
      expect(mine.body.items.map((c: { id: string }) => c.id)).toEqual([id]);

      // Patients cannot create clinics (not a doctor).
      await http()
        .post('/api/v1/clinics')
        .set('Authorization', patient.auth)
        .send({ name: 'Mine', address: address('Agra') })
        .expect(404);

      // Owner edits, adds and removes a photo, then removes the staff member.
      const upd = await http()
        .patch(`/api/v1/clinics/${id}`)
        .set('Authorization', owner.session.auth)
        .send({ name: 'Omkar Clinic', location: null })
        .expect(200);
      expect(upd.body).toMatchObject({ name: 'Omkar Clinic', location: null, mapsUrl: null });
      const withPhoto = await http()
        .post(`/api/v1/clinics/${id}/photos`)
        .set('Authorization', owner.session.auth)
        .attach('file', PNG, 'c.png')
        .expect(201);
      expect(withPhoto.body.photoUrls).toHaveLength(1);
      await http()
        .delete(`/api/v1/clinics/${id}/photos/0`)
        .set('Authorization', owner.session.auth)
        .expect(200);
      const removed = await http()
        .delete(`/api/v1/clinics/${id}/staff/${staffUser?._id.toHexString()}`)
        .set('Authorization', owner.session.auth)
        .expect(200);
      expect(removed.body.staff).toEqual([]);
      expect((await db.collection('users').findOne({ phone: staffPhone }))?.roles).toEqual([
        'patient',
      ]);
      await http().get(`/api/v1/clinics/${id}`).set('Authorization', staff.auth).expect(403);
    });

    it('moves the doctor city when the primary clinic address changes', async () => {
      const d = await readyDoctor('Usha Rao', 'Aligarh');
      await http()
        .patch(`/api/v1/clinics/${d.clinic.id}`)
        .set('Authorization', d.session.auth)
        .send({ address: address('Etah') })
        .expect(200);
      const p = await http()
        .get('/api/v1/doctor/profile')
        .set('Authorization', d.session.auth)
        .expect(200);
      expect(p.body).toMatchObject({ city: 'etah', slug: 'dr-usha-rao-etah' });
    });

    it('suggests map pins to doctors and staff only (demo geocoder)', async () => {
      const doctor = await login(app);
      await http()
        .post('/api/v1/doctor/onboarding')
        .set('Authorization', doctor.auth)
        .send(onboarding('Geo Doc'))
        .expect(201);
      const res = await http()
        .get('/api/v1/geo/geocode')
        .query({ city: 'Bareilly' })
        .set('Authorization', doctor.auth)
        .expect(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      const patient = await login(app);
      await http()
        .get('/api/v1/geo/geocode')
        .query({ city: 'Bareilly' })
        .set('Authorization', patient.auth)
        .expect(403);
    });
  });

  describe('admin verification (BE-09)', () => {
    it('queues, shows a signed document link, approves with an audit log, and lists', async () => {
      const admin = await makeAdmin();
      const d = await readyDoctor('Tara Joshi', 'Shahjahanpur', 'dermatology');

      const queue = await http()
        .get('/api/v1/admin/doctors?status=pending&limit=50')
        .set('Authorization', admin.auth)
        .expect(200);
      const items = pageSchema(AdminDoctorQueueItemSchema).parse(queue.body).items;
      expect(items.find((i) => i.id === d.profile.id)).toMatchObject({
        documentUploaded: true,
        city: 'shahjahanpur',
      });

      const detail = AdminDoctorDetailSchema.parse(
        (
          await http()
            .get(`/api/v1/admin/doctors/${d.profile.id}`)
            .set('Authorization', admin.auth)
            .expect(200)
        ).body,
      );
      expect(detail.documentUrl).toMatch(/^https?:\/\//);
      expect(new Date(detail.documentUrlExpiresAt!).getTime() - Date.now()).toBeLessThanOrEqual(
        300_000,
      );

      // Not public before approval.
      await http().get(`/api/v1/doctors/${d.profile.slug}`).expect(404);
      const reject = await http()
        .post(`/api/v1/admin/doctors/${d.profile.id}/verify`)
        .set('Authorization', admin.auth)
        .send({ decision: 'reject', reviewToken: detail.reviewToken })
        .expect(400);
      expect(code(reject.body)).toBe('VALIDATION_FAILED');

      const ok = await http()
        .post(`/api/v1/admin/doctors/${d.profile.id}/verify`)
        .set('Authorization', admin.auth)
        .send({ decision: 'approve', reviewToken: detail.reviewToken })
        .expect(200);
      expect(DoctorPrivateProfileSchema.parse(ok.body)).toMatchObject({
        isListed: true,
        verification: { status: 'verified' },
      });
      const log = await db.collection('auditLogs').findOne({
        entityId: (await db.collection('doctors').findOne({ slug: d.profile.slug }))?._id,
        action: 'doctor.verify.approve',
      });
      // The audit row records exactly what was approved.
      expect(log).toMatchObject({
        entity: 'doctors',
        before: { status: 'pending' },
        after: {
          status: 'verified',
          isListed: true,
          reviewed: {
            name: 'Tara Joshi',
            registration: { number: 'UPMC-10' },
            docKey: expect.stringMatching(/^doctors\//),
          },
        },
      });
      expect(
        await db.collection('auditLogs').countDocuments({ action: 'doctor.document.view' }),
      ).toBeGreaterThan(0);
      // Deciding again is a conflict.
      await http()
        .post(`/api/v1/admin/doctors/${d.profile.id}/verify`)
        .set('Authorization', admin.auth)
        .send({ decision: 'reject', notes: 'Changed my mind', reviewToken: detail.reviewToken })
        .expect(409);

      const pub = await http().get(`/api/v1/doctors/${d.profile.slug}`).expect(200);
      expect(DoctorProfileSchema.parse(pub.body)).toMatchObject({
        verificationStatus: 'verified',
        city: 'Shahjahanpur',
        ratingSummary: null,
      });
      expect(JSON.stringify(pub.body)).not.toContain('UPMC');
      expect(JSON.stringify(pub.body)).not.toContain(d.session.user.phone);

      // Changing the registration number sends it back to review and off the list.
      await http()
        .patch('/api/v1/doctor/profile')
        .set('Authorization', d.session.auth)
        .send({ registration: { council: 'NMC', number: 'NEW-1', year: 2011 } })
        .expect(200);
      await http().get(`/api/v1/doctors/${d.profile.slug}`).expect(404);
    });

    it('records rejections with notes and keeps admin routes admin-only', async () => {
      const admin = await makeAdmin();
      const d = await readyDoctor('Uma Pant', 'Pilibhit');
      const { reviewToken } = (
        await http()
          .get(`/api/v1/admin/doctors/${d.profile.id}`)
          .set('Authorization', admin.auth)
          .expect(200)
      ).body as { reviewToken: string };
      const res = await http()
        .post(`/api/v1/admin/doctors/${d.profile.id}/verify`)
        .set('Authorization', admin.auth)
        .send({
          decision: 'reject',
          notes: 'Registration number not found on the council site',
          reviewToken,
        })
        .expect(200);
      expect(res.body.verification).toMatchObject({
        status: 'rejected',
        notes: 'Registration number not found on the council site',
      });
      expect(
        await db.collection('auditLogs').countDocuments({ action: 'doctor.verify.reject' }),
      ).toBeGreaterThan(0);
      await http().get('/api/v1/admin/doctors').set('Authorization', d.session.auth).expect(403);
      await http()
        .post(`/api/v1/admin/doctors/${d.profile.id}/verify`)
        .set('Authorization', d.session.auth)
        .send({ decision: 'approve', reviewToken })
        .expect(403);
      await http().get('/api/v1/admin/doctors').expect(401);
    });

    it('a verified doctor who changes their name goes back to review', async () => {
      const admin = await makeAdmin();
      const d = await readyDoctor('Xena Paul', 'Hardoi');
      const { reviewToken } = (
        await http()
          .get(`/api/v1/admin/doctors/${d.profile.id}`)
          .set('Authorization', admin.auth)
          .expect(200)
      ).body as { reviewToken: string };
      await http()
        .post(`/api/v1/admin/doctors/${d.profile.id}/verify`)
        .set('Authorization', admin.auth)
        .send({ decision: 'approve', reviewToken })
        .expect(200);
      // Case, spacing and "Dr" are not a rename.
      const same = await http()
        .patch('/api/v1/doctor/profile')
        .set('Authorization', d.session.auth)
        .send({ name: 'Dr.  xena PAUL' })
        .expect(200);
      expect(same.body).toMatchObject({ isListed: true, verification: { status: 'verified' } });
      const renamed = await http()
        .patch('/api/v1/doctor/profile')
        .set('Authorization', d.session.auth)
        .send({ name: 'Devi Prasad Shetty' })
        .expect(200);
      expect(renamed.body).toMatchObject({ isListed: false, verification: { status: 'pending' } });
      await http().get(`/api/v1/doctors/${d.profile.slug}`).expect(404);
    });

    it('refuses a decision on a profile that changed after the admin opened it (P1)', async () => {
      const admin = await makeAdmin();
      const d = await readyDoctor('Vani Rao', 'Budaun');
      const { reviewToken } = (
        await http()
          .get(`/api/v1/admin/doctors/${d.profile.id}`)
          .set('Authorization', admin.auth)
          .expect(200)
      ).body as { reviewToken: string };
      await http()
        .patch('/api/v1/doctor/profile')
        .set('Authorization', d.session.auth)
        .send({ registration: { council: 'UPMC', number: 'SOMEONE-ELSE', year: 2011 } })
        .expect(200);
      const stale = await http()
        .post(`/api/v1/admin/doctors/${d.profile.id}/verify`)
        .set('Authorization', admin.auth)
        .send({ decision: 'approve', reviewToken })
        .expect(409);
      expect(code(stale.body)).toBe('CONFLICT');
      expect(
        (await db.collection('doctors').findOne({ slug: d.profile.slug }))?.verification.status,
      ).toBe('pending');
    });

    it('parallel approve and reject: exactly one wins and isListed matches (P2)', async () => {
      const admin = await makeAdmin();
      const d = await readyDoctor('Wasim Akram', 'Rampur');
      const { reviewToken } = (
        await http()
          .get(`/api/v1/admin/doctors/${d.profile.id}`)
          .set('Authorization', admin.auth)
          .expect(200)
      ).body as { reviewToken: string };
      const send = (body: object) =>
        http()
          .post(`/api/v1/admin/doctors/${d.profile.id}/verify`)
          .set('Authorization', admin.auth)
          .send(body);
      const results = await Promise.all([
        send({ decision: 'approve', reviewToken }),
        send({ decision: 'reject', notes: 'Duplicate registration number', reviewToken }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const doc = await db.collection('doctors').findOne({ slug: d.profile.slug });
      expect(doc?.isListed).toBe(doc?.verification.status === 'verified');
    });
  });

  describe('public search (BE-10) and demo seed (BE-11)', () => {
    const adminPhone = '+919000000001';
    beforeAll(async () => {
      const models = {
        users: app.get(getModelToken(User.name)),
        doctors: app.get(getModelToken(Doctor.name)),
        clinics: app.get(getModelToken(Clinic.name)),
        schedules: app.get(getModelToken(ScheduleEntity.name)),
      };
      // Someone already holds one seed slug (RD BE-11 probe D): the seed must still finish.
      await db
        .collection('doctors')
        .insertOne({ slug: 'dr-meera-gupta-moradabad', userId: new Types.ObjectId() });
      await expect(seedDemo(models, { mode: 'live', adminPhone })).rejects.toThrow(
        'PROVIDER_MODE must be demo',
      );
      await seedDemo(models, { mode: 'demo', adminPhone });
      await seedDemo(models, { mode: 'demo', adminPhone }); // idempotent
    });

    it('seeds 3 clinics and 5 listed demo doctors exactly once', async () => {
      const seedPhones = SEED.doctors.map((d) => d.phone);
      expect(
        await db
          .collection('clinics')
          .countDocuments({ name: { $in: SEED.clinics.map((c) => c.name) } }),
      ).toBe(3);
      const users = await db
        .collection('users')
        .find({ phone: { $in: seedPhones } })
        .toArray();
      expect(
        await db.collection('doctors').countDocuments({
          userId: { $in: users.map((u) => u._id) },
          isDemo: true,
          isListed: true,
        }),
      ).toBe(5);
      expect(
        await db
          .collection('users')
          .countDocuments({ phone: adminPhone, roles: 'admin', isDemo: true }),
      ).toBe(1);
      // Placeholder phones: never opted in to WhatsApp.
      expect(
        await db
          .collection('users')
          .countDocuments({ phone: { $in: seedPhones }, whatsappOptIn: true }),
      ).toBe(0);
      const seeded = await db
        .collection('clinics')
        .find({ name: { $in: SEED.clinics.map((c) => c.name) } })
        .toArray();
      for (const c of seeded) {
        expect(c.staffUserIds).toHaveLength(1);
        expect(c.staffLog).toHaveLength(1);
        // Owned by its first doctor, not the admin.
        expect(users.map((u) => u._id.toHexString())).toContain(c.ownerUserId.toHexString());
      }
      expect(
        await db
          .collection('schedules')
          .countDocuments({ clinicId: { $in: seeded.map((c) => c._id) } }),
      ).toBe(5);
      expect(
        await db.collection('doctors').findOne({ slug: 'dr-meera-gupta-moradabad-2' }),
      ).toMatchObject({ isDemo: true });
    });

    it('searches by city and specialty, listed doctors only', async () => {
      const res = await http().get('/api/v1/doctors?city=bareilly').expect(200);
      const page = pageSchema(DoctorListItemSchema).parse(res.body);
      expect(page.items.map((d) => d.slug).sort()).toEqual(
        expect.arrayContaining([
          'dr-anita-sharma-bareilly',
          'dr-rakesh-sharma-bareilly',
          'dr-sana-qureshi-bareilly',
        ]),
      );
      // Neha Singh (Bareilly) is ready but not verified: never listed.
      expect(page.items.map((d) => d.slug)).not.toContain('dr-neha-singh-bareilly');
      const peds = pageSchema(DoctorListItemSchema).parse(
        (await http().get('/api/v1/doctors?city=Bareilly&specialty=paediatrics').expect(200)).body,
      );
      expect(peds.items.map((d) => d.slug)).toEqual(['dr-sana-qureshi-bareilly']);
      const byName = await http().get('/api/v1/doctors?city=Bareilly&q=rakesh').expect(200);
      expect(byName.body.items.map((d: { slug: string }) => d.slug)).toEqual([
        'dr-rakesh-sharma-bareilly',
      ]);
    });

    it('searches near a point with distances, nearest first', async () => {
      const res = await http()
        .get('/api/v1/doctors')
        .query({ near: '28.3600,79.4240', radiusKm: 10 })
        .expect(200);
      const page = pageSchema(DoctorListItemSchema).parse(res.body);
      expect(page.items.length).toBeGreaterThanOrEqual(3);
      expect(page.items.every((d) => d.distanceMeters !== null && d.distanceMeters <= 10_000)).toBe(
        true,
      );
      expect(page.items.map((d) => d.city)).not.toContain('Moradabad');
      const first = page.items[0]!;
      expect(first.primaryClinic?.name).toBe('Sharma Family Clinic');
    });

    it('paginates with an opaque cursor', async () => {
      const p1 = (await http().get('/api/v1/doctors?city=bareilly&limit=2').expect(200)).body;
      expect(p1.items).toHaveLength(2);
      expect(p1.nextCursor).toEqual(expect.any(String));
      const p2 = (
        await http()
          .get('/api/v1/doctors')
          .query({ city: 'bareilly', limit: 2, cursor: p1.nextCursor })
          .expect(200)
      ).body;
      const all = [...p1.items, ...p2.items].map((d: { id: string }) => d.id);
      expect(new Set(all).size).toBe(all.length);
      await http().get('/api/v1/doctors?city=bareilly&cursor=garbage').expect(400);
    });

    it('lists everyone with no filter, and validates input', async () => {
      await http().get('/api/v1/doctors').expect(200);
      await http().get('/api/v1/doctors?near=here').expect(400);
      // Out of India bounds is a 400, never a 500 from $geoNear (RD BE-10 should-fix 2).
      for (const near of ['95.0,79.4', '28.0,999', '79.4,28.36']) {
        const res = await http().get('/api/v1/doctors').query({ near }).expect(400);
        expect(res.body.error.details.issues[0].path).toBe('near');
      }
      await http().get('/api/v1/doctors?city=bareilly&specialty=astrology').expect(400);
      await http().get('/api/v1/doctors?city=bareilly&sort=payment').expect(400);
    });

    it('serves the public profile by slug', async () => {
      const res = await http().get('/api/v1/doctors/dr-anita-sharma-bareilly').expect(200);
      const p = DoctorProfileSchema.parse(res.body);
      expect(p.clinics[0]?.mapsUrl).toContain('google.com/maps');
      expect(p.bookingFee).toBe(1500);
      await http().get('/api/v1/doctors/dr-nobody').expect(404);
    });
  });
});
