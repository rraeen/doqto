import { type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { type Connection, type Model, Types } from 'mongoose';
import { MigrationRunner } from '../src/database/migration-runner.service';
import { User } from '../src/users/user.schema';
import { createTestApp } from './app';

describe('database layer (BE-03)', () => {
  let app: INestApplication;
  let connection: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    connection = app.get<Connection>(getConnectionToken());
  });
  afterAll(async () => {
    await connection.dropDatabase();
    await app.close();
  });

  async function indexes(collection: string) {
    return connection.collection(collection).indexes();
  }

  it('records applied migrations and is idempotent', async () => {
    const records = await connection.collection('migrations').find().toArray();
    expect(records.map((r) => r._id)).toContain('0001-sprint1-auth-indexes');
    expect(await app.get(MigrationRunner).runPending()).toEqual([]);
  });

  it('creates every index from migrations even with autoIndex off', async () => {
    const collections = [
      'users',
      'otps',
      'refreshTokens',
      'doctors',
      'clinics',
      'auditLogs',
      'schedules',
      'appointments',
      'doctorStatus',
      'statusEvents',
      'jobs',
      'notifications',
    ];
    for (const c of collections) {
      await connection.createCollection(c).catch(() => undefined);
      await connection.collection(c).dropIndexes();
    }
    await connection.collection('migrations').deleteMany({});
    expect(await app.get(MigrationRunner).runPending()).toEqual([
      '0001-sprint1-auth-indexes',
      '0002-sprint2-doctor-clinic-indexes',
      '0003-sprint3-clinic-console-indexes',
      '0004-sprint4-notifications-indexes',
      '0005-sprint5-booking-indexes',
      '0006-sprint6-review-indexes',
      '0007-sprint7-record-indexes',
      '0008-console-account-indexes',
      '0009-organization-unit-membership-indexes',
      '0010-accounts-to-organizations',
      '0011-doctor-partial-indexes',
      '0012-reopen-unlistable-clinics',
      '0013-chat-message-indexes',
      '0014-lab-indexes',
      '0015-list-approved-labs',
    ]);
    const names = async (c: string) =>
      (await indexes(c)).map((i) => `${JSON.stringify(i.key)}${i.unique ? ' unique' : ''}`);
    expect(await names('users')).toContain('{"phone":1} unique');
    expect(await names('doctors')).toEqual(
      expect.arrayContaining([
        '{"slug":1} unique',
        '{"userId":1} unique',
        '{"isListed":1,"city":1,"specialties":1}',
        '{"verification.status":1,"createdAt":1}',
      ]),
    );
    expect(await names('clinics')).toEqual(
      expect.arrayContaining([
        '{"location":"2dsphere"}',
        '{"address.city":1}',
        '{"staffUserIds":1}',
      ]),
    );
    expect(await names('auditLogs')).toEqual(
      expect.arrayContaining([
        '{"entity":1,"entityId":1,"at":-1}',
        '{"actorUserId":1,"at":-1}',
        '{"at":1}',
      ]),
    );
    expect(await names('appointments')).toContain('{"doctorId":1,"slotStart":1} unique');
    expect(await names('doctorStatus')).toContain('{"doctorId":1,"date":1} unique');
    expect(await names('schedules')).toContain('{"doctorId":1,"clinicId":1} unique');
    expect(await names('jobs')).toContain('{"status":1,"runAt":1}');
    expect(await names('notifications')).toEqual(
      expect.arrayContaining([
        '{"dedupeKey":1} unique',
        '{"status":1,"sendAfter":1}',
        '{"providerMessageId":1}',
        '{"createdAt":1}',
      ]),
    );
  });

  it('users: unique phone, roles+status index, isDemo flag', async () => {
    const users = app.get<Model<User>>(getModelToken(User.name));
    const u = await users.create({ phone: '+919800000001' });
    expect(u.isDemo).toBe(false);
    expect(u.roles).toEqual(['patient']);
    expect(u.language).toBe('en');
    await expect(users.create({ phone: '+919800000001' })).rejects.toMatchObject({ code: 11000 });
    expect((await indexes('users')).some((i) => i.key.roles === 1 && i.key.status === 1)).toBe(
      true,
    );
  });

  it('otps: TTL on expiresAt and one row per phone and purpose', async () => {
    const idx = await indexes('otps');
    expect(idx.find((i) => i.key.expiresAt === 1)?.expireAfterSeconds).toBe(0);
    expect(idx.find((i) => i.key.phone === 1 && i.key.purpose === 1)?.unique).toBe(true);
  });

  it('otps and refreshTokens reject duplicates on their unique indexes', async () => {
    const soon = new Date(Date.now() + 60_000);
    const otp = {
      phone: '+919800000003',
      purpose: 'login',
      codeHash: 'h',
      attempts: 0,
      expiresAt: soon,
    };
    await connection.collection('otps').insertOne({ ...otp });
    await expect(connection.collection('otps').insertOne({ ...otp })).rejects.toMatchObject({
      code: 11000,
    });
    const rt = {
      userId: new Types.ObjectId(),
      familyId: new Types.ObjectId(),
      tokenHash: 'dup',
      expiresAt: soon,
    };
    await connection.collection('refreshTokens').insertOne({ ...rt });
    await expect(
      connection.collection('refreshTokens').insertOne({ ...rt, userId: new Types.ObjectId() }),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('refreshTokens: unique tokenHash, userId index, TTL', async () => {
    const idx = await indexes('refreshTokens');
    expect(idx.find((i) => i.key.tokenHash === 1)?.unique).toBe(true);
    expect(idx.some((i) => i.key.userId === 1)).toBe(true);
    expect(idx.find((i) => i.key.expiresAt === 1)?.expireAfterSeconds).toBe(0);
  });

  it('rejects fields not in the schema (strict)', async () => {
    const users = app.get<Model<User>>(getModelToken(User.name));
    const u = await users.create({ phone: '+919800000002', diagnosis: 'x' } as Partial<User>);
    const raw = await connection.collection('users').findOne({ _id: u._id });
    expect(raw).not.toHaveProperty('diagnosis');
  });

  it('doctors (BE-06): unique slug and userId, listing, admin queue and text indexes', async () => {
    const idx = await indexes('doctors');
    expect(idx.find((i) => i.key.slug === 1)?.unique).toBe(true);
    expect(idx.find((i) => i.key.userId === 1)?.unique).toBe(true);
    expect(
      idx.some((i) => i.key.isListed === 1 && i.key.city === 1 && i.key.specialties === 1),
    ).toBe(true);
    expect(idx.some((i) => i.key['verification.status'] === 1 && i.key.createdAt === 1)).toBe(true);
    expect(idx.some((i) => i.name === 'doctor_text')).toBe(true);

    const doc = (userId: Types.ObjectId, slug: string) => ({
      userId,
      slug,
      name: 'Dr A',
      registration: { council: 'NMC', number: '1', year: 2010 },
    });
    const doctors = connection.collection('doctors');
    const u1 = new Types.ObjectId();
    await doctors.insertOne(doc(u1, 'dr-a-x'));
    await expect(doctors.insertOne(doc(new Types.ObjectId(), 'dr-a-x'))).rejects.toMatchObject({
      code: 11000,
    });
    await expect(doctors.insertOne(doc(u1, 'dr-a-y'))).rejects.toMatchObject({ code: 11000 });
  });

  it('clinics (BE-06): 2dsphere, city and staff indexes; near query works', async () => {
    const idx = await indexes('clinics');
    expect(idx.some((i) => i.key.location === '2dsphere')).toBe(true);
    expect(idx.some((i) => i.key['address.city'] === 1)).toBe(true);
    expect(idx.some((i) => i.key.staffUserIds === 1)).toBe(true);
    const clinics = connection.collection('clinics');
    await clinics.insertOne({
      name: 'Near',
      location: { type: 'Point', coordinates: [79.43, 28.36] },
    });
    await clinics.insertOne({
      name: 'Far',
      location: { type: 'Point', coordinates: [77.2, 28.6] },
    });
    const near = await clinics
      .find({
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [79.42, 28.37] },
            $maxDistance: 5000,
          },
        },
      })
      .toArray();
    expect(near.map((c) => c.name)).toEqual(['Near']);
  });

  describe('clinic console (BE-13)', () => {
    const doctorId = new Types.ObjectId();
    const base = () => ({
      doctorId,
      clinicId: new Types.ObjectId(),
      patientUserId: new Types.ObjectId(),
      patientName: 'P',
      patientPhone: '+919800000009',
      date: '2026-10-12',
      source: 'online',
    });
    const slot = new Date('2026-10-12T04:30:00.000Z');

    it('appointments: two active bookings of one slot are impossible (11000)', async () => {
      const appts = connection.collection('appointments');
      await appts.insertOne({ ...base(), slotStart: slot, status: 'confirmed' });
      for (const status of ['pending_payment', 'confirmed', 'checked_in', 'in_consult']) {
        await expect(appts.insertOne({ ...base(), slotStart: slot, status })).rejects.toMatchObject(
          {
            code: 11000,
          },
        );
      }
      // Cancelled or expired bookings free the slot; walk-ins without a slot never collide.
      await appts.insertOne({ ...base(), slotStart: slot, status: 'cancelled_by_patient' });
      await appts.insertOne({ ...base(), status: 'confirmed', source: 'walk_in' });
      await appts.insertOne({ ...base(), status: 'confirmed', source: 'walk_in' });
      const idx = await indexes('appointments');
      expect(
        idx.some((i) => i.key.doctorId === 1 && i.key.date === 1 && i.key.effectiveTime === 1),
      ).toBe(true);
      expect(idx.find((i) => i.key.holdExpiresAt === 1)?.partialFilterExpression).toEqual({
        status: 'pending_payment',
      });
    });

    it('doctorStatus: one per doctor per day (11000); schedules: one per doctor and clinic', async () => {
      const status = connection.collection('doctorStatus');
      await status.insertOne({ doctorId, date: '2026-10-12', tokenCounter: 0 });
      await expect(status.insertOne({ doctorId, date: '2026-10-12' })).rejects.toMatchObject({
        code: 11000,
      });
      await status.insertOne({ doctorId, date: '2026-10-13' });
      const clinicId = new Types.ObjectId();
      const schedules = connection.collection('schedules');
      await schedules.insertOne({ doctorId, clinicId, weekly: [] });
      await expect(schedules.insertOne({ doctorId, clinicId, weekly: [] })).rejects.toMatchObject({
        code: 11000,
      });
      expect(
        (await indexes('statusEvents')).some((i) => i.key.doctorId === 1 && i.key.at === 1),
      ).toBe(true);
      expect((await indexes('jobs')).some((i) => i.key.status === 1 && i.key.runAt === 1)).toBe(
        true,
      );
    });
  });
});
