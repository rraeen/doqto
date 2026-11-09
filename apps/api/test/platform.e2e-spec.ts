import {
  ApiErrorSchema,
  ApplicationDetailSchema,
  ApplicationListSchema,
  CONSOLE_ACCESS_COOKIE,
  ConsoleAccountSchema,
  ConsoleSessionSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { type Connection } from 'mongoose';
import request from 'supertest';
import { Types } from 'mongoose';
import { createTestApp } from './app';

const DEMO_CODE = '123456';
const PASSWORD = 'Sunrise2026x';
let seq = 0;
const nextEmail = (p: string) => `${p}${++seq}@example.com`;
const nextIp = () => `10.30.${Math.floor(seq / 250)}.${(seq % 250) + 1}`;
const errorCode = (body: unknown) => ApiErrorSchema.parse(body).error.code;

function cookieJar(res: request.Response): string[] {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return raw.map((c) => c.split(';')[0]!).filter((c) => !c.endsWith('='));
}

const lab = {
  labName: 'Rao Diagnostics',
  ownerName: 'Asha Rao',
  city: 'Hubballi',
  address: '12 Main Road',
  registrationNumber: 'LAB-778',
  nablAccredited: false,
  homeCollection: true,
  testsOffered: 'CBC, LFT, thyroid',
};
const clinic = {
  displayName: 'Dr Asha Rao',
  specialty: 'general_physician',
  qualifications: 'MBBS, MD',
  registrationNumber: 'KMC-12345',
  registrationCouncil: 'Karnataka Medical Council',
  registrationYear: 2012,
  experienceYears: 12,
  city: 'Hubballi',
  state: 'Karnataka',
  pincode: '580020',
  address: '12 Main Road, Hubballi',
  consultationFeeRupees: 300,
};

describe('the admin area of the console: team role and application review', () => {
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

  const post = (path: string, body: object) =>
    http().post(`/api/v1/${path}`).set('X-Forwarded-For', nextIp()).send(body);

  /** A provider who signed up and confirmed their code. */
  async function provider(name = 'Rao Hospital') {
    const identifier = nextEmail('prov');
    await post('console/auth/register', { name, identifier, password: PASSWORD }).expect(201);
    const res = await post('console/auth/verify', { identifier, code: DEMO_CODE }).expect(200);
    return { identifier, jar: cookieJar(res) };
  }
  const applyFor = (jar: string[], items: { kind: 'clinic' | 'lab' | 'pharmacy'; profile: object }[]) =>
    http().post('/api/v1/console/applications').set('Cookie', jar).send({ applications: items });

  /** A team member: an ordinary confirmed account that was given the admin role by hand. */
  async function admin() {
    const { identifier } = await provider('Admin Person');
    await db.collection('accounts').updateOne({ email: identifier }, { $set: { platformRole: 'admin' } });
    const res = await post('console/auth/login', { identifier, password: PASSWORD }).expect(200);
    return { identifier, jar: cookieJar(res), res };
  }

  describe('who may review', () => {
    it('a team member signs in at the ordinary console login and is marked as admin', async () => {
      const { res, jar } = await admin();
      const session = ConsoleSessionSchema.parse(res.body);
      expect(session.account).toMatchObject({ name: 'Admin Person', platformRole: 'admin' });
      const me = await http().get('/api/v1/console/auth/me').set('Cookie', jar).expect(200);
      expect(ConsoleAccountSchema.parse(me.body).platformRole).toBe('admin');
      await http().get('/api/v1/platform/applications').set('Cookie', jar).expect(200);
    });

    it('a provider is signed in but is not admin: 403 on the review routes, and nothing in /me', async () => {
      const { jar } = await provider();
      const me = await http().get('/api/v1/console/auth/me').set('Cookie', jar).expect(200);
      expect(ConsoleAccountSchema.parse(me.body).platformRole).toBeNull();
      const res = await http().get('/api/v1/platform/applications').set('Cookie', jar).expect(403);
      expect(errorCode(res.body)).toBe('FORBIDDEN');
      await http().get('/api/v1/platform/applications/not-an-id').set('Cookie', jar).expect(403);
      await http()
        .post('/api/v1/platform/applications/000000000000000000000000/decision')
        .set('Cookie', jar)
        .send({ decision: 'approve' })
        .expect(403);
    });

    it('no session, or a patient token, gets 401', async () => {
      await http().get('/api/v1/platform/applications').expect(401);
      const phone = '+919845012345';
      await http().post('/api/v1/auth/otp/request').set('X-Forwarded-For', nextIp()).send({ phone }).expect(200);
      const patient = await http()
        .post('/api/v1/auth/otp/verify')
        .set('X-Forwarded-For', nextIp())
        .set('X-Doqto-Client', 'mobile')
        .send({ phone, code: DEMO_CODE })
        .expect(200);
      await http()
        .get('/api/v1/platform/applications')
        .set('Authorization', `Bearer ${(patient.body as { accessToken: string }).accessToken}`)
        .expect(401);
    });

    it('the role is checked on every request: removing it stops access at once', async () => {
      const { identifier, jar } = await admin();
      await http().get('/api/v1/platform/applications').set('Cookie', jar).expect(200);
      await db.collection('accounts').updateOne({ email: identifier }, { $unset: { platformRole: '' } });
      await http().get('/api/v1/platform/applications').set('Cookie', jar).expect(403);
      // Giving it back works straight away too.
      await db.collection('accounts').updateOne({ email: identifier }, { $set: { platformRole: 'admin' } });
      await http().get('/api/v1/platform/applications').set('Cookie', jar).expect(200);
    });

    it('a suspended team member is signed out of the review routes', async () => {
      const { identifier, jar } = await admin();
      await db.collection('accounts').updateOne({ email: identifier }, { $set: { status: 'suspended' } });
      await http().get('/api/v1/platform/applications').set('Cookie', jar).expect(401);
    });

    it('the old separate admin sign-in routes are gone', async () => {
      await http().post('/api/v1/platform/auth/login').send({}).expect(404);
    });
  });

  describe('reviewing applications', () => {
    it('lists submitted applications with who applied and counts by status', async () => {
      const { jar } = await admin();
      const rao = await provider('Rao Hospital');
      await applyFor(rao.jar, [
        { kind: 'clinic', profile: clinic },
        { kind: 'lab', profile: lab },
      ]).expect(201);

      const res = await http().get('/api/v1/platform/applications?status=pending').set('Cookie', jar).expect(200);
      const list = ApplicationListSchema.parse(res.body);
      const mine = list.items.filter((i) => i.applicant.email === rao.identifier);
      expect(mine.map((i) => [i.kind, i.name, i.status]).sort()).toEqual([
        ['clinic', 'Dr Asha Rao', 'pending'],
        ['lab', 'Rao Diagnostics', 'pending'],
      ]);
      expect(mine[0]!.applicant.name).toBe('Rao Hospital');
      expect(mine[0]!.submittedAt).not.toBeNull();
      expect(list.counts.pending).toBeGreaterThanOrEqual(2);

      const onlyLabs = await http().get('/api/v1/platform/applications?kind=lab').set('Cookie', jar).expect(200);
      expect(ApplicationListSchema.parse(onlyLabs.body).items.every((i) => i.kind === 'lab')).toBe(true);
      await http().get('/api/v1/platform/applications?status=nonsense').set('Cookie', jar).expect(400);
    });

    it('shows one application in full, with the other services of the same business', async () => {
      const { jar } = await admin();
      const rao = await provider();
      await applyFor(rao.jar, [
        { kind: 'clinic', profile: clinic },
        { kind: 'lab', profile: lab },
      ]).expect(201);
      const labItem = ApplicationListSchema.parse(
        (await http().get('/api/v1/platform/applications?kind=lab').set('Cookie', jar).expect(200)).body,
      ).items.find((i) => i.applicant.email === rao.identifier)!;

      const res = await http().get(`/api/v1/platform/applications/${labItem.id}`).set('Cookie', jar).expect(200);
      const detail = ApplicationDetailSchema.parse(res.body);
      expect(detail.profile).toMatchObject({ registrationNumber: 'LAB-778', testsOffered: 'CBC, LFT, thyroid' });
      expect(detail.siblings.map((s) => s.kind)).toEqual(['clinic']);
      expect(detail.organization.name).toBe('Rao Hospital');
      await http().get('/api/v1/platform/applications/not-an-id').set('Cookie', jar).expect(404);
    });

    it('does not list a service that was never submitted', async () => {
      const { jar } = await admin();
      const rao = await provider();
      await applyFor(rao.jar, [{ kind: 'pharmacy', profile: {
        storeName: 'Draft Meds', ownerName: 'A', city: 'H', address: 'x', drugLicenceNumber: 'L1',
        drugLicenceValidUntil: '2030-01-01', pharmacistName: 'R', pharmacistRegistrationNumber: 'P1', homeDelivery: false,
      } }]).expect(201);
      await db.collection('units').updateOne({ name: 'Draft Meds' }, { $set: { status: 'draft' } });
      const list = ApplicationListSchema.parse((await http().get('/api/v1/platform/applications').set('Cookie', jar).expect(200)).body);
      expect(list.items.find((i) => i.name === 'Draft Meds')).toBeUndefined();
    });

    it('approving makes the service open for the provider, and is recorded in the audit log', async () => {
      const { jar } = await admin();
      const rao = await provider();
      await applyFor(rao.jar, [{ kind: 'lab', profile: lab }]).expect(201);
      const item = ApplicationListSchema.parse(
        (await http().get('/api/v1/platform/applications?status=pending').set('Cookie', jar).expect(200)).body,
      ).items.find((i) => i.applicant.email === rao.identifier)!;

      const res = await http()
        .post(`/api/v1/platform/applications/${item.id}/decision`)
        .set('Cookie', jar)
        .send({ decision: 'approve' })
        .expect(200);
      expect(ApplicationDetailSchema.parse(res.body)).toMatchObject({ status: 'verified', reviewNote: null });

      const me = await http().get('/api/v1/console/auth/me').set('Cookie', rao.jar).expect(200);
      expect(ConsoleAccountSchema.parse(me.body).workspaces).toMatchObject([{ kind: 'lab', status: 'verified' }]);
      expect(await db.collection('auditLogs').countDocuments({ action: 'application.approve' })).toBeGreaterThan(0);
    });

    it('sending back or rejecting needs a reason, and the provider sees it', async () => {
      const { jar } = await admin();
      const rao = await provider();
      await applyFor(rao.jar, [{ kind: 'clinic', profile: clinic }]).expect(201);
      const id = ApplicationListSchema.parse(
        (await http().get('/api/v1/platform/applications?kind=clinic').set('Cookie', jar).expect(200)).body,
      ).items.find((i) => i.applicant.email === rao.identifier)!.id;
      const decide = (body: object) =>
        http().post(`/api/v1/platform/applications/${id}/decision`).set('Cookie', jar).send(body);

      const noReason = await decide({ decision: 'request_changes' }).expect(400);
      expect(errorCode(noReason.body)).toBe('VALIDATION_FAILED');
      await decide({ decision: 'reject', note: 'no' }).expect(400);
      await decide({ decision: 'maybe' }).expect(400);

      const sent = await decide({ decision: 'request_changes', note: 'Please add your council certificate number.' }).expect(200);
      expect(ApplicationDetailSchema.parse(sent.body)).toMatchObject({
        status: 'changes_requested',
        reviewNote: 'Please add your council certificate number.',
      });
      // The provider reads the reason on their own panel data.
      const mine = await http().get('/api/v1/console/auth/me').set('Cookie', rao.jar).expect(200);
      expect(ConsoleAccountSchema.parse(mine.body).workspaces[0]).toMatchObject({
        status: 'changes_requested',
        reviewNote: 'Please add your council certificate number.',
      });
      // Already decided: a second decision on the same application is refused.
      const again = await decide({ decision: 'approve' }).expect(409);
      expect(errorCode(again.body)).toBe('CONFLICT');

      // The provider fixes it and submits again; it is back in the queue as pending.
      await applyFor(rao.jar, [{ kind: 'clinic', profile: { ...clinic, registrationNumber: 'KMC-99999' } }]).expect(201);
      const detail = ApplicationDetailSchema.parse((await http().get(`/api/v1/platform/applications/${id}`).set('Cookie', jar).expect(200)).body);
      expect(detail).toMatchObject({ status: 'pending' });
      expect(detail.profile).toMatchObject({ registrationNumber: 'KMC-99999' });

      const rejected = await decide({ decision: 'reject', note: 'Registration could not be verified.' }).expect(200);
      expect(ApplicationDetailSchema.parse(rejected.body).status).toBe('rejected');
    });
  });

  describe('approving a clinic puts the doctor on the patient site', () => {
    const search = (query = '') => http().get(`/api/v1/doctors${query}`).expect(200);
    const names = (body: unknown) => (body as { items: { name: string }[] }).items.map((d) => d.name);

    async function apply(jar: string[], profile: object) {
      await http().post('/api/v1/console/applications').set('Cookie', jar).send({ applications: [{ kind: 'clinic', profile }] }).expect(201);
    }
    async function unitIdOf(adminJar: string[], identifier: string, kind = 'clinic') {
      const list = ApplicationListSchema.parse(
        (await http().get(`/api/v1/platform/applications?kind=${kind}`).set('Cookie', adminJar).expect(200)).body,
      );
      return list.items.find((i) => i.applicant.email === identifier)!.id;
    }
    const decide = (jar: string[], id: string, body: object) =>
      http().post(`/api/v1/platform/applications/${id}/decision`).set('Cookie', jar).send(body);

    it('is not listed while waiting, is listed once approved, and opens by its profile page', async () => {
      const { jar: adminJar } = await admin();
      const rao = await provider();
      await apply(rao.jar, { ...clinic, displayName: 'Dr Publish Test' });
      expect(names((await search('?city=hubballi')).body)).not.toContain('Dr Publish Test');

      const id = await unitIdOf(adminJar, rao.identifier);
      await decide(adminJar, id, { decision: 'approve' }).expect(200);

      const found = (await search('?city=Hubballi&specialty=general_physician')).body as {
        items: { name: string; slug: string; specialties: string[] }[];
      };
      const mine = found.items.find((d) => d.name === 'Dr Publish Test')!;
      expect(mine).toBeDefined();
      expect(mine.slug).toBe('dr-publish-test-hubballi');
      const profile = await http().get(`/api/v1/doctors/${mine.slug}`).expect(200);
      expect(JSON.stringify(profile.body)).toContain('Dr Publish Test');
      // The records behind it point back to the application and the provider.
      const doctor = await db.collection('doctors').findOne({ slug: mine.slug });
      expect(doctor).toMatchObject({ isListed: true, city: 'hubballi', consultFee: 30000, bookingFee: 1000 });
      expect(doctor?.unitId.toHexString()).toBe(id);
      expect(doctor?.userId).toBeUndefined();
      const clinicDoc = await db.collection('clinics').findOne({ unitId: new Types.ObjectId(id) });
      expect(clinicDoc).toMatchObject({ address: { city: 'Hubballi', state: 'Karnataka', pincode: '580020' } });
    });

    it('rejecting an approved listing takes it off the site again', async () => {
      const { jar: adminJar } = await admin();
      const rao = await provider();
      await apply(rao.jar, { ...clinic, displayName: 'Dr Takedown Test' });
      const id = await unitIdOf(adminJar, rao.identifier);
      await decide(adminJar, id, { decision: 'approve' }).expect(200);
      expect(names((await search('?city=hubballi')).body)).toContain('Dr Takedown Test');

      // An approved doctor can be taken off the site later without any other step.
      await decide(adminJar, id, { decision: 'reject', note: 'Registration no longer valid.' }).expect(200);
      // Once rejected, nothing more can be decided until the applicant submits again.
      await decide(adminJar, id, { decision: 'approve' }).expect(409);
      await decide(adminJar, id, { decision: 'reject', note: 'Registration no longer valid.' }).expect(409);
      expect(names((await search('?city=hubballi')).body)).not.toContain('Dr Takedown Test');
      expect(await db.collection('doctors').findOne({ unitId: new Types.ObjectId(id) })).toMatchObject({
        isListed: false,
        verification: { status: 'rejected' },
      });
    });

    it('approving again after changes updates the same listing and keeps its address on the site', async () => {
      const { jar: adminJar } = await admin();
      const rao = await provider();
      await apply(rao.jar, { ...clinic, displayName: 'Dr Update Test' });
      const id = await unitIdOf(adminJar, rao.identifier);
      await decide(adminJar, id, { decision: 'request_changes', note: 'Please check your fee.' }).expect(200);
      expect(names((await search('?city=hubballi')).body)).not.toContain('Dr Update Test');

      await apply(rao.jar, { ...clinic, displayName: 'Dr Update Test', consultationFeeRupees: 450 });
      await decide(adminJar, id, { decision: 'approve' }).expect(200);
      const docs = await db.collection('doctors').find({ name: 'Dr Update Test' }).toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject({ isListed: true, consultFee: 45000, slug: 'dr-update-test-hubballi' });
    });

    it('sending an approved listing back for changes takes it off; fixing and approving lists it again', async () => {
      const { jar: adminJar } = await admin();
      const rao = await provider();
      await apply(rao.jar, { ...clinic, displayName: 'Dr Sendback Test' });
      const id = await unitIdOf(adminJar, rao.identifier);
      await decide(adminJar, id, { decision: 'approve' }).expect(200);
      expect(names((await search('?city=hubballi')).body)).toContain('Dr Sendback Test');
      await decide(adminJar, id, { decision: 'request_changes', note: 'Please add a clinic phone number.' }).expect(200);
      expect(names((await search('?city=hubballi')).body)).not.toContain('Dr Sendback Test');
      await apply(rao.jar, { ...clinic, displayName: 'Dr Sendback Test' });
      await decide(adminJar, id, { decision: 'approve' }).expect(200);
      expect(names((await search('?city=hubballi')).body)).toContain('Dr Sendback Test');
      expect(await db.collection('doctors').countDocuments({ name: 'Dr Sendback Test' })).toBe(1);
    });

    it('two doctors with the same name and city get different profile addresses', async () => {
      const { jar: adminJar } = await admin();
      const slugs: string[] = [];
      for (let i = 0; i < 2; i++) {
        const p = await provider();
        await apply(p.jar, { ...clinic, displayName: 'Dr Same Name' });
        await decide(adminJar, await unitIdOf(adminJar, p.identifier), { decision: 'approve' }).expect(200);
        const doc = await db.collection('doctors').find({ name: 'Dr Same Name' }).toArray();
        slugs.push(...doc.map((d) => d.slug as string));
      }
      expect(new Set(slugs).size).toBe(2);
    });

    it('does not approve an application the listing cannot be built from; it stays in the queue', async () => {
      const { jar: adminJar } = await admin();
      const rao = await provider();
      await apply(rao.jar, { ...clinic, displayName: 'Dr Incomplete Test' });
      const id = await unitIdOf(adminJar, rao.identifier);
      // An application saved before the form asked for the registration year, state and pincode.
      await db.collection('units').updateOne(
        { _id: new Types.ObjectId(id) },
        { $unset: { 'profile.registrationYear': '', 'profile.state': '', 'profile.pincode': '' } },
      );
      const res = await decide(adminJar, id, { decision: 'approve' }).expect(400);
      const issues = ApiErrorSchema.parse(res.body).error.details?.issues as { path: string }[];
      expect(issues.map((i) => i.path).sort()).toEqual(['pincode', 'registrationYear', 'state']);
      const detail = ApplicationDetailSchema.parse(
        (await http().get(`/api/v1/platform/applications/${id}`).set('Cookie', adminJar).expect(200)).body,
      );
      expect(detail.status).toBe('pending');
      expect(names((await search('?city=hubballi')).body)).not.toContain('Dr Incomplete Test');
    });

    it('a lab or pharmacy approval does not create a doctor', async () => {
      const { jar: adminJar } = await admin();
      const rao = await provider();
      await http().post('/api/v1/console/applications').set('Cookie', rao.jar).send({ applications: [{ kind: 'lab', profile: lab }] }).expect(201);
      const before = await db.collection('doctors').countDocuments();
      await decide(adminJar, await unitIdOf(adminJar, rao.identifier, 'lab'), { decision: 'approve' }).expect(200);
      expect(await db.collection('doctors').countDocuments()).toBe(before);
    });
  });

  describe('the schedule of an approved doctor', () => {
    const weekAllDays = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '00:05', end: '23:55', slotMinutes: 30 }));
    const istDate = (offsetDays: number) =>
      new Date(Date.now() + 5.5 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

    async function approvedDoctor(name: string) {
      const { jar: adminJar } = await admin();
      const rao = await provider();
      await http().post('/api/v1/console/applications').set('Cookie', rao.jar).send({ applications: [{ kind: 'clinic', profile: { ...clinic, displayName: name } }] }).expect(201);
      const list = ApplicationListSchema.parse((await http().get('/api/v1/platform/applications?kind=clinic').set('Cookie', adminJar).expect(200)).body);
      const unitId = list.items.find((i) => i.applicant.email === rao.identifier)!.id;
      await http().post(`/api/v1/platform/applications/${unitId}/decision`).set('Cookie', adminJar).send({ decision: 'approve' }).expect(200);
      const doctor = (await db.collection('doctors').findOne({ unitId: new Types.ObjectId(unitId) }))!;
      const clinicDoc = (await db.collection('clinics').findOne({ unitId: new Types.ObjectId(unitId) }))!;
      return { rao, unitId, doctorId: String(doctor._id), clinicId: String(clinicDoc._id) };
    }
    /** Slots are for signed-in patients, so look at them the way a patient does. */
    let patientBearer: string | undefined;
    async function patient(): Promise<string> {
      if (patientBearer) return patientBearer;
      const phone = '+919845099001';
      await http().post('/api/v1/auth/otp/request').set('X-Forwarded-For', nextIp()).send({ phone }).expect(200);
      const res = await http()
        .post('/api/v1/auth/otp/verify')
        .set('X-Forwarded-For', nextIp())
        .set('X-Doqto-Client', 'mobile')
        .send({ phone, code: DEMO_CODE })
        .expect(200);
      patientBearer = (res.body as { accessToken: string }).accessToken;
      return patientBearer;
    }
    const slots = async (doctorId: string, clinicId: string, date: string) =>
      http()
        .get(`/api/v1/doctors/${doctorId}/slots?clinicId=${clinicId}&date=${date}`)
        .set('Authorization', `Bearer ${await patient()}`)
        .expect(200);

    it('a newly listed doctor has no slots; saving the weekly hours opens them for patients', async () => {
      const d = await approvedDoctor('Dr Slots Test');
      const tomorrow = istDate(1);
      const none = (await slots(d.doctorId, d.clinicId, tomorrow)).body as { slots: unknown[]; scheduled: boolean };
      expect(none).toMatchObject({ slots: [], scheduled: false });

      const empty = await http().get(`/api/v1/console/workspaces/${d.unitId}/schedule`).set('Cookie', d.rao.jar).expect(200);
      expect(empty.body).toMatchObject({ weekly: [], updatedAt: null });

      const saved = await http()
        .put(`/api/v1/console/workspaces/${d.unitId}/schedule`)
        .set('Cookie', d.rao.jar)
        .send({ weekly: weekAllDays, exceptions: [], bookingWindowDays: 7, walkInShare: 0.3, isActive: true })
        .expect(200);
      expect((saved.body as { weekly: unknown[] }).weekly).toHaveLength(7);

      const open = (await slots(d.doctorId, d.clinicId, tomorrow)).body as { slots: unknown[]; scheduled: boolean };
      expect(open.scheduled).toBe(true);
      expect(open.slots.length).toBeGreaterThan(5);
      // Beyond the booking window nothing is offered.
      expect(((await slots(d.doctorId, d.clinicId, istDate(20))).body as { scheduled: boolean }).scheduled).toBe(false);
    });

    it('refuses overlapping or invalid hours and unknown fields', async () => {
      const d = await approvedDoctor('Dr Overlap Test');
      const put = (body: object) => http().put(`/api/v1/console/workspaces/${d.unitId}/schedule`).set('Cookie', d.rao.jar).send(body);
      const overlap = await put({ weekly: [{ day: 1, start: '10:00', end: '13:00', slotMinutes: 15 }, { day: 1, start: '12:00', end: '14:00', slotMinutes: 15 }] }).expect(400);
      expect(errorCode(overlap.body)).toBe('VALIDATION_FAILED');
      await put({ weekly: [{ day: 1, start: '13:00', end: '10:00', slotMinutes: 15 }] }).expect(400);
      await put({ weekly: [], surprise: true }).expect(400);
    });

    it('only the owner of an approved clinic can read or change it; others cannot', async () => {
      const d = await approvedDoctor('Dr Owner Test');
      const stranger = await provider('Someone Else');
      await http().get(`/api/v1/console/workspaces/${d.unitId}/schedule`).set('Cookie', stranger.jar).expect(404);
      await http().put(`/api/v1/console/workspaces/${d.unitId}/schedule`).set('Cookie', stranger.jar).send({ weekly: [] }).expect(404);
      await http().get(`/api/v1/console/workspaces/${d.unitId}/schedule`).expect(401);
      // Not approved (or sent back): the schedule is closed.
      await db.collection('units').updateOne({ _id: new Types.ObjectId(d.unitId) }, { $set: { status: 'changes_requested' } });
      await http().get(`/api/v1/console/workspaces/${d.unitId}/schedule`).set('Cookie', d.rao.jar).expect(403);
    });

    it('a lab has no schedule', async () => {
      const rao = await provider();
      const res = await http().post('/api/v1/console/applications').set('Cookie', rao.jar).send({ applications: [{ kind: 'lab', profile: lab }] }).expect(201);
      const id = (res.body as { id: string }[])[0]!.id;
      await http().get(`/api/v1/console/workspaces/${id}/schedule`).set('Cookie', rao.jar).expect(404);
    });
  });

  describe('bookings of an approved doctor appear in the console', () => {
    const istDate = (n: number) =>
      new Date(Date.now() + 5.5 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
    const week = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '00:05', end: '23:55', slotMinutes: 30 }));

    async function bookableDoctor(name: string) {
      const { jar: adminJar } = await admin();
      const rao = await provider();
      await http().post('/api/v1/console/applications').set('Cookie', rao.jar).send({ applications: [{ kind: 'clinic', profile: { ...clinic, displayName: name } }] }).expect(201);
      const list = ApplicationListSchema.parse((await http().get('/api/v1/platform/applications?kind=clinic').set('Cookie', adminJar).expect(200)).body);
      const unitId = list.items.find((i) => i.applicant.email === rao.identifier)!.id;
      await http().post(`/api/v1/platform/applications/${unitId}/decision`).set('Cookie', adminJar).send({ decision: 'approve' }).expect(200);
      await http().put(`/api/v1/console/workspaces/${unitId}/schedule`).set('Cookie', rao.jar).send({ weekly: week, exceptions: [], bookingWindowDays: 7, walkInShare: 0.3, isActive: true }).expect(200);
      const doctor = (await db.collection('doctors').findOne({ unitId: new Types.ObjectId(unitId) }))!;
      const clinicDoc = (await db.collection('clinics').findOne({ unitId: new Types.ObjectId(unitId) }))!;
      return { rao, unitId, doctorId: String(doctor._id), clinicId: String(clinicDoc._id) };
    }

    /** A patient books the first free slot tomorrow and pays (demo gateway). */
    async function patientBooks(d: { doctorId: string; clinicId: string }, patientName: string) {
      const phone = `+91984${String(5_000_000 + ++seq).slice(-7)}`;
      await http().post('/api/v1/auth/otp/request').set('X-Forwarded-For', nextIp()).send({ phone }).expect(200);
      const login = await http().post('/api/v1/auth/otp/verify').set('X-Forwarded-For', nextIp()).set('X-Doqto-Client', 'mobile').send({ phone, code: DEMO_CODE }).expect(200);
      const auth = { Authorization: `Bearer ${(login.body as { accessToken: string }).accessToken}` };
      const slots = (await http().get(`/api/v1/doctors/${d.doctorId}/slots?clinicId=${d.clinicId}&date=${istDate(1)}`).set(auth).expect(200)).body as { slots: { start: string }[] };
      const created = await http().post('/api/v1/appointments').set(auth).set('X-Forwarded-For', nextIp()).send({ doctorId: d.doctorId, clinicId: d.clinicId, slotStart: slots.slots[0]!.start, patientName, patientPhone: phone }).expect(201);
      const id = (created.body as { appointment: { id: string } }).appointment.id;
      await http().post('/api/v1/payments/demo-pay').set(auth).send({ appointmentId: id }).expect(200);
      return { id, auth };
    }

    it('a paid booking waits for the doctor in the console, who confirms it and the patient gets the visit code', async () => {
      const d = await bookableDoctor('Dr Console Bookings');
      const booked = await patientBooks(d, 'Asha Devi');

      const waiting = await http().get(`/api/v1/console/workspaces/${d.unitId}/appointments/waiting`).set('Cookie', d.rao.jar).expect(200);
      expect(waiting.body).toMatchObject([{ id: booked.id, patientName: 'Asha Devi', status: 'pending_confirmation' }]);

      const day = await http().get(`/api/v1/console/workspaces/${d.unitId}/appointments?date=${istDate(1)}`).set('Cookie', d.rao.jar).expect(200);
      expect((day.body as { items: { id: string }[] }).items.map((i) => i.id)).toEqual([booked.id]);
      const today = await http().get(`/api/v1/console/workspaces/${d.unitId}/appointments`).set('Cookie', d.rao.jar).expect(200);
      expect((today.body as { items: unknown[] }).items).toEqual([]);

      const confirmed = await http().post(`/api/v1/console/workspaces/${d.unitId}/appointments/${booked.id}/confirm`).set('Cookie', d.rao.jar).expect(200);
      expect(confirmed.body).toMatchObject({ appointment: { id: booked.id, status: 'confirmed' } });
      expect((await http().get(`/api/v1/console/workspaces/${d.unitId}/appointments/waiting`).set('Cookie', d.rao.jar).expect(200)).body).toEqual([]);
      // Once accepted it moves to the upcoming list, whatever its date.
      const upcoming = await http().get(`/api/v1/console/workspaces/${d.unitId}/appointments/upcoming`).set('Cookie', d.rao.jar).expect(200);
      expect(upcoming.body).toMatchObject([{ id: booked.id, patientName: 'Asha Devi', status: 'confirmed' }]);
      // The patient sees their booking as confirmed.
      const mine = await http().get(`/api/v1/appointments/${booked.id}`).set(booked.auth).expect(200);
      expect(mine.body).toMatchObject({ status: 'confirmed' });
    });

    it('when the patient moves a confirmed booking it goes back to the doctor, who must accept the new time', async () => {
      const d = await bookableDoctor('Dr Moved Bookings');
      const booked = await patientBooks(d, 'Asha Devi');
      const base = `/api/v1/console/workspaces/${d.unitId}/appointments`;
      await http().post(`${base}/${booked.id}/confirm`).set('Cookie', d.rao.jar).expect(200);
      expect((await http().get(base + '/upcoming').set('Cookie', d.rao.jar).expect(200)).body).toHaveLength(1);
      expect((await http().get(base + '/waiting').set('Cookie', d.rao.jar).expect(200)).body).toEqual([]);

      // The patient picks another slot.
      const slots = (await http().get(`/api/v1/doctors/${d.doctorId}/slots?clinicId=${d.clinicId}&date=${istDate(1)}`).set(booked.auth).expect(200)).body as { slots: { start: string }[] };
      const target = slots.slots[3]!.start;
      const moved = await http().post(`/api/v1/appointments/${booked.id}/reschedule`).set(booked.auth).send({ slotStart: target }).expect(200);
      expect(moved.body).toMatchObject({ appointment: { status: 'pending_confirmation', slotStart: target } });

      // Back in the doctor's waiting list, marked as moved, and no longer "upcoming".
      const waiting = await http().get(base + '/waiting').set('Cookie', d.rao.jar).expect(200);
      expect(waiting.body).toMatchObject([{ id: booked.id, status: 'pending_confirmation', slotStart: target, rescheduled: true }]);
      expect((await http().get(base + '/upcoming').set('Cookie', d.rao.jar).expect(200)).body).toEqual([]);

      // The doctor accepts the new time and it is upcoming again, with a new visit code.
      await http().post(`${base}/${booked.id}/confirm`).set('Cookie', d.rao.jar).expect(200);
      expect((await http().get(base + '/upcoming').set('Cookie', d.rao.jar).expect(200)).body).toMatchObject([{ id: booked.id, status: 'confirmed', slotStart: target }]);
      const mine = await http().get(`/api/v1/appointments/${booked.id}`).set(booked.auth).expect(200);
      expect((mine.body as { visitCode: string }).visitCode).toMatch(/^[0-9]{4}$/);
    });

    it('runs the visit day from the console: check-in, calling patients, no-show, walk-ins and the live status', async () => {
      const d = await bookableDoctor('Dr Queue Day');
      const base = `/api/v1/console/workspaces/${d.unitId}`;
      const jar = d.rao.jar;

      // A confirmed booking whose visit is today (the test moves its date, as the day would pass).
      const booked = await patientBooks(d, 'Asha Devi');
      await http().post(`${base}/appointments/${booked.id}/confirm`).set('Cookie', jar).expect(200);
      const nowIst = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
      await db.collection('appointments').updateOne(
        { _id: new Types.ObjectId(booked.id) },
        { $set: { date: nowIst, slotStart: new Date(Date.now() + 40 * 60_000), slotEnd: new Date(Date.now() + 60 * 60_000) } },
      );
      const visitCode = ((await http().get(`/api/v1/appointments/${booked.id}`).set(booked.auth).expect(200)).body as { visitCode: string }).visitCode;

      const sheet = async () => (await http().get(`${base}/appointments`).set('Cookie', jar).expect(200)).body as {
        items: { id: string; status: string; queueToken: number | null; patientName: string }[];
        status: { state: string; currentToken: number | null; queueLength: number } | null;
      };
      expect((await sheet()).items).toMatchObject([{ id: booked.id, status: 'confirmed', queueToken: null }]);

      // Check-in needs the right code.
      const wrong = await http().post(`${base}/queue/check-in`).set('Cookie', jar).send({ appointmentId: booked.id, method: 'visit_code', code: visitCode === '0000' ? '1111' : '0000' }).expect(400);
      expect(errorCode(wrong.body)).toMatch(/OTP|VISIT|VALIDATION/);
      const checked = await http().post(`${base}/queue/check-in`).set('Cookie', jar).send({ appointmentId: booked.id, method: 'visit_code', code: visitCode }).expect(200);
      expect(checked.body).toMatchObject({ appointment: { id: booked.id, status: 'checked_in', queueToken: 1 } });

      // The doctor's live status, as patients see it.
      const live = await http().put(`${base}/status`).set('Cookie', jar).send({ state: 'in_clinic' }).expect(200);
      expect(live.body).toMatchObject({ state: 'in_clinic', queueLength: 1 });
      await http().put(`${base}/status`).set('Cookie', jar).send({ state: 'running_late' }).expect(400);
      await http().put(`${base}/status`).set('Cookie', jar).send({ state: 'running_late', delayMinutes: 20, message: 'Emergency surgery' }).expect(200);
      const pub = await http().get(`/api/v1/doctors/${d.doctorId}/status`).set(booked.auth).expect(200);
      expect(pub.body).toMatchObject({ state: 'running_late', delayMinutes: 20, message: 'Emergency surgery' });

      // A walk-in has no visit code: send a code, check in with it.
      const walk = await http().post(`${base}/appointments`).set('Cookie', jar).send({ source: 'walk_in', patientName: 'Walk In Person', patientPhone: '+919845077001' }).expect(201);
      const walkId = (walk.body as { id: string }).id;
      await http().post(`${base}/queue/${walkId}/send-otp`).set('Cookie', jar).expect(200);
      await http().post(`${base}/queue/check-in`).set('Cookie', jar).send({ appointmentId: walkId, method: 'otp', code: '123456' }).expect(200);
      expect((await sheet()).status).toMatchObject({ queueLength: 2 });

      // Call the next patient. Order is by effective time: the walk-in arrived now, while the booked
      // patient is early for a slot 40 minutes away, so the walk-in goes first, then the booking.
      const first = await http().post(`${base}/queue/next`).set('Cookie', jar).send({}).expect(200);
      expect(first.body).toMatchObject({ appointment: { id: walkId, status: 'in_consult' }, completed: null });
      const second = await http().post(`${base}/queue/next`).set('Cookie', jar).send({ currentAppointmentId: walkId }).expect(200);
      expect(second.body).toMatchObject({ appointment: { id: booked.id, status: 'in_consult' }, completed: { id: walkId, status: 'completed' } });
      // A stale tap (someone else already moved on) changes nothing.
      await http().post(`${base}/queue/next`).set('Cookie', jar).send({ currentAppointmentId: walkId }).expect(409);
      const done = await http().post(`${base}/queue/next`).set('Cookie', jar).send({ currentAppointmentId: booked.id }).expect(200);
      expect(done.body).toMatchObject({ appointment: null, completed: { id: booked.id, status: 'completed' } });

      // Someone who never came is marked as a no-show.
      const late = await http().post(`${base}/appointments`).set('Cookie', jar).send({ source: 'phone_manual', patientName: 'Never Came', patientPhone: '+919845077002', date: nowIst, slotStart: new Date(Date.now() + 90 * 60_000).toISOString() });
      if (late.status === 201) {
        const noShow = await http().post(`${base}/queue/${(late.body as { id: string }).id}/no-show`).set('Cookie', jar).expect(200);
        expect(noShow.body).toMatchObject({ appointment: { status: 'no_show' } });
      }
    });

    it('nobody else can run the queue of this doctor', async () => {
      const d = await bookableDoctor('Dr Queue Private');
      const booked = await patientBooks(d, 'Meena Shah');
      await http().post(`/api/v1/console/workspaces/${d.unitId}/appointments/${booked.id}/confirm`).set('Cookie', d.rao.jar).expect(200);
      const stranger = await provider('Someone Else');
      const base = `/api/v1/console/workspaces/${d.unitId}`;
      await http().post(`${base}/queue/check-in`).set('Cookie', stranger.jar).send({ appointmentId: booked.id, method: 'visit_code', code: '1234' }).expect(404);
      await http().post(`${base}/queue/next`).set('Cookie', stranger.jar).send({}).expect(404);
      await http().put(`${base}/status`).set('Cookie', stranger.jar).send({ state: 'in_clinic' }).expect(404);
      await http().post(`${base}/queue/next`).send({}).expect(401);
      await http().post(`${base}/queue/next`).set(booked.auth).send({}).expect(401);
      // The ids of the clinic and doctor are not accepted from the browser.
      await http().post(`${base}/queue/next`).set('Cookie', d.rao.jar).send({ clinicId: d.clinicId, doctorId: d.doctorId }).expect(400);
      // Another doctor's booking cannot be touched through this doctor's service.
      const other = await bookableDoctor('Dr Queue Other');
      await http().post(`/api/v1/console/workspaces/${other.unitId}/queue/${booked.id}/no-show`).set('Cookie', other.rao.jar).expect(404);
    });

    it('another provider, a patient and a signed-out visitor cannot see or confirm these bookings', async () => {
      const d = await bookableDoctor('Dr Private Bookings');
      const booked = await patientBooks(d, 'Meena Shah');
      const stranger = await provider('Someone Else');
      const base = `/api/v1/console/workspaces/${d.unitId}/appointments`;
      await http().get(base + '/waiting').set('Cookie', stranger.jar).expect(404);
      await http().get(base + '/upcoming').set('Cookie', stranger.jar).expect(404);
      await http().get(base + '/upcoming').expect(401);
      await http().post(`${base}/${booked.id}/confirm`).set('Cookie', stranger.jar).expect(404);
      await http().get(base + '/waiting').expect(401);
      await http().get(base + '/waiting').set(booked.auth).expect(401);
      // The owner cannot confirm another doctor's booking through their own service either.
      const other = await bookableDoctor('Dr Other Practice');
      await http().post(`/api/v1/console/workspaces/${other.unitId}/appointments/${booked.id}/confirm`).set('Cookie', other.rao.jar).expect(404);
    });

    it('a service that is not approved has no bookings screen', async () => {
      const d = await bookableDoctor('Dr Closed Bookings');
      await db.collection('units').updateOne({ _id: new Types.ObjectId(d.unitId) }, { $set: { status: 'changes_requested' } });
      await http().get(`/api/v1/console/workspaces/${d.unitId}/appointments/waiting`).set('Cookie', d.rao.jar).expect(403);
    });
  });
});
