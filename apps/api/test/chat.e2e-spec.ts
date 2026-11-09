import {
  ApiErrorSchema,
  ApplicationListSchema,
  ChatMessageSchema,
  ChatMessagesResponseSchema,
  ChatThreadsResponseSchema,
} from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { createTestApp } from './app';

const DEMO_CODE = '123456';
const PASSWORD = 'Sunrise2026x';
let seq = 0;
const nextEmail = (p: string) => `${p}${++seq}@example.com`;
const nextIp = () => `10.40.${Math.floor(seq / 250)}.${(seq % 250) + 1}`;
const errorCode = (body: unknown) => ApiErrorSchema.parse(body).error.code;
const istDate = (n: number) =>
  new Date(Date.now() + 5.5 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const week = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  start: '00:05',
  end: '23:55',
  slotMinutes: 30,
}));
const clinic = {
  displayName: 'Dr Chat Doctor',
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

describe('chat between a patient and the doctor of a booking', () => {
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

  async function doctor(name: string) {
    const adm = await provider('Admin Person');
    await db
      .collection('accounts')
      .updateOne({ email: adm.identifier }, { $set: { platformRole: 'admin' } });
    const adminJar = cookieJar(
      await post('console/auth/login', { identifier: adm.identifier, password: PASSWORD }).expect(
        200,
      ),
    );
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
    await http()
      .post(`/api/v1/platform/applications/${unitId}/decision`)
      .set('Cookie', adminJar)
      .send({ decision: 'approve' })
      .expect(200);
    await http()
      .put(`/api/v1/console/workspaces/${unitId}/schedule`)
      .set('Cookie', rao.jar)
      .send({
        weekly: week,
        exceptions: [],
        bookingWindowDays: 7,
        walkInShare: 0.3,
        isActive: true,
      })
      .expect(200);
    const d = (await db.collection('doctors').findOne({ unitId: new Types.ObjectId(unitId) }))!;
    const c = (await db.collection('clinics').findOne({ unitId: new Types.ObjectId(unitId) }))!;
    return { jar: rao.jar, unitId, doctorId: String(d._id), clinicId: String(c._id) };
  }

  async function patient() {
    const phone = `+91983${String(6_000_000 + ++seq).slice(-7)}`;
    await http()
      .post('/api/v1/auth/otp/request')
      .set('X-Forwarded-For', nextIp())
      .send({ phone })
      .expect(200);
    const login = await http()
      .post('/api/v1/auth/otp/verify')
      .set('X-Forwarded-For', nextIp())
      .set('X-Doqto-Client', 'mobile')
      .send({ phone, code: DEMO_CODE })
      .expect(200);
    return {
      phone,
      auth: { Authorization: `Bearer ${(login.body as { accessToken: string }).accessToken}` },
    };
  }

  /** The patient books the first free slot tomorrow and pays. */
  async function books(
    d: { doctorId: string; clinicId: string },
    p: Awaited<ReturnType<typeof patient>>,
  ) {
    const slots = (
      await http()
        .get(`/api/v1/doctors/${d.doctorId}/slots?clinicId=${d.clinicId}&date=${istDate(1)}`)
        .set(p.auth)
        .expect(200)
    ).body as { slots: { start: string }[] };
    const created = await http()
      .post('/api/v1/appointments')
      .set(p.auth)
      .set('X-Forwarded-For', nextIp())
      .send({
        doctorId: d.doctorId,
        clinicId: d.clinicId,
        slotStart: slots.slots[0]!.start,
        patientName: 'Asha Devi',
        patientPhone: p.phone,
      })
      .expect(201);
    const id = (created.body as { appointment: { id: string } }).appointment.id;
    await http()
      .post('/api/v1/payments/demo-pay')
      .set(p.auth)
      .send({ appointmentId: id })
      .expect(200);
    return id;
  }

  const accept = (d: { unitId: string; jar: string[] }, id: string) =>
    http()
      .post(`/api/v1/console/workspaces/${d.unitId}/appointments/${id}/confirm`)
      .set('Cookie', d.jar)
      .expect(200);

  it('opens once the doctor accepts the booking, and carries messages both ways with unread counts', async () => {
    const d = await doctor('Dr Chat One');
    const p = await patient();
    const id = await books(d, p);
    const patientUrl = `/api/v1/chats/${id}`;
    const doctorUrl = `/api/v1/console/workspaces/${d.unitId}/chats`;

    // Nothing to chat about before the doctor has accepted.
    expect(
      ChatThreadsResponseSchema.parse(
        (await http().get('/api/v1/chats').set(p.auth).expect(200)).body,
      ).items,
    ).toEqual([]);
    expect(errorCode((await http().get(patientUrl).set(p.auth).expect(404)).body)).toBe(
      'NOT_FOUND',
    );
    await http().post(patientUrl).set(p.auth).send({ text: 'Hello' }).expect(404);

    await accept(d, id);

    // The thread appears for both, empty.
    const mine = ChatThreadsResponseSchema.parse(
      (await http().get('/api/v1/chats').set(p.auth).expect(200)).body,
    );
    expect(mine.items).toMatchObject([
      {
        appointmentId: id,
        withName: 'Dr Chat One',
        specialty: 'general_physician',
        open: true,
        unread: 0,
        lastMessage: null,
      },
    ]);
    expect(mine.items[0]!.doctorSlug).toEqual(expect.any(String));
    // The doctor's approved photo shows in the patient's list and thread; the doctor's own view has none.
    expect(mine.items[0]!.photoUrl).toBeNull();
    await db
      .collection('doctors')
      .updateOne(
        { _id: new Types.ObjectId(d.doctorId) },
        { $set: { photoUrl: 'http://localhost:4000/api/v1/demo-storage/public/units/x/p.jpg' } },
      );
    expect((await http().get('/api/v1/chats').set(p.auth).expect(200)).body).toMatchObject({
      items: [{ photoUrl: expect.stringContaining('/p.jpg') }],
    });
    expect((await http().get(patientUrl).set(p.auth).expect(200)).body).toMatchObject({
      thread: { photoUrl: expect.stringContaining('/p.jpg') },
    });
    expect(
      (
        await http()
          .get('/api/v1/console/workspaces/' + d.unitId + '/chats')
          .set('Cookie', d.jar)
          .expect(200)
      ).body,
    ).toMatchObject({ items: [{ photoUrl: null }] });

    // The patient writes; the doctor sees one unread message from the patient by name.
    const sent = ChatMessageSchema.parse(
      (
        await http()
          .post(patientUrl)
          .set(p.auth)
          .send({ text: '  Should I fast before the visit?  ' })
          .expect(201)
      ).body,
    );
    expect(sent).toMatchObject({ from: 'patient', text: 'Should I fast before the visit?' });
    const theirs = ChatThreadsResponseSchema.parse(
      (await http().get(doctorUrl).set('Cookie', d.jar).expect(200)).body,
    );
    expect(theirs.items).toMatchObject([
      {
        appointmentId: id,
        withName: 'Asha Devi',
        specialty: null,
        unread: 1,
        lastMessage: { from: 'patient' },
      },
    ]);
    // The patient's own message is not unread for the patient.
    expect((await http().get('/api/v1/chats').set(p.auth).expect(200)).body).toMatchObject({
      items: [{ unread: 0 }],
    });

    // Opening the thread as the doctor reads it and marks it read.
    const opened = ChatMessagesResponseSchema.parse(
      (await http().get(`${doctorUrl}/${id}`).set('Cookie', d.jar).expect(200)).body,
    );
    expect(opened.messages.map((m) => m.text)).toEqual(['Should I fast before the visit?']);
    expect((await http().get(doctorUrl).set('Cookie', d.jar).expect(200)).body).toMatchObject({
      items: [{ unread: 0 }],
    });

    // The doctor replies; the patient sees one unread, and polling with `after` returns only the new one.
    await http()
      .post(`${doctorUrl}/${id}`)
      .set('Cookie', d.jar)
      .send({ text: 'No need to fast.' })
      .expect(201);
    expect((await http().get('/api/v1/chats').set(p.auth).expect(200)).body).toMatchObject({
      items: [{ unread: 1, lastMessage: { from: 'doctor', text: 'No need to fast.' } }],
    });
    const poll = ChatMessagesResponseSchema.parse(
      (
        await http()
          .get(`${patientUrl}?after=${encodeURIComponent(sent.at)}`)
          .set(p.auth)
          .expect(200)
      ).body,
    );
    expect(poll.messages.map((m) => `${m.from}:${m.text}`)).toEqual(['doctor:No need to fast.']);
    expect((await http().get('/api/v1/chats').set(p.auth).expect(200)).body).toMatchObject({
      items: [{ unread: 0 }],
    });
    const all = ChatMessagesResponseSchema.parse(
      (await http().get(patientUrl).set(p.auth).expect(200)).body,
    );
    expect(all.messages.map((m) => m.from)).toEqual(['patient', 'doctor']);
  });

  it('refuses empty and too long text, and anyone who is not a party to the booking', async () => {
    const d = await doctor('Dr Chat Two');
    const other = await doctor('Dr Chat Other');
    const p = await patient();
    const stranger = await patient();
    const id = await books(d, p);
    await accept(d, id);
    const patientUrl = `/api/v1/chats/${id}`;
    const doctorUrl = `/api/v1/console/workspaces/${d.unitId}/chats/${id}`;

    expect(
      errorCode((await http().post(patientUrl).set(p.auth).send({ text: '   ' }).expect(400)).body),
    ).toBe('VALIDATION_FAILED');
    await http()
      .post(patientUrl)
      .set(p.auth)
      .send({ text: 'x'.repeat(1001) })
      .expect(400);
    await http().post(patientUrl).set(p.auth).send({}).expect(400);

    // Another patient: not found, and the list shows nothing of it.
    await http().get(patientUrl).set(stranger.auth).expect(404);
    await http().post(patientUrl).set(stranger.auth).send({ text: 'hi' }).expect(404);
    expect((await http().get('/api/v1/chats').set(stranger.auth).expect(200)).body).toEqual({
      items: [],
    });
    await http().get('/api/v1/chats/not-an-id').set(p.auth).expect(404);

    // Another doctor, using their own service in the path or this one's.
    await http()
      .get(`/api/v1/console/workspaces/${other.unitId}/chats/${id}`)
      .set('Cookie', other.jar)
      .expect(404);
    await http()
      .post(`/api/v1/console/workspaces/${other.unitId}/chats/${id}`)
      .set('Cookie', other.jar)
      .send({ text: 'hi' })
      .expect(404);
    await http().get(doctorUrl).set('Cookie', other.jar).expect(404);
    expect(
      (
        await http()
          .get(`/api/v1/console/workspaces/${other.unitId}/chats`)
          .set('Cookie', other.jar)
          .expect(200)
      ).body,
    ).toEqual({ items: [] });

    // Signed out, and the wrong kind of session.
    await http().get('/api/v1/chats').expect(401);
    await http().get(doctorUrl).expect(401);
    await http().get(doctorUrl).set(p.auth).expect(401);
    await http().get(patientUrl).set('Cookie', d.jar).expect(401);
  });

  it('closes a week after the visit: still readable, no longer writable; a cancelled booking has no chat', async () => {
    const d = await doctor('Dr Chat Three');
    const p = await patient();
    const id = await books(d, p);
    await accept(d, id);
    const url = `/api/v1/chats/${id}`;
    await http().post(url).set(p.auth).send({ text: 'Thank you doctor' }).expect(201);

    const set = (fields: object) =>
      db.collection('appointments').updateOne({ _id: new Types.ObjectId(id) }, { $set: fields });
    // Visit done 3 days ago: still open.
    await set({ status: 'completed', date: istDate(-3) });
    await http().post(url).set(p.auth).send({ text: 'Feeling better' }).expect(201);
    // Visit done 10 days ago: read-only.
    await set({ date: istDate(-10) });
    const closed = ChatMessagesResponseSchema.parse(
      (await http().get(url).set(p.auth).expect(200)).body,
    );
    expect(closed.thread.open).toBe(false);
    expect(closed.messages).toHaveLength(2);
    expect(
      errorCode(
        (await http().post(url).set(p.auth).send({ text: 'One more thing' }).expect(409)).body,
      ),
    ).toBe('CONFLICT');
    await http()
      .post(`/api/v1/console/workspaces/${d.unitId}/chats/${id}`)
      .set('Cookie', d.jar)
      .send({ text: 'Take care' })
      .expect(409);
    // Visits older than 30 days drop off the list.
    await set({ date: istDate(-40) });
    expect((await http().get('/api/v1/chats').set(p.auth).expect(200)).body).toEqual({ items: [] });

    // A cancelled booking has no chat.
    await set({ status: 'cancelled_by_patient', date: istDate(1) });
    await http().get(url).set(p.auth).expect(404);
  });

  it('deleting the account deletes the messages', async () => {
    const d = await doctor('Dr Chat Four');
    const p = await patient();
    const id = await books(d, p);
    await accept(d, id);
    await http()
      .post(`/api/v1/chats/${id}`)
      .set(p.auth)
      .send({ text: 'Private question' })
      .expect(201);
    expect(
      await db
        .collection('chat_messages')
        .countDocuments({ appointmentId: new Types.ObjectId(id) }),
    ).toBe(1);
    await http()
      .delete('/api/v1/me')
      .set(p.auth)
      .set('X-Forwarded-For', nextIp())
      .send({ confirm: 'DELETE' })
      .expect(204);
    expect(
      await db
        .collection('chat_messages')
        .countDocuments({ appointmentId: new Types.ObjectId(id) }),
    ).toBe(0);
  });
});
