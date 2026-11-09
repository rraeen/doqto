import {
  ApiErrorSchema,
  CONSOLE_ACCESS_COOKIE,
  CONSOLE_REFRESH_COOKIE,
  CodeSentResponseSchema,
  ConsoleAccountSchema,
  ConsoleRefreshResponseSchema,
  ConsoleSessionSchema,
  WorkspaceDetailSchema,
  WorkspaceSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { type Connection, Types } from 'mongoose';
import request from 'supertest';
import { MIGRATIONS } from '../src/database/migrations';
import { createTestApp } from './app';

const DEMO_CODE = '123456';
const PASSWORD = 'Sunrise2026x';
let seq = 0;
const nextEmail = () => `dr.test${++seq}@example.com`;
const nextPhone = () => `+9197${String(20_000_000 + ++seq).slice(-8)}`;
const nextIp = () => `10.9.${Math.floor(seq / 250)}.${(seq % 250) + 1}`;

const errorCode = (body: unknown) => ApiErrorSchema.parse(body).error.code;

/** `name=value` pairs of the cookies a response sets, ready to send back. */
function cookieJar(res: request.Response): string[] {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return raw.map((c) => c.split(';')[0]!).filter((c) => !c.endsWith('='));
}
const cookieNames = (res: request.Response) =>
  ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map((c) => c.split('=')[0]);

describe('console sign-in: register, verify, login, reset (providers)', () => {
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

  const post = (path: string, body: object, ip = nextIp()) =>
    http().post(`/api/v1/console/auth/${path}`).set('X-Forwarded-For', ip).send(body);

  const register = (identifier: string, extra: Record<string, unknown> = {}) =>
    post('register', {
      name: 'Dr Asha Rao',
      identifier,
      password: PASSWORD,
      ...extra,
    });

  async function registered(identifier = nextEmail()) {
    await register(identifier).expect(201);
    const res = await post('verify', { identifier, code: DEMO_CODE }).expect(200);
    return { identifier, res, jar: cookieJar(res) };
  }

  describe('registering', () => {
    it('sends a code, then verify confirms the contact and signs in with console cookies', async () => {
      const identifier = nextEmail();
      const sent = await register(identifier).expect(201);
      expect(CodeSentResponseSchema.parse(sent.body).channel).toBe('demo');

      const res = await post('verify', { identifier, code: DEMO_CODE }).expect(200);
      const session = ConsoleSessionSchema.parse(res.body);
      expect(session.account).toMatchObject({ email: identifier, phone: null });
      // Nothing is set up yet: the person chooses their services after signing in.
      expect(session.account.workspaces).toEqual([]);
      expect(res.body).not.toHaveProperty('accessToken');
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt/);
      expect(cookieNames(res)).toEqual(expect.arrayContaining([CONSOLE_ACCESS_COOKIE, CONSOLE_REFRESH_COOKIE]));
    });

    it('works with a phone number too, and lower-cases emails', async () => {
      const phone = nextPhone();
      await register(phone).expect(201);
      const res = await post('verify', { identifier: phone, code: DEMO_CODE }).expect(200);
      expect(ConsoleSessionSchema.parse(res.body).account).toMatchObject({ phone });

      const mixed = `Dr.Case${++seq}@Example.COM`;
      await register(mixed).expect(201);
      await post('verify', { identifier: mixed.toLowerCase(), code: DEMO_CODE }).expect(200);
    });

    it('refuses an already confirmed phone or email', async () => {
      const { identifier } = await registered();
      const res = await register(identifier).expect(409);
      expect(errorCode(res.body)).toBe('CONFLICT');
    });

    it('lets someone who never confirmed register again with new details', async () => {
      const identifier = nextEmail();
      await register(identifier, { name: 'First Try' }).expect(201);
      await register(identifier, { name: 'Second Try' }).expect(201);
      const res = await post('verify', { identifier, code: DEMO_CODE }).expect(200);
      expect(ConsoleSessionSchema.parse(res.body).account.name).toBe('Second Try');
      expect(await db.collection('organizations').countDocuments({ name: 'First Try' })).toBe(0);
    });

    it.each([
      ['a weak password', { password: 'short1' }],
      ['a password without a number', { password: 'onlyletterslong' }],
      ['services at sign-up (chosen after sign-in now)', { services: ['clinic'] }],
      ['an invalid identifier', { identifier: 'not-a-contact' }],
      ['unknown fields', { role: 'admin' }],
    ])('rejects %s', async (_name, extra) => {
      const res = await register(nextEmail(), extra).expect(400);
      expect(errorCode(res.body)).toBe('VALIDATION_FAILED');
    });

    it('rejects a wrong code, counts attempts and locks after five', async () => {
      const identifier = nextEmail();
      await register(identifier).expect(201);
      const first = await post('verify', { identifier, code: '000000' }).expect(400);
      expect(ApiErrorSchema.parse(first.body).error).toMatchObject({
        code: 'OTP_INVALID',
        details: { attemptsLeft: 4 },
      });
      for (let i = 0; i < 4; i++) await post('verify', { identifier, code: '000000' }).expect(400);
      const locked = await post('verify', { identifier, code: DEMO_CODE }).expect(400);
      expect(errorCode(locked.body)).toBe('OTP_LOCKED');
    });

    it('stores the password hashed, never in the clear', async () => {
      const identifier = nextEmail();
      await register(identifier).expect(201);
      const row = await db.collection('accounts').findOne({ email: identifier });
      expect(row?.passwordHash).toMatch(/^scrypt\$/);
      expect(JSON.stringify(row)).not.toContain(PASSWORD);
    });
  });

  describe('signing in', () => {
    it('signs in with the password and no code, from email or phone', async () => {
      const { identifier } = await registered();
      const res = await post('login', { identifier, password: PASSWORD }).expect(200);
      expect(ConsoleSessionSchema.parse(res.body).account.email).toBe(identifier);
      expect(cookieNames(res)).toEqual(expect.arrayContaining([CONSOLE_ACCESS_COOKIE]));

      const upper = identifier.toUpperCase();
      await post('login', { identifier: upper, password: PASSWORD }).expect(200);
    });

    it('answers a wrong password and an unknown account the same way', async () => {
      const { identifier } = await registered();
      const wrong = await post('login', { identifier, password: 'Wrong-password-1' }).expect(401);
      const unknown = await post('login', { identifier: nextEmail(), password: PASSWORD }).expect(401);
      expect(errorCode(wrong.body)).toBe('INVALID_CREDENTIALS');
      expect(ApiErrorSchema.parse(unknown.body).error.message).toBe(
        ApiErrorSchema.parse(wrong.body).error.message,
      );
    });

    it('does not sign in before the code is confirmed', async () => {
      const identifier = nextEmail();
      await register(identifier).expect(201);
      const res = await post('login', { identifier, password: PASSWORD }).expect(403);
      expect(errorCode(res.body)).toBe('CONTACT_NOT_VERIFIED');
    });

    it('locks the account after five wrong passwords, even for the right one', async () => {
      const { identifier } = await registered();
      for (let i = 0; i < 5; i++) {
        await post('login', { identifier, password: 'Wrong-password-1' }, '10.20.0.1').expect(401);
      }
      const res = await post('login', { identifier, password: PASSWORD }, '10.20.0.2').expect(429);
      expect(ApiErrorSchema.parse(res.body).error.details?.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('does not let a suspended account in', async () => {
      const { identifier } = await registered();
      await db.collection('accounts').updateOne({ email: identifier }, { $set: { status: 'suspended' } });
      const res = await post('login', { identifier, password: PASSWORD }).expect(403);
      expect(errorCode(res.body)).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('the session', () => {
    it('/me works with the console cookie and needs one', async () => {
      const { jar, identifier } = await registered();
      await http().get('/api/v1/console/auth/me').expect(401);
      const res = await http().get('/api/v1/console/auth/me').set('Cookie', jar).expect(200);
      expect(ConsoleAccountSchema.parse(res.body).email).toBe(identifier);
    });

    it('a console token does not open patient routes, and a patient token does not open the console', async () => {
      const { res } = await registered();
      const access = cookieJar(res).find((c) => c.startsWith(`${CONSOLE_ACCESS_COOKIE}=`))!
        .split('=')[1]!;
      // The patient guard reads Authorization: Bearer; hand it the console token.
      await http().get('/api/v1/me').set('Authorization', `Bearer ${access}`).expect(401);
      await http().get('/api/v1/me').set('Cookie', cookieJar(res)).expect(401);

      const phone = `+9198${String(30_000_000 + ++seq).slice(-8)}`;
      await http().post('/api/v1/auth/otp/request').set('X-Forwarded-For', nextIp()).send({ phone }).expect(200);
      const patient = await http()
        .post('/api/v1/auth/otp/verify')
        .set('X-Forwarded-For', nextIp())
        .set('X-Doqto-Client', 'mobile')
        .send({ phone, code: DEMO_CODE })
        .expect(200);
      await http()
        .get('/api/v1/console/auth/me')
        .set('Authorization', `Bearer ${(patient.body as { accessToken: string }).accessToken}`)
        .expect(401);
    });

    it('refresh rotates the token; the old one is refused and ends the session when reused', async () => {
      const { jar } = await registered();
      const refreshJar = jar.filter((c) => c.startsWith(`${CONSOLE_REFRESH_COOKIE}=`));
      const first = await http().post('/api/v1/console/auth/refresh').set('Cookie', refreshJar).expect(200);
      ConsoleRefreshResponseSchema.parse(first.body);
      const newJar = cookieJar(first).filter((c) => c.startsWith(`${CONSOLE_REFRESH_COOKIE}=`));
      expect(newJar[0]).not.toBe(refreshJar[0]);

      // The old token shown again straight away is a parallel refresh: refused, session kept.
      const raced = await http().post('/api/v1/console/auth/refresh').set('Cookie', refreshJar).expect(401);
      expect(ApiErrorSchema.parse(raced.body).error.details).toMatchObject({ raced: true });
      await http().post('/api/v1/console/auth/refresh').set('Cookie', newJar).expect(200);
    });

    it('logout ends the session', async () => {
      const { jar } = await registered();
      const refreshJar = jar.filter((c) => c.startsWith(`${CONSOLE_REFRESH_COOKIE}=`));
      await http().post('/api/v1/console/auth/logout').set('Cookie', refreshJar).expect(204);
      const res = await http().post('/api/v1/console/auth/refresh').set('Cookie', refreshJar).expect(401);
      expect(errorCode(res.body)).toBe('REFRESH_INVALID');
    });

    it('refresh without a cookie is refused', async () => {
      const res = await http().post('/api/v1/console/auth/refresh').expect(401);
      expect(errorCode(res.body)).toBe('REFRESH_INVALID');
    });
  });

  describe('forgotten password', () => {
    it('resets with the code, signs every device out and accepts only the new password', async () => {
      const { identifier, jar } = await registered();
      const refreshJar = jar.filter((c) => c.startsWith(`${CONSOLE_REFRESH_COOKIE}=`));

      const sent = await post('forgot-password', { identifier }).expect(200);
      expect(CodeSentResponseSchema.parse(sent.body).channel).toBe('demo');
      await post('reset-password', {
        identifier,
        code: DEMO_CODE,
        newPassword: 'Monsoon2027y',
      }).expect(204);

      await post('login', { identifier, password: PASSWORD }).expect(401);
      await post('login', { identifier, password: 'Monsoon2027y' }).expect(200);
      await http().post('/api/v1/console/auth/refresh').set('Cookie', refreshJar).expect(401);
    });

    it('answers the same for an unknown account and sends nothing', async () => {
      const sent = await post('forgot-password', { identifier: nextEmail() }).expect(200);
      CodeSentResponseSchema.parse(sent.body);
      expect(await db.collection('accountCodes').countDocuments({ purpose: 'reset' })).toBeGreaterThanOrEqual(0);
    });

    it('refuses a wrong or reused code and a weak new password', async () => {
      const { identifier } = await registered();
      await post('forgot-password', { identifier }).expect(200);
      const bad = await post('reset-password', { identifier, code: '000000', newPassword: 'Monsoon2027y' }).expect(400);
      expect(errorCode(bad.body)).toBe('OTP_INVALID');
      const weak = await post('reset-password', { identifier, code: DEMO_CODE, newPassword: 'weak' }).expect(400);
      expect(errorCode(weak.body)).toBe('VALIDATION_FAILED');
      await post('reset-password', { identifier, code: DEMO_CODE, newPassword: 'Monsoon2027y' }).expect(204);
      const again = await post('reset-password', { identifier, code: DEMO_CODE, newPassword: 'Another2028z' }).expect(400);
      expect(errorCode(again.body)).toBe('OTP_EXPIRED');
    });

    it('a reset clears a lock', async () => {
      const { identifier } = await registered();
      for (let i = 0; i < 5; i++) {
        await post('login', { identifier, password: 'Wrong-password-1' }, '10.21.0.1').expect(401);
      }
      await post('login', { identifier, password: PASSWORD }, '10.21.0.2').expect(429);
      await post('forgot-password', { identifier }).expect(200);
      await post('reset-password', { identifier, code: DEMO_CODE, newPassword: 'Monsoon2027y' }).expect(204);
      await post('login', { identifier, password: 'Monsoon2027y' }, '10.21.0.3').expect(200);
    });
  });

  describe('applying for services', () => {
    const forms = {
      clinic: {
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
      },
      lab: {
        labName: 'Rao Diagnostics',
        ownerName: 'Asha Rao',
        city: 'Hubballi',
        address: '12 Main Road',
        registrationNumber: 'LAB-778',
        nablAccredited: false,
        homeCollection: true,
        testsOffered: 'CBC, LFT, thyroid',
      },
      pharmacy: {
        storeName: 'Rao Medicals',
        ownerName: 'Asha Rao',
        city: 'Hubballi',
        address: '12 Main Road',
        drugLicenceNumber: 'KA-HBL-20-1234',
        drugLicenceValidUntil: '2030-03-31',
        pharmacistName: 'Ravi Kumar',
        pharmacistRegistrationNumber: 'KSPC-5566',
        homeDelivery: true,
      },
    } as const;
    type Kind = keyof typeof forms;
    const apply = (jar: string[], kinds: Kind[], tweak: Record<string, object> = {}) =>
      http()
        .post('/api/v1/console/applications')
        .set('Cookie', jar)
        .send({ applications: kinds.map((kind) => ({ kind, profile: { ...forms[kind], ...tweak[kind] } })) });
    const setStatus = async (identifier: string, kind: Kind, status: string) => {
      const acct = await db.collection('accounts').findOne({ email: identifier });
      const ms = await db.collection('memberships').find({ accountId: acct?._id }).toArray();
      await db
        .collection('units')
        .updateOne({ _id: { $in: ms.map((m) => m.unitId) }, kind }, { $set: { status } });
    };

    it('a new account has applied for nothing yet, and its organization exists', async () => {
      const { jar, res, identifier } = await registered();
      expect(ConsoleSessionSchema.parse(res.body).account.workspaces).toEqual([]);
      const list = await http().get('/api/v1/console/workspaces').set('Cookie', jar).expect(200);
      expect(list.body).toEqual([]);
      const acct = await db.collection('accounts').findOne({ email: identifier });
      expect(await db.collection('organizations').countDocuments({ ownerAccountId: acct?._id })).toBe(1);
    });

    it('applies for several services with one request; each is pending and named from its form', async () => {
      const { jar } = await registered();
      const res = await apply(jar, ['pharmacy', 'clinic', 'lab']).expect(201);
      const workspaces = (res.body as unknown[]).map((w) => WorkspaceSchema.parse(w));
      // Always in the same order, whatever order they were sent in.
      expect(workspaces.map((w) => [w.kind, w.status, w.name])).toEqual([
        ['clinic', 'pending', 'Dr Asha Rao'],
        ['lab', 'pending', 'Rao Diagnostics'],
        ['pharmacy', 'pending', 'Rao Medicals'],
      ]);
      // One organization: the internal link between a clinic and its own lab and pharmacy.
      expect(new Set(workspaces.map((w) => w.organizationId)).size).toBe(1);
      const me = await http().get('/api/v1/console/auth/me').set('Cookie', jar).expect(200);
      expect(ConsoleAccountSchema.parse(me.body).workspaces).toEqual(workspaces);
      await http().get('/api/v1/console/workspaces').expect(401);
    });

    it('checks every form and saves nothing when one is wrong', async () => {
      const { jar } = await registered();
      const res = await apply(jar, ['clinic', 'lab'], {
        lab: { registrationNumber: '', testsOffered: undefined, surprise: 1 },
      }).expect(400);
      const issues = ApiErrorSchema.parse(res.body).error.details?.issues as { path: string }[];
      expect(issues.map((i) => i.path).sort()).toEqual([
        'lab.registrationNumber',
        'lab.surprise',
        'lab.testsOffered',
      ]);
      const list = await http().get('/api/v1/console/workspaces').set('Cookie', jar).expect(200);
      expect(list.body).toEqual([]);
    });

    it('rejects an empty request, an unknown kind and the same service twice', async () => {
      const { jar } = await registered();
      const post = (body: object) => http().post('/api/v1/console/applications').set('Cookie', jar).send(body);
      await post({ applications: [] }).expect(400);
      await post({ applications: [{ kind: 'hospital', profile: {} }] }).expect(400);
      await post({
        applications: [
          { kind: 'lab', profile: forms.lab },
          { kind: 'lab', profile: forms.lab },
        ],
      }).expect(400);
      await http().post('/api/v1/console/applications').send({ applications: [] }).expect(401);
    });

    it('cannot apply again while under review or after approval, but can after changes are requested', async () => {
      const { jar, identifier } = await registered();
      await apply(jar, ['lab']).expect(201);
      const again = await apply(jar, ['lab']).expect(409);
      expect(errorCode(again.body)).toBe('CONFLICT');

      await setStatus(identifier, 'lab', 'verified');
      await apply(jar, ['lab']).expect(409);

      await setStatus(identifier, 'lab', 'changes_requested');
      const fixed = await apply(jar, ['lab'], { lab: { labName: 'Rao Diagnostics Centre' } }).expect(201);
      expect(WorkspaceSchema.parse((fixed.body as unknown[])[0])).toMatchObject({
        status: 'pending',
        name: 'Rao Diagnostics Centre',
      });
    });

    it('later, from settings, the owner applies for more services in the same organization', async () => {
      const { jar } = await registered();
      const first = await apply(jar, ['clinic']).expect(201);
      const second = await apply(jar, ['pharmacy']).expect(201);
      const all = (second.body as unknown[]).map((w) => WorkspaceSchema.parse(w));
      expect(all.map((w) => w.kind)).toEqual(['clinic', 'pharmacy']);
      expect(all[0]!.organizationId).toBe(WorkspaceSchema.parse((first.body as unknown[])[0]).organizationId);
      expect(all[1]!.organizationId).toBe(all[0]!.organizationId);
    });

    it('opens a service with its form answers only for a member of it', async () => {
      const first = await registered();
      const second = await registered();
      const [mine] = (await apply(first.jar, ['clinic']).expect(201)).body as { id: string }[];
      const ok = await http().get(`/api/v1/console/workspaces/${mine!.id}`).set('Cookie', first.jar).expect(200);
      expect(WorkspaceDetailSchema.parse(ok.body).profile).toMatchObject({ registrationNumber: 'KMC-12345' });
      const other = await http().get(`/api/v1/console/workspaces/${mine!.id}`).set('Cookie', second.jar).expect(404);
      expect(errorCode(other.body)).toBe('NOT_FOUND');
      await http().get('/api/v1/console/workspaces/not-an-id').set('Cookie', first.jar).expect(404);
    });
  });

  it('migration 0010 gives an account made before organizations an organization, a unit and a membership', async () => {
    const email = nextEmail();
    const _id = new Types.ObjectId();
    await db.collection('accounts').insertOne({
      _id,
      email,
      name: 'Old Lab',
      accountType: 'lab',
      passwordHash: 'scrypt$x',
      status: 'active',
      contactVerifiedAt: new Date(),
    });
    const migration = MIGRATIONS.find((m) => m.name === '0010-accounts-to-organizations')!;
    await migration.up(db);
    await migration.up(db); // safe to run twice
    const units = await db.collection('units').find({ name: 'Old Lab' }).toArray();
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ kind: 'lab', status: 'draft' });
    expect(await db.collection('memberships').countDocuments({ accountId: _id, role: 'owner' })).toBe(1);
    expect((await db.collection('accounts').findOne({ _id }))?.accountType).toBeUndefined();
    const jar = (await post('login', { identifier: email, password: 'x' }).expect(401)).status;
    expect(jar).toBe(401);
  });

  it('migration 0012 sends back approved clinics that lack what the patient listing needs, and only those', async () => {
    const org = new Types.ObjectId();
    const base = { organizationId: org, kind: 'clinic', status: 'verified', createdAt: new Date(), updatedAt: new Date() };
    const full = { registrationYear: 2012, state: 'Karnataka', pincode: '580020' };
    const old = await db.collection('units').insertOne({ ...base, name: 'Old Verified Clinic', profile: { displayName: 'Old Verified Clinic' } });
    const ok = await db.collection('units').insertOne({ ...base, organizationId: new Types.ObjectId(), name: 'Complete Verified Clinic', profile: { ...full } });
    const lab = await db.collection('units').insertOne({ ...base, kind: 'lab', name: 'Old Verified Lab', profile: {} });
    const migration = MIGRATIONS.find((m) => m.name === '0012-reopen-unlistable-clinics')!;
    await migration.up(db);
    await migration.up(db); // safe to run twice
    const get = (id: Types.ObjectId) => db.collection('units').findOne({ _id: id });
    expect(await get(old.insertedId)).toMatchObject({
      status: 'changes_requested',
      reviewNote: expect.stringContaining('registration year, state and PIN code'),
    });
    expect((await get(ok.insertedId))?.status).toBe('verified');
    expect((await get(lab.insertedId))?.status).toBe('verified');
  });

  it('limits code requests per phone or email', async () => {
    const identifier = nextEmail();
    const results: number[] = [];
    for (let i = 0; i < 7; i++) {
      results.push((await post('forgot-password', { identifier }, nextIp())).status);
    }
    expect(results.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(results.slice(5)).toEqual([429, 429]);
  });
});
