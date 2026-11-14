import {
  ApplicationListSchema,
  LabBookingListSchema,
  LabBookingSchema,
  LabCatalogueSchema,
  LabConsoleBookingListSchema,
  LabConsoleBookingSchema,
  LabListSchema,
  LabProfileSchema,
  LabReportLinkSchema,
  LabTestSchema,
  StaffMemberSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { type Connection, Types } from 'mongoose';
import request from 'supertest';
import { addDays, istDate } from '../src/common/time/ist';
import { createTestApp } from './app';
import { login, PDF, type Session } from './helpers';

const DEMO_CODE = '123456';
const PASSWORD = 'Sunrise2026x';
const STAFF_PASSWORD = 'Temporary2026a';
let seq = 0;
const nextEmail = (p: string) => `${p}${++seq}@example.com`;
const nextIp = () => `10.60.${Math.floor(seq / 250)}.${(seq % 250) + 1}`;
const cookieJar = (res: request.Response): string[] =>
  (((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []) as string[])
    .map((c) => c.split(';')[0]!)
    .filter((c) => !c.endsWith('='));

const labForm = (name: string, city = 'Hubballi') => ({
  labName: name,
  ownerName: 'Asha Rao',
  city,
  address: '12 Main Road',
  registrationNumber: 'LAB-778',
  nablAccredited: true,
  homeCollection: true,
  testsOffered: 'CBC, LFT, thyroid',
  turnaroundHours: 24,
});

describe('labs: listing, catalogue, booking requests, collection and reports', () => {
  let app: INestApplication;
  let db: Connection;
  let adminJar: string[];
  const http = () => request(app.getHttpServer());
  const post = (path: string, body: object) =>
    http().post(`/api/v1/${path}`).set('X-Forwarded-For', nextIp()).send(body);
  const tomorrow = () => addDays(istDate(), 1);

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<Connection>(getConnectionToken());
    const identifier = nextEmail('admin');
    await post('console/auth/register', { name: 'Admin', identifier, password: PASSWORD }).expect(201);
    await post('console/auth/verify', { identifier, code: DEMO_CODE }).expect(200);
    await db.collection('accounts').updateOne({ email: identifier }, { $set: { platformRole: 'admin' } });
    adminJar = cookieJar(await post('console/auth/login', { identifier, password: PASSWORD }).expect(200));
  });
  afterAll(async () => {
    await db.dropDatabase();
    await app.close();
  });

  /** An owner whose lab application Doqto approved. */
  async function labOwner(name: string, city?: string, approve = true) {
    const identifier = nextEmail('labowner');
    await post('console/auth/register', { name: 'Owner', identifier, password: PASSWORD }).expect(201);
    const jar = cookieJar(await post('console/auth/verify', { identifier, code: DEMO_CODE }).expect(200));
    await http()
      .post('/api/v1/console/applications')
      .set('Cookie', jar)
      .send({ applications: [{ kind: 'lab', profile: labForm(name, city) }] })
      .expect(201);
    const list = ApplicationListSchema.parse(
      (await http().get('/api/v1/platform/applications?kind=lab').set('Cookie', adminJar).expect(200)).body,
    );
    const unitId = list.items.find((i) => i.applicant.email === identifier)!.id;
    if (approve) {
      await http()
        .post(`/api/v1/platform/applications/${unitId}/decision`)
        .set('Cookie', adminJar)
        .send({ decision: 'approve' })
        .expect(200);
    }
    return { identifier, jar, unitId };
  }
  const base = (unitId: string) => `/api/v1/console/workspaces/${unitId}/lab`;

  /** A lab with a category and two tests, one of them for the clinic only. */
  async function labWithCatalogue(name: string, city?: string) {
    const o = await labOwner(name, city);
    const cat = (
      await http().post(`${base(o.unitId)}/categories`).set('Cookie', o.jar).send({ name: 'Blood' }).expect(201)
    ).body as { id: string };
    const cbc = LabTestSchema.parse(
      (
        await http()
          .post(`${base(o.unitId)}/tests`)
          .set('Cookie', o.jar)
          .send({ name: 'CBC', pricePaise: 35000, categoryId: cat.id, homeCollection: true, sampleType: 'Blood' })
          .expect(201)
      ).body,
    );
    const mri = LabTestSchema.parse(
      (
        await http()
          .post(`${base(o.unitId)}/tests`)
          .set('Cookie', o.jar)
          .send({ name: 'Stress test', pricePaise: 120000 })
          .expect(201)
      ).body,
    );
    const slug = (await db.collection('labs').findOne({ unitId: { $exists: true }, name }))!.slug as string;
    return { ...o, cbc, mri, slug, categoryId: cat.id };
  }

  const request_ = (patient: Session, slug: string, body: object) =>
    http().post(`/api/v1/labs/${slug}/bookings`).set('Authorization', patient.auth).send(body);
  const bookingBody = (testIds: string[], extra: object = {}) => ({
    testIds,
    patientName: 'Ravi Kumar',
    mode: 'lab',
    date: tomorrow(),
    window: 'morning',
    ...extra,
  });

  it('approving a lab lists it for patients; withdrawing the approval takes it off', async () => {
    const o = await labOwner('Rao Diagnostics');
    const list = LabListSchema.parse((await http().get('/api/v1/labs?city=hubballi').expect(200)).body);
    const mine = list.items.find((l) => l.name === 'Rao Diagnostics')!;
    expect(mine).toMatchObject({ city: 'Hubballi', nablAccredited: true, homeCollection: true, testCount: 0 });
    expect(mine.slug).toBe('rao-diagnostics-hubballi');

    const profile = LabProfileSchema.parse((await http().get(`/api/v1/labs/${mine.slug}`).expect(200)).body);
    expect(profile.address).toBe('12 Main Road');

    await http()
      .post(`/api/v1/platform/applications/${o.unitId}/decision`)
      .set('Cookie', adminJar)
      .send({ decision: 'request_changes', note: 'Please add the licence number' })
      .expect(200);
    await http().get(`/api/v1/labs/${mine.slug}`).expect(404);
    const after = LabListSchema.parse((await http().get('/api/v1/labs?city=Hubballi').expect(200)).body);
    expect(after.items.find((l) => l.name === 'Rao Diagnostics')).toBeUndefined();
  });

  it('an unapproved lab cannot use the lab screens or be found', async () => {
    const o = await labOwner('Pending Lab', 'Dharwad', false);
    await http().get(`${base(o.unitId)}/catalogue`).set('Cookie', o.jar).expect(403);
    const list = LabListSchema.parse((await http().get('/api/v1/labs?city=dharwad').expect(200)).body);
    expect(list.items).toHaveLength(0);
  });

  it('the catalogue: categories and tests, switched off tests are hidden from patients', async () => {
    const lab = await labWithCatalogue('Catalogue Lab', 'Gadag');
    const mine = LabCatalogueSchema.parse(
      (await http().get(`${base(lab.unitId)}/catalogue`).set('Cookie', lab.jar).expect(200)).body,
    );
    expect(mine.tests.map((t) => [t.name, t.categoryName])).toEqual([
      ['CBC', 'Blood'],
      ['Stress test', null],
    ]);
    await http().post(`${base(lab.unitId)}/categories`).set('Cookie', lab.jar).send({ name: 'Blood' }).expect(409);
    await http()
      .post(`${base(lab.unitId)}/tests`)
      .set('Cookie', lab.jar)
      .send({ name: 'Bad', pricePaise: 100, categoryId: 'a'.repeat(24) })
      .expect(400);

    await http()
      .patch(`${base(lab.unitId)}/tests/${lab.mri.id}`)
      .set('Cookie', lab.jar)
      .send({ active: false })
      .expect(200);
    const profile = LabProfileSchema.parse((await http().get(`/api/v1/labs/${lab.slug}`).expect(200)).body);
    expect(profile.catalogue.tests.map((t) => t.name)).toEqual(['CBC']);
    expect(profile.testCount).toBe(1);
  });

  it('patients can search labs by test name, lab name or city', async () => {
    const lab = await labWithCatalogue('Search Lab', 'Mysuru');
    await http()
      .post(`${base(lab.unitId)}/tests`)
      .set('Cookie', lab.jar)
      .send({ name: 'Thyroid Profile (T3, T4, TSH)', pricePaise: 50000 })
      .expect(201);
    const find = async (q: string) =>
      LabListSchema.parse((await http().get('/api/v1/labs').query({ q }).expect(200)).body).items;

    const byTest = (await find('thyroid')).find((l) => l.name === 'Search Lab')!;
    expect(byTest.matchedTests).toEqual(['Thyroid Profile (T3, T4, TSH)']);
    expect((await find('THYROID')).some((l) => l.name === 'Search Lab')).toBe(true);
    expect((await find('search lab')).some((l) => l.name === 'Search Lab')).toBe(true);
    expect((await find('mysuru')).some((l) => l.name === 'Search Lab')).toBe(true);
    // Special characters are searched as text, never as a pattern; no match, no error.
    expect(await find('(T3')).toHaveLength(1);
    expect(await find('.*')).toHaveLength(0);
    expect(await find('no such test anywhere')).toHaveLength(0);
    // A switched-off test is not searchable.
    const cbc = (await find('cbc')).find((l) => l.name === 'Search Lab')!;
    expect(cbc.matchedTests).toEqual(['CBC']);
    await http().patch(`${base(lab.unitId)}/tests/${lab.cbc.id}`).set('Cookie', lab.jar).send({ active: false }).expect(200);
    expect((await find('cbc')).some((l) => l.name === 'Search Lab')).toBe(false);
  });

  it('a patient sends a request; the lab accepts, collects, processes, and the patient gets the report', async () => {
    const lab = await labWithCatalogue('Flow Lab', 'Belagavi');
    const patient = await login(app);
    const sent = LabBookingSchema.parse(
      (await request_(patient, lab.slug, bookingBody([lab.cbc.id])).expect(201)).body,
    );
    expect(sent).toMatchObject({ status: 'requested', totalPaise: 35000, patientName: 'Ravi Kumar' });
    expect(sent.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // The lab sees it with the patient's phone.
    const seen = LabConsoleBookingListSchema.parse(
      (await http().get(`${base(lab.unitId)}/bookings?status=requested`).set('Cookie', lab.jar).expect(200)).body,
    );
    expect(seen.items).toHaveLength(1);
    expect(seen.items[0]!.patientPhone).toMatch(/^\+91/);
    expect(seen.reportsEnabled).toBe(true);

    const bookingUrl = (suffix: string) => `${base(lab.unitId)}/bookings/${sent.id}/${suffix}`;
    // Cannot skip ahead.
    await http().post(bookingUrl('progress')).set('Cookie', lab.jar).send({ step: 'collected' }).expect(409);
    await http().post(bookingUrl('decision')).set('Cookie', lab.jar).send({ decision: 'accept' }).expect(200);
    // A second answer is refused.
    await http().post(bookingUrl('decision')).set('Cookie', lab.jar).send({ decision: 'accept' }).expect(409);

    await http().post(bookingUrl('progress')).set('Cookie', lab.jar).send({ step: 'collected' }).expect(200);
    // A report before processing is allowed after collection; here we go through processing first.
    await http().post(bookingUrl('progress')).set('Cookie', lab.jar).send({ step: 'processing' }).expect(200);

    // The patient cannot cancel once the lab has the sample, and has no report yet.
    await http().post(`/api/v1/me/lab-bookings/${sent.id}/cancel`).set('Authorization', patient.auth).expect(409);
    await http().get(`/api/v1/me/lab-bookings/${sent.id}/report`).set('Authorization', patient.auth).expect(404);

    // A non-PDF is refused; a PDF makes the booking report_ready.
    await http()
      .put(bookingUrl('report'))
      .set('Cookie', lab.jar)
      .attach('file', Buffer.from('not a pdf at all'), { filename: 'r.pdf', contentType: 'application/pdf' })
      .expect(400);
    const ready = LabConsoleBookingSchema.parse(
      (
        await http()
          .put(bookingUrl('report'))
          .set('Cookie', lab.jar)
          .attach('file', PDF, { filename: 'report.pdf', contentType: 'application/pdf' })
          .expect(200)
      ).body,
    );
    expect(ready).toMatchObject({ status: 'report_ready', reportReady: true });
    expect(ready.history.map((h) => h.status)).toEqual([
      'requested',
      'accepted',
      'sample_collected',
      'processing',
      'report_ready',
    ]);

    const mine = LabBookingListSchema.parse(
      (await http().get('/api/v1/me/lab-bookings').set('Authorization', patient.auth).expect(200)).body,
    );
    expect(mine.items[0]).toMatchObject({ id: sent.id, status: 'report_ready', reportReady: true });
    const link = LabReportLinkSchema.parse(
      (await http().get(`/api/v1/me/lab-bookings/${sent.id}/report`).set('Authorization', patient.auth).expect(200)).body,
    );
    expect(link.fileName).toBe(`lab-report-${sent.code}.pdf`);
    // The link itself serves the file, as an attachment; a tampered link does not.
    const u = new URL(link.url);
    const file = await http().get(`${u.pathname}${u.search}`).buffer(true).expect(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    expect(file.headers['content-disposition']).toContain('attachment');
    expect(Buffer.from(file.body).subarray(0, 5).toString()).toBe('%PDF-');
    await http().get(`${u.pathname}${u.search.replace(/sig=./, 'sig=0')}`).expect(403);
    // Someone else's booking looks like it does not exist.
    const stranger = await login(app);
    await http().get(`/api/v1/me/lab-bookings/${sent.id}`).set('Authorization', stranger.auth).expect(404);
    await http().get(`/api/v1/me/lab-bookings/${sent.id}/report`).set('Authorization', stranger.auth).expect(404);

    await http().post(bookingUrl('progress')).set('Cookie', lab.jar).send({ step: 'completed' }).expect(200);
    expect(
      LabBookingSchema.parse(
        (await http().get(`/api/v1/me/lab-bookings/${sent.id}`).set('Authorization', patient.auth).expect(200)).body,
      ).status,
    ).toBe('completed');
    expect(await db.collection('auditLogs').countDocuments({ action: 'lab.report.read' })).toBeGreaterThan(0);
  });

  it('a lab can reject with a reason; the patient can cancel before the sample is collected', async () => {
    const lab = await labWithCatalogue('Reject Lab', 'Hospet');
    const patient = await login(app);
    const a = LabBookingSchema.parse((await request_(patient, lab.slug, bookingBody([lab.cbc.id])).expect(201)).body);
    await http().post(`${base(lab.unitId)}/bookings/${a.id}/decision`).set('Cookie', lab.jar).send({ decision: 'reject' }).expect(400);
    await http()
      .post(`${base(lab.unitId)}/bookings/${a.id}/decision`)
      .set('Cookie', lab.jar)
      .send({ decision: 'reject', reason: 'Closed that day' })
      .expect(200);
    const rejected = LabBookingSchema.parse(
      (await http().get(`/api/v1/me/lab-bookings/${a.id}`).set('Authorization', patient.auth).expect(200)).body,
    );
    expect(rejected).toMatchObject({ status: 'rejected', rejectReason: 'Closed that day' });

    const b = LabBookingSchema.parse((await request_(patient, lab.slug, bookingBody([lab.cbc.id])).expect(201)).body);
    const cancelled = await http().post(`/api/v1/me/lab-bookings/${b.id}/cancel`).set('Authorization', patient.auth).expect(200);
    expect(LabBookingSchema.parse(cancelled.body).status).toBe('cancelled_by_patient');
    // The lab can no longer accept what the patient cancelled.
    await http().post(`${base(lab.unitId)}/bookings/${b.id}/decision`).set('Cookie', lab.jar).send({ decision: 'accept' }).expect(409);
  });

  it('checks the request: past days, unknown tests, and home collection rules', async () => {
    const lab = await labWithCatalogue('Rules Lab', 'Ballari');
    const patient = await login(app);
    const bad = (body: object) => request_(patient, lab.slug, body).expect(400);
    await bad(bookingBody([lab.cbc.id], { date: addDays(istDate(), -1) }));
    await bad(bookingBody([lab.cbc.id], { date: addDays(istDate(), 90) }));
    await bad(bookingBody(['b'.repeat(24)]));
    await bad(bookingBody([lab.cbc.id], { mode: 'home' })); // no address
    // Home collection needs every test to allow it.
    await bad(bookingBody([lab.cbc.id, lab.mri.id], { mode: 'home', address: '5 Park Street, Ballari' }));
    const home = LabBookingSchema.parse(
      (await request_(patient, lab.slug, bookingBody([lab.cbc.id], { mode: 'home', address: '5 Park Street, Ballari' })).expect(201)).body,
    );
    expect(home.collection).toMatchObject({ mode: 'home', address: '5 Park Street, Ballari' });
    await http().post('/api/v1/labs/' + lab.slug + '/bookings').send(bookingBody([lab.cbc.id])).expect(401);
  });

  it('requests nobody answers expire', async () => {
    const lab = await labWithCatalogue('Expiry Lab', 'Raichur');
    const patient = await login(app);
    const sent = LabBookingSchema.parse((await request_(patient, lab.slug, bookingBody([lab.cbc.id])).expect(201)).body);
    await db
      .collection('labBookings')
      .updateOne({ code: sent.code }, { $set: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    const seen = LabBookingSchema.parse(
      (await http().get(`/api/v1/me/lab-bookings/${sent.id}`).set('Authorization', patient.auth).expect(200)).body,
    );
    expect(seen.status).toBe('expired');
  });

  it('staff do only what their permissions allow, and can be assigned the collection', async () => {
    const lab = await labWithCatalogue('Staff Lab', 'Koppal');
    const make = async (username: string, permissions: string[]) => {
      const m = StaffMemberSchema.parse(
        (
          await http()
            .post(`/api/v1/console/workspaces/${lab.unitId}/staff`)
            .set('Cookie', lab.jar)
            .send({ name: username, username, password: STAFF_PASSWORD, permissions })
            .expect(201)
        ).body,
      );
      const jar = cookieJar(await post('console/auth/login', { identifier: username, password: STAFF_PASSWORD }).expect(200));
      return { ...m, jar };
    };
    const desk = await make('lab.desk', ['bookings']);
    const collector = await make('lab.collector', ['collection']);
    const bench = await make('lab.bench', ['reports']);
    const catalogue = await make('lab.catalogue', ['catalogue']);
    const clinicOnly = await http()
      .post(`/api/v1/console/workspaces/${lab.unitId}/staff`)
      .set('Cookie', lab.jar)
      .send({ name: 'X', username: 'wrong.kind', password: STAFF_PASSWORD, permissions: ['queue'] });
    expect(clinicOnly.status).toBe(400);

    const patient = await login(app);
    const sent = LabBookingSchema.parse((await request_(patient, lab.slug, bookingBody([lab.cbc.id])).expect(201)).body);
    const url = (suffix: string) => `${base(lab.unitId)}/bookings/${sent.id}/${suffix}`;

    // The front desk accepts; others cannot decide, the collector cannot touch the catalogue.
    await http().post(url('decision')).set('Cookie', collector.jar).send({ decision: 'accept' }).expect(403);
    await http().post(url('decision')).set('Cookie', desk.jar).send({ decision: 'accept' }).expect(200);
    await http().get(`${base(lab.unitId)}/catalogue`).set('Cookie', collector.jar).expect(403);
    await http().get(`${base(lab.unitId)}/catalogue`).set('Cookie', catalogue.jar).expect(200);
    await http().post(`${base(lab.unitId)}/tests`).set('Cookie', desk.jar).send({ name: 'Nope', pricePaise: 1 }).expect(403);

    // Collection: assign someone who collects (not the bench), then collect.
    const collectors = (
      await http().get(`${base(lab.unitId)}/collectors`).set('Cookie', desk.jar).expect(200)
    ).body as { items: { accountId: string }[] };
    const ownerMembership = await db
      .collection('memberships')
      .findOne({ unitId: new Types.ObjectId(lab.unitId), role: 'owner' });
    expect(collectors.items.map((c) => c.accountId).sort()).toEqual(
      [collector.accountId, ownerMembership!.accountId.toHexString()].sort(),
    );
    await http().put(url('assignee')).set('Cookie', desk.jar).send({ accountId: bench.accountId }).expect(400);
    const assigned = LabConsoleBookingSchema.parse(
      (await http().put(url('assignee')).set('Cookie', desk.jar).send({ accountId: collector.accountId }).expect(200)).body,
    );
    expect(assigned.assignedTo?.accountId).toBe(collector.accountId);
    await http().post(url('progress')).set('Cookie', desk.jar).send({ step: 'collected' }).expect(403);
    await http().post(url('progress')).set('Cookie', collector.jar).send({ step: 'collected' }).expect(200);

    // The bench starts processing and uploads; the collector cannot.
    await http().post(url('progress')).set('Cookie', bench.jar).send({ step: 'processing' }).expect(200);
    await http().put(url('report')).set('Cookie', collector.jar).attach('file', PDF, { filename: 'r.pdf', contentType: 'application/pdf' }).expect(403);
    await http().put(url('report')).set('Cookie', bench.jar).attach('file', PDF, { filename: 'r.pdf', contentType: 'application/pdf' }).expect(200);
    // Anyone with a booking permission sees the list; closing needs the front desk.
    await http().get(`${base(lab.unitId)}/bookings`).set('Cookie', bench.jar).expect(200);
    await http().post(url('progress')).set('Cookie', bench.jar).send({ step: 'completed' }).expect(403);
    await http().post(url('progress')).set('Cookie', desk.jar).send({ step: 'completed' }).expect(200);
    // Staff cannot reach another lab's bookings.
    const other = await labWithCatalogue('Other Lab', 'Bidar');
    await http().get(`${base(other.unitId)}/bookings`).set('Cookie', desk.jar).expect(404);
  });
});
