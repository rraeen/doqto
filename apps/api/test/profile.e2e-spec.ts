import {
  ApiErrorSchema,
  ApplicationListSchema,
  MyProfileSchema,
  ProfileChangeDetailSchema,
  ProfileChangeListSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { JPEG } from '../src/integrations/storage/test-files';
import { createTestApp } from './app';

const DEMO_CODE = '123456';
const PASSWORD = 'Sunrise2026x';
let seq = 0;
const nextEmail = (p: string) => `${p}${++seq}@example.com`;
const nextIp = () => `10.50.${Math.floor(seq / 250)}.${(seq % 250) + 1}`;
const errorCode = (body: unknown) => ApiErrorSchema.parse(body).error.code;
const clinic = {
  displayName: 'Dr Profile Doctor',
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

function cookieJar(res: request.Response): string[] {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return raw.map((c) => c.split(';')[0]!).filter((c) => !c.endsWith('='));
}

describe("the doctor's profile: edits wait for the Doqto team before patients see them", () => {
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

  async function provider(name = 'Rao Hospital') {
    const identifier = nextEmail('prov');
    await post('console/auth/register', { name, identifier, password: PASSWORD }).expect(201);
    const res = await post('console/auth/verify', { identifier, code: DEMO_CODE }).expect(200);
    return { identifier, jar: cookieJar(res) };
  }
  async function admin() {
    const a = await provider('Admin Person');
    await db
      .collection('accounts')
      .updateOne({ email: a.identifier }, { $set: { platformRole: 'admin' } });
    return cookieJar(
      await post('console/auth/login', { identifier: a.identifier, password: PASSWORD }).expect(
        200,
      ),
    );
  }
  /** An approved doctor and the team member who approved them. */
  async function approvedDoctor(name: string) {
    const adminJar = await admin();
    const rao = await provider();
    await http()
      .post('/api/v1/console/applications')
      .set('Cookie', rao.jar)
      .send({ applications: [{ kind: 'clinic', profile: { ...clinic, displayName: name } }] })
      .expect(201);
    const list = ApplicationListSchema.parse(
      (
        await http()
          .get('/api/v1/platform/applications?kind=clinic')
          .set('Cookie', adminJar)
          .expect(200)
      ).body,
    );
    const unitId = list.items.find((i) => i.applicant.email === rao.identifier)!.id;
    return { adminJar, rao, unitId };
  }
  const approve = (d: { adminJar: string[]; unitId: string }) =>
    http()
      .post(`/api/v1/platform/applications/${d.unitId}/decision`)
      .set('Cookie', d.adminJar)
      .send({ decision: 'approve' })
      .expect(200);
  const profileUrl = (unitId: string) => `/api/v1/console/workspaces/${unitId}/profile`;
  /** What a patient sees on the doctor's page. */
  async function publicPage(unitId: string) {
    const doc = (await db.collection('doctors').findOne({ unitId: new Types.ObjectId(unitId) }))!;
    const res = await http()
      .get(`/api/v1/doctors/${String(doc.slug)}`)
      .set('X-Forwarded-For', nextIp())
      .expect(200);
    return res.body as {
      name: string;
      bio: string | null;
      consultFee: number | null;
      photoUrl: string | null;
      experienceYears: number | null;
    };
  }

  it('opens only after approval, and only for the owner of that clinic service', async () => {
    const d = await approvedDoctor('Dr Profile Gate');
    // Not approved yet.
    expect(
      errorCode((await http().get(profileUrl(d.unitId)).set('Cookie', d.rao.jar).expect(403)).body),
    ).toBe('FORBIDDEN');
    await approve(d);
    const mine = MyProfileSchema.parse(
      (await http().get(profileUrl(d.unitId)).set('Cookie', d.rao.jar).expect(200)).body,
    );
    expect(mine).toMatchObject({
      pending: null,
      listed: true,
      current: {
        photoUrl: null,
        profile: { displayName: 'Dr Profile Gate', consultationFeeRupees: 300 },
      },
    });

    const other = await provider();
    await http().get(profileUrl(d.unitId)).set('Cookie', other.jar).expect(404);
    await http()
      .put(profileUrl(d.unitId))
      .set('Cookie', other.jar)
      .send({ profile: clinic })
      .expect(404);
    await http().get(profileUrl(d.unitId)).expect(401);
    // A lab has no doctor profile.
    await http()
      .post('/api/v1/console/applications')
      .set('Cookie', other.jar)
      .send({
        applications: [
          {
            kind: 'lab',
            profile: {
              labName: 'L',
              ownerName: 'O',
              city: 'Hubballi',
              address: 'A road',
              registrationNumber: 'L1',
              nablAccredited: false,
              homeCollection: false,
              testsOffered: 'CBC',
            },
          },
        ],
      })
      .expect(201);
    const labs = ApplicationListSchema.parse(
      (
        await http()
          .get('/api/v1/platform/applications?kind=lab')
          .set('Cookie', d.adminJar)
          .expect(200)
      ).body,
    );
    await http().get(profileUrl(labs.items[0]!.id)).set('Cookie', other.jar).expect(404);
  });

  it('keeps edits and a new photo as a pending change; patients see nothing until it is approved', async () => {
    const d = await approvedDoctor('Dr Profile Edit');
    await approve(d);
    const before = await publicPage(d.unitId);
    expect(before).toMatchObject({ bio: null, photoUrl: null, consultFee: 30000 });

    // Saving without a change, or with a bad answer, is refused.
    await http()
      .put(profileUrl(d.unitId))
      .set('Cookie', d.rao.jar)
      .send({ profile: { ...clinic, displayName: 'Dr Profile Edit' } })
      .expect(400);
    const bad = await http()
      .put(profileUrl(d.unitId))
      .set('Cookie', d.rao.jar)
      .send({ profile: { ...clinic, displayName: 'Dr Profile Edit', pincode: '12' } })
      .expect(400);
    expect(errorCode(bad.body)).toBe('VALIDATION_FAILED');

    const edited = {
      ...clinic,
      displayName: 'Dr Profile Edit',
      about: 'Twelve years of family medicine.',
      languages: 'English, Hindi, Kannada',
      experienceYears: 13,
      consultationFeeRupees: 400,
    };
    const saved = MyProfileSchema.parse(
      (
        await http()
          .put(profileUrl(d.unitId))
          .set('Cookie', d.rao.jar)
          .send({ profile: edited })
          .expect(200)
      ).body,
    );
    expect(saved.pending).toMatchObject({
      status: 'pending',
      photoChanged: false,
      reviewNote: null,
    });
    expect(saved.pending!.changedFields.sort()).toEqual([
      'about',
      'consultationFeeRupees',
      'experienceYears',
      'languages',
    ]);
    expect(saved.current.profile).toMatchObject({ consultationFeeRupees: 300 });

    // A photo: wrong type is refused, a real one joins the pending change.
    await http()
      .put(`${profileUrl(d.unitId)}/photo`)
      .set('Cookie', d.rao.jar)
      .attach('file', Buffer.from('not an image'), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(400);
    await http()
      .put(`${profileUrl(d.unitId)}/photo`)
      .set('Cookie', d.rao.jar)
      .expect(400);
    const withPhoto = MyProfileSchema.parse(
      (
        await http()
          .put(`${profileUrl(d.unitId)}/photo`)
          .set('Cookie', d.rao.jar)
          .attach('file', JPEG, { filename: 'me.jpg', contentType: 'image/jpeg' })
          .expect(200)
      ).body,
    );
    expect(withPhoto.pending).toMatchObject({
      photoChanged: true,
      profile: { about: 'Twelve years of family medicine.' },
    });
    expect(withPhoto.pending!.photoUrl).toEqual(expect.stringContaining('http'));
    expect(withPhoto.current.photoUrl).toBeNull();

    // Patients still see exactly what they saw before.
    expect(await publicPage(d.unitId)).toEqual(before);
  });

  it('the team sees the change next to the current profile, and approving puts it on the patient page', async () => {
    const d = await approvedDoctor('Dr Profile Approve');
    await approve(d);
    const edited = {
      ...clinic,
      displayName: 'Dr Profile Approved Name',
      about: 'Careful and patient.',
      consultationFeeRupees: 500,
    };
    await http()
      .put(profileUrl(d.unitId))
      .set('Cookie', d.rao.jar)
      .send({ profile: edited })
      .expect(200);
    await http()
      .put(`${profileUrl(d.unitId)}/photo`)
      .set('Cookie', d.rao.jar)
      .attach('file', JPEG, { filename: 'me.jpg', contentType: 'image/jpeg' })
      .expect(200);

    // Only the team can see the queue.
    await http().get('/api/v1/platform/profile-changes').set('Cookie', d.rao.jar).expect(403);
    await http().get('/api/v1/platform/profile-changes').expect(401);
    const queue = ProfileChangeListSchema.parse(
      (await http().get('/api/v1/platform/profile-changes').set('Cookie', d.adminJar).expect(200))
        .body,
    );
    expect(queue.items.map((i) => i.id)).toContain(d.unitId);
    const detail = ProfileChangeDetailSchema.parse(
      (
        await http()
          .get(`/api/v1/platform/profile-changes/${d.unitId}`)
          .set('Cookie', d.adminJar)
          .expect(200)
      ).body,
    );
    expect(detail).toMatchObject({
      photoChanged: true,
      current: { photoUrl: null, profile: { consultationFeeRupees: 300 } },
      proposed: {
        profile: { consultationFeeRupees: 500, displayName: 'Dr Profile Approved Name' },
      },
    });
    expect(detail.changedFields.sort()).toEqual(['about', 'consultationFeeRupees', 'displayName']);

    await http()
      .post(`/api/v1/platform/profile-changes/${d.unitId}/decision`)
      .set('Cookie', d.rao.jar)
      .send({ decision: 'approve' })
      .expect(403);
    await http()
      .post(`/api/v1/platform/profile-changes/${d.unitId}/decision`)
      .set('Cookie', d.adminJar)
      .send({ decision: 'approve' })
      .expect(200);

    const page = await publicPage(d.unitId);
    expect(page).toMatchObject({
      name: 'Dr Profile Approved Name',
      bio: 'Careful and patient.',
      consultFee: 50000,
    });
    expect(page.photoUrl).toEqual(detail.proposed.photoUrl);
    const after = MyProfileSchema.parse(
      (await http().get(profileUrl(d.unitId)).set('Cookie', d.rao.jar).expect(200)).body,
    );
    expect(after).toMatchObject({
      pending: null,
      listed: true,
      current: { photoUrl: detail.proposed.photoUrl, profile: { consultationFeeRupees: 500 } },
    });
    // The service shows the new name, the queue is empty again, and a second decision is refused.
    expect(
      (await db.collection('units').findOne({ _id: new Types.ObjectId(d.unitId) }))!.name,
    ).toBe('Dr Profile Approved Name');
    await http()
      .get(`/api/v1/platform/profile-changes/${d.unitId}`)
      .set('Cookie', d.adminJar)
      .expect(404);
    await http()
      .post(`/api/v1/platform/profile-changes/${d.unitId}/decision`)
      .set('Cookie', d.adminJar)
      .send({ decision: 'approve' })
      .expect(404);
    expect(
      await db.collection('auditLogs').countDocuments({
        action: 'profile_change.approve',
        entityId: new Types.ObjectId(d.unitId),
      }),
    ).toBe(1);
  });

  it('a rejection keeps the old profile, tells the doctor why, and the doctor can edit again or withdraw', async () => {
    const d = await approvedDoctor('Dr Profile Reject');
    await approve(d);
    const edited = {
      ...clinic,
      displayName: 'Dr Profile Reject',
      about: 'Cures everything instantly.',
    };
    await http()
      .put(profileUrl(d.unitId))
      .set('Cookie', d.rao.jar)
      .send({ profile: edited })
      .expect(200);
    const decide = (body: object) =>
      http()
        .post(`/api/v1/platform/profile-changes/${d.unitId}/decision`)
        .set('Cookie', d.adminJar)
        .send(body);

    // A reason is needed.
    expect(errorCode((await decide({ decision: 'reject' }).expect(400)).body)).toBe(
      'VALIDATION_FAILED',
    );
    await decide({ decision: 'reject', note: 'no' }).expect(400);
    await decide({ decision: 'reject', note: 'Remove the claim of instant cures.' }).expect(200);

    const mine = MyProfileSchema.parse(
      (await http().get(profileUrl(d.unitId)).set('Cookie', d.rao.jar).expect(200)).body,
    );
    expect(mine.pending).toMatchObject({
      status: 'rejected',
      reviewNote: 'Remove the claim of instant cures.',
    });
    expect((await publicPage(d.unitId)).bio).toBeNull();
    // It is out of the team's queue.
    const queue = ProfileChangeListSchema.parse(
      (await http().get('/api/v1/platform/profile-changes').set('Cookie', d.adminJar).expect(200))
        .body,
    );
    expect(queue.items.map((i) => i.id)).not.toContain(d.unitId);
    await decide({ decision: 'approve' }).expect(404);

    // The doctor edits again: back in the queue, note gone.
    const again = MyProfileSchema.parse(
      (
        await http()
          .put(profileUrl(d.unitId))
          .set('Cookie', d.rao.jar)
          .send({ profile: { ...edited, about: 'Family doctor for twelve years.' } })
          .expect(200)
      ).body,
    );
    expect(again.pending).toMatchObject({ status: 'pending', reviewNote: null });
    expect(
      ProfileChangeListSchema.parse(
        (await http().get('/api/v1/platform/profile-changes').set('Cookie', d.adminJar).expect(200))
          .body,
      ).items.map((i) => i.id),
    ).toContain(d.unitId);

    // Withdrawing clears it.
    const gone = MyProfileSchema.parse(
      (await http().delete(profileUrl(d.unitId)).set('Cookie', d.rao.jar).expect(200)).body,
    );
    expect(gone.pending).toBeNull();
    await decide({ decision: 'approve' }).expect(404);
  });

  it('taking a doctor off the site and approving the change later keeps them off until re-approved', async () => {
    const d = await approvedDoctor('Dr Profile Suspended');
    await approve(d);
    await http()
      .put(profileUrl(d.unitId))
      .set('Cookie', d.rao.jar)
      .send({ profile: { ...clinic, displayName: 'Dr Profile Suspended', about: 'New text.' } })
      .expect(200);
    // The application is sent back: the doctor is unlisted and the profile is closed.
    await http()
      .post(`/api/v1/platform/applications/${d.unitId}/decision`)
      .set('Cookie', d.adminJar)
      .send({ decision: 'request_changes', note: 'Please re-check your registration.' })
      .expect(200);
    await http()
      .put(profileUrl(d.unitId))
      .set('Cookie', d.rao.jar)
      .send({ profile: { ...clinic, displayName: 'Dr Profile Suspended', about: 'Other.' } })
      .expect(403);
    await http()
      .post(`/api/v1/platform/profile-changes/${d.unitId}/decision`)
      .set('Cookie', d.adminJar)
      .send({ decision: 'approve' })
      .expect(404);
    expect(
      (await db.collection('doctors').findOne({ unitId: new Types.ObjectId(d.unitId) }))!.isListed,
    ).toBe(false);
  });
});
