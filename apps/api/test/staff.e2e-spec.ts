import {
  ApiErrorSchema,
  ApplicationListSchema,
  ConsoleAccountSchema,
  ConsoleSessionSchema,
  StaffMemberSchema,
  type StaffMember,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { type Connection } from 'mongoose';
import request from 'supertest';
import { createTestApp } from './app';

const DEMO_CODE = '123456';
const PASSWORD = 'Sunrise2026x';
const STAFF_PASSWORD = 'Temporary2026a';
let seq = 0;
const nextEmail = (p: string) => `${p}${++seq}@example.com`;
const nextIp = () => `10.50.${Math.floor(seq / 250)}.${(seq % 250) + 1}`;
const errorCode = (body: unknown) => ApiErrorSchema.parse(body).error.code;

function cookieJar(res: request.Response): string[] {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return raw.map((c) => c.split(';')[0]!).filter((c) => !c.endsWith('='));
}

const clinic = {
  displayName: 'Dr Staff Test',
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
const lab = {
  labName: 'Staff Test Diagnostics',
  ownerName: 'Asha Rao',
  city: 'Hubballi',
  address: '12 Main Road',
  registrationNumber: 'LAB-778',
  nablAccredited: false,
  homeCollection: true,
  testsOffered: 'CBC, LFT, thyroid',
};

describe('staff logins: the owner creates them and chooses what they can use', () => {
  let app: INestApplication;
  let db: Connection;
  let adminJar: string[];
  const http = () => request(app.getHttpServer());
  const post = (path: string, body: object) =>
    http().post(`/api/v1/${path}`).set('X-Forwarded-For', nextIp()).send(body);

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

  /** An owner with an approved service of each kind asked for. */
  async function owner(kinds: ('clinic' | 'lab')[] = ['clinic']) {
    const identifier = nextEmail('owner');
    await post('console/auth/register', { name: 'Owner', identifier, password: PASSWORD }).expect(201);
    const jar = cookieJar(await post('console/auth/verify', { identifier, code: DEMO_CODE }).expect(200));
    await http()
      .post('/api/v1/console/applications')
      .set('Cookie', jar)
      .send({
        applications: kinds.map((kind) => ({ kind, profile: kind === 'clinic' ? clinic : lab })),
      })
      .expect(201);
    const list = ApplicationListSchema.parse(
      (await http().get('/api/v1/platform/applications').set('Cookie', adminJar).expect(200)).body,
    );
    const ids: Record<string, string> = {};
    for (const i of list.items.filter((x) => x.applicant.email === identifier)) {
      await http()
        .post(`/api/v1/platform/applications/${i.id}/decision`)
        .set('Cookie', adminJar)
        .send({ decision: 'approve' })
        .expect(200);
      ids[i.kind] = i.id;
    }
    return { identifier, jar, ids };
  }

  const create = (jar: string[], unitId: string, body: object) =>
    http().post(`/api/v1/console/workspaces/${unitId}/staff`).set('Cookie', jar).send(body);

  async function staffLogin(username: string, password = STAFF_PASSWORD) {
    const res = await post('console/auth/login', { identifier: username, password }).expect(200);
    return { jar: cookieJar(res), res };
  }

  it('creates a staff login; the staff signs in by username and must pick a new password first', async () => {
    const o = await owner();
    const res = await create(o.jar, o.ids.clinic!, {
      name: 'Meena Front Desk',
      username: 'meena.desk',
      password: STAFF_PASSWORD,
      permissions: ['queue', 'appointments'],
    }).expect(201);
    expect(StaffMemberSchema.parse(res.body)).toMatchObject({
      username: 'meena.desk',
      permissions: ['queue', 'appointments'],
      mustChangePassword: true,
    });
    const hash = (await db.collection('accounts').findOne({ username: 'meena.desk' }))!.passwordHash;
    expect(hash).not.toContain(STAFF_PASSWORD);

    // Any letter case works at sign-in.
    const { jar, res: loginRes } = await staffLogin('Meena.Desk');
    const account = ConsoleSessionSchema.parse(loginRes.body).account;
    expect(account).toMatchObject({ username: 'meena.desk', mustChangePassword: true });
    expect(account.workspaces).toHaveLength(1);
    expect(account.workspaces[0]).toMatchObject({
      role: 'staff',
      kind: 'clinic',
      permissions: ['queue', 'appointments'],
    });

    await http()
      .post('/api/v1/console/auth/change-password')
      .set('Cookie', jar)
      .send({ currentPassword: STAFF_PASSWORD, newPassword: STAFF_PASSWORD })
      .expect(400);
    await http()
      .post('/api/v1/console/auth/change-password')
      .set('Cookie', jar)
      .send({ currentPassword: 'wrong-password1', newPassword: 'Another2026pass' })
      .expect(401);
    await http()
      .post('/api/v1/console/auth/change-password')
      .set('Cookie', jar)
      .send({ currentPassword: STAFF_PASSWORD, newPassword: 'Another2026pass' })
      .expect(204);
    const me = ConsoleAccountSchema.parse(
      (await http().get('/api/v1/console/auth/me').set('Cookie', jar).expect(200)).body,
    );
    expect(me.mustChangePassword).toBe(false);
    await post('console/auth/login', { identifier: 'meena.desk', password: STAFF_PASSWORD }).expect(401);
    await staffLogin('meena.desk', 'Another2026pass');
  });

  it('staff can use only what was switched on; the owner can use everything', async () => {
    const o = await owner();
    const unit = o.ids.clinic!;
    await create(o.jar, unit, {
      name: 'Queue Only',
      username: 'queue.only',
      password: STAFF_PASSWORD,
      permissions: ['queue'],
    }).expect(201);
    const { jar } = await staffLogin('queue.only');
    const base = `/api/v1/console/workspaces/${unit}`;

    // Allowed: the day sheet (queue is enough for it).
    await http().get(`${base}/appointments`).set('Cookie', jar).expect((r) => {
      if (r.status === 403) throw new Error('queue should open the day sheet');
    });
    // Not allowed: confirming bookings, messages, schedule and the profile.
    const denied = async (req: request.Test) => {
      const r = await req;
      expect(r.status).toBe(403);
      expect(errorCode(r.body)).toBe('FORBIDDEN');
    };
    await denied(http().post(`${base}/appointments/000000000000000000000000/confirm`).set('Cookie', jar));
    await denied(http().get(`${base}/chats`).set('Cookie', jar));
    await denied(http().get(`${base}/schedule`).set('Cookie', jar));
    await denied(http().get(`${base}/profile`).set('Cookie', jar));
    await denied(http().put(`${base}/profile`).set('Cookie', jar).send({ profile: clinic }));
    await denied(http().delete(`${base}/profile`).set('Cookie', jar));
    // Never reachable for staff: managing staff.
    await denied(http().get(`${base}/staff`).set('Cookie', jar));
    await denied(
      create(jar, unit, { name: 'Sneaky', username: 'sneaky.one', password: STAFF_PASSWORD, permissions: [] }),
    );
    // The owner still has all of it.
    await http().get(`${base}/schedule`).set('Cookie', o.jar).expect(200);
    await http().get(`${base}/chats`).set('Cookie', o.jar).expect(200);
    await http().get(`${base}/profile`).set('Cookie', o.jar).expect(200);
  });

  it('permissions can be changed and take effect on the next request', async () => {
    const o = await owner();
    const unit = o.ids.clinic!;
    const made = StaffMemberSchema.parse(
      (
        await create(o.jar, unit, {
          name: 'Later Messages',
          username: 'later.msgs',
          password: STAFF_PASSWORD,
          permissions: ['queue'],
        }).expect(201)
      ).body,
    );
    const { jar } = await staffLogin('later.msgs');
    await http().get(`/api/v1/console/workspaces/${unit}/chats`).set('Cookie', jar).expect(403);
    const patched = await http()
      .patch(`/api/v1/console/workspaces/${unit}/staff/${made.accountId}`)
      .set('Cookie', o.jar)
      .send({ permissions: ['queue', 'messages'] })
      .expect(200);
    expect(StaffMemberSchema.parse(patched.body).permissions).toEqual(['queue', 'messages']);
    await http().get(`/api/v1/console/workspaces/${unit}/chats`).set('Cookie', jar).expect(200);
  });

  it('refuses permissions that do not belong to this kind of service, and taken usernames', async () => {
    const o = await owner();
    const unit = o.ids.clinic!;
    const bad = await create(o.jar, unit, {
      name: 'Wrong Kind',
      username: 'wrong.kind',
      password: STAFF_PASSWORD,
      permissions: ['reports'],
    }).expect(400);
    expect(errorCode(bad.body)).toBe('VALIDATION_FAILED');
    await create(o.jar, unit, { name: 'X', username: 'bad name', password: STAFF_PASSWORD, permissions: [] }).expect(400);
    await create(o.jar, unit, { name: 'Weak', username: 'weak.pass', password: 'short', permissions: [] }).expect(400);

    await create(o.jar, unit, { name: 'First', username: 'taken.name', password: STAFF_PASSWORD, permissions: [] }).expect(201);
    const other = await owner();
    const dup = await create(other.jar, other.ids.clinic!, {
      name: 'Second',
      username: 'taken.name',
      password: STAFF_PASSWORD,
      permissions: [],
    }).expect(409);
    expect(errorCode(dup.body)).toBe('CONFLICT');
    // Staff of a business belong to that business only.
    await http().get(`/api/v1/console/workspaces/${unit}/staff`).set('Cookie', other.jar).expect(404);
  });

  it('one staff login can serve two services of the same owner, each with its own permissions', async () => {
    const o = await owner(['clinic', 'lab']);
    await create(o.jar, o.ids.clinic!, {
      name: 'Both Desks',
      username: 'both.desks',
      password: STAFF_PASSWORD,
      permissions: ['queue'],
    }).expect(201);
    // Adding the same username to the lab keeps the one login (the password is left alone).
    await create(o.jar, o.ids.lab!, {
      name: 'Both Desks',
      username: 'both.desks',
      password: 'Ignored2026pass',
      permissions: ['bookings', 'collection'],
    }).expect(201);
    expect(await db.collection('accounts').countDocuments({ username: 'both.desks' })).toBe(1);
    const { res } = await staffLogin('both.desks');
    const ws = ConsoleSessionSchema.parse(res.body).account.workspaces;
    expect(ws.map((w) => [w.kind, w.permissions])).toEqual([
      ['clinic', ['queue']],
      ['lab', ['bookings', 'collection']],
    ]);
  });

  it('the owner resets a password; removing the last service switches the login off', async () => {
    const o = await owner();
    const unit = o.ids.clinic!;
    const made = StaffMemberSchema.parse(
      (
        await create(o.jar, unit, {
          name: 'Reset Me',
          username: 'reset.me',
          password: STAFF_PASSWORD,
          permissions: ['queue'],
        }).expect(201)
      ).body,
    );
    const { jar } = await staffLogin('reset.me');
    await http()
      .post(`/api/v1/console/workspaces/${unit}/staff/${made.accountId}/reset-password`)
      .set('Cookie', o.jar)
      .send({ password: 'Fresh2026reset' })
      .expect(204);
    // Old sessions are gone and the old password no longer works.
    await http().post('/api/v1/console/auth/refresh').set('Cookie', jar).expect(401);
    await post('console/auth/login', { identifier: 'reset.me', password: STAFF_PASSWORD }).expect(401);
    const again = await staffLogin('reset.me', 'Fresh2026reset');
    expect(ConsoleSessionSchema.parse(again.res.body).account.mustChangePassword).toBe(true);

    await http()
      .delete(`/api/v1/console/workspaces/${unit}/staff/${made.accountId}`)
      .set('Cookie', o.jar)
      .expect(204);
    const gone = await post('console/auth/login', { identifier: 'reset.me', password: 'Fresh2026reset' });
    expect(gone.status).toBe(403);
    expect(errorCode(gone.body)).toBe('ACCOUNT_SUSPENDED');
    const list = (
      await http().get(`/api/v1/console/workspaces/${unit}/staff`).set('Cookie', o.jar).expect(200)
    ).body as { items: StaffMember[] };
    expect(list.items.find((s) => s.username === 'reset.me')).toBeUndefined();
  });

  it('a username cannot be used with the code-based routes', async () => {
    await post('console/auth/forgot-password', { identifier: 'meena.desk' }).expect(400);
  });
});
