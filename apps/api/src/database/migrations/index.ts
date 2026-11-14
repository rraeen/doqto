import { AuditLog } from '../../audit/audit-log.schema';
import { Otp } from '../../auth/otp.schema';
import { RefreshToken } from '../../auth/refresh-token.schema';
import { Account, AccountCode, AccountRefreshToken } from '../../console-auth/account.schema';
import { Membership, Organization, Unit } from '../../console-auth/organization.schema';
import { Clinic } from '../../clinics/clinic.schema';
import { Doctor } from '../../doctors/doctor.schema';
import { plainSlug } from '../../doctors/slug';
import { Appointment } from '../../appointments/appointment.schema';
import { ChatMessageDoc } from '../../chat/chat-message.schema';
import { Lab, LabBooking, LabCategory, LabTest } from '../../labs/lab.schema';
import { Notification } from '../../notifications/notification.schema';
import { Job } from '../../jobs/job.schema';
import { ScheduleEntity } from '../../schedules/schedule.schema';
import { DoctorStatusEntity } from '../../status/doctor-status.schema';
import { StatusEvent } from '../../status/status-event.schema';
import { Payment } from '../../payments/payment.schema';
import { HealthRecordDoc } from '../../records/record.schema';
import { Review } from '../../reviews/review.schema';
import { User } from '../../users/user.schema';
import { indexMigration, type Migration } from './migration';

/**
 * Applied in order at startup. Append only: never edit or reorder a migration that has shipped.
 * Schema changes are additive first, backfill second, enforce third (DB doc 7).
 * `indexMigration` syncs a model's indexes as the schema stands when it runs, so it is not a
 * snapshot: a new index on an existing model reaches databases that already applied the older
 * migration only through a new migration that names the model again.
 */
export const MIGRATIONS: Migration[] = [
  indexMigration('0001-sprint1-auth-indexes', [User.name, Otp.name, RefreshToken.name]),
  indexMigration('0002-sprint2-doctor-clinic-indexes', [Doctor.name, Clinic.name, AuditLog.name]),
  // AuditLog again for its 24-month TTL, Doctor again for the queue's submittedAt index.
  indexMigration('0003-sprint3-clinic-console-indexes', [
    AuditLog.name,
    Doctor.name,
    ScheduleEntity.name,
    Appointment.name,
    DoctorStatusEntity.name,
    StatusEvent.name,
    Job.name,
  ]),
  indexMigration('0004-sprint4-notifications-indexes', [Notification.name]),
  // Payments, plus Appointment again for the booking fields and indexes added with booking.
  {
    name: '0005-sprint5-booking-indexes',
    async up(connection) {
      // The one-active-booking-per-slot index now also covers `pending_confirmation` (a paid booking
      // waiting for the doctor). A database made before that has it with the shorter status list, and
      // MongoDB refuses to create an index of the same name with a different definition: drop it first.
      try {
        await connection.collection('appointments').dropIndex('doctor_slot_active_unique');
      } catch (e) {
        const code = (e as { code?: number }).code;
        // 27 = index not found, 26 = collection not found: nothing to replace.
        if (code !== 27 && code !== 26) throw e;
      }
      for (const name of [Payment.name, Appointment.name]) {
        await connection.model(name).createIndexes();
      }
    },
  },
  indexMigration('0006-sprint6-review-indexes', [Review.name]),
  indexMigration('0007-sprint7-record-indexes', [HealthRecordDoc.name]),
  // Provider accounts (console sign-in), kept apart from the patient users.
  indexMigration('0008-console-account-indexes', [
    Account.name,
    AccountCode.name,
    AccountRefreshToken.name,
  ]),
  indexMigration('0009-organization-unit-membership-indexes', [
    Organization.name,
    Unit.name,
    Membership.name,
  ]),
  // Accounts made before organizations existed had one `accountType`: give each an organization
  // with that one unit and an owner membership, then drop the field. Safe to run again.
  {
    name: '0010-accounts-to-organizations',
    async up(connection) {
      const accounts = connection.collection('accounts');
      const orgs = connection.collection('organizations');
      const units = connection.collection('units');
      const memberships = connection.collection('memberships');
      const legacy = accounts.find({ accountType: { $exists: true } });
      for await (const a of legacy) {
        const owned = await orgs.findOne({ ownerAccountId: a._id });
        let orgId = owned?._id;
        if (!orgId) {
          orgId = (await orgs.insertOne({ name: a.name, ownerAccountId: a._id, createdAt: new Date(), updatedAt: new Date() })).insertedId;
        }
        const kind = a.accountType as string;
        let unit = await units.findOne({ organizationId: orgId, kind });
        if (!unit) {
          const inserted = await units.insertOne({
            organizationId: orgId,
            kind,
            name: a.name,
            status: 'draft',
            profile: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          unit = { _id: inserted.insertedId };
        }
        await memberships.updateOne(
          { accountId: a._id, unitId: unit._id },
          {
            $setOnInsert: {
              accountId: a._id,
              organizationId: orgId,
              unitId: unit._id,
              role: 'owner',
              permissions: [],
              createdAt: new Date(),
            },
            $set: { updatedAt: new Date() },
          },
          { upsert: true },
        );
        await accounts.updateOne({ _id: a._id }, { $unset: { accountType: '' } });
      }
    },
  },
  // Doctors listed from an application have no patient-side user, so the unique userId index must
  // only cover doctors that have one. MongoDB cannot change an index in place: drop, then rebuild.
  {
    name: '0011-doctor-partial-indexes',
    async up(connection) {
      try {
        await connection.collection('doctors').dropIndex('userId_1');
      } catch (e) {
        const code = (e as { code?: number }).code;
        // 27 = index not found, 26 = collection not found: nothing to replace.
        if (code !== 27 && code !== 26) throw e;
      }
      for (const name of [Doctor.name, Clinic.name]) await connection.model(name).createIndexes();
    },
  },
  // Clinic applications approved before the form asked for the registration year, state and PIN code
  // could not be put on the patient site. Send each back for changes with a note the applicant can
  // read; once they fill the three fields and Doqto approves again, the doctor is listed.
  {
    name: '0012-reopen-unlistable-clinics',
    async up(connection) {
      const units = connection.collection('units');
      const doctors = connection.collection('doctors');
      for await (const u of units.find({ kind: 'clinic', status: 'verified' })) {
        const p = (u.profile ?? {}) as Record<string, unknown>;
        const missing = ['registrationYear', 'state', 'pincode'].filter((k) => p[k] === undefined || p[k] === '');
        if (missing.length === 0 || (await doctors.findOne({ unitId: u._id }))) continue;
        await units.updateOne(
          { _id: u._id, status: 'verified' },
          {
            $set: {
              status: 'changes_requested',
              reviewedAt: new Date(),
              reviewNote:
                'To list you on the patient site we also need your registration year, state and PIN code. Please add them and submit again.',
            },
          },
        );
      }
    },
  },
  // Messages between a patient and the doctor of a booking.
  indexMigration('0013-chat-message-indexes', [ChatMessageDoc.name]),
  // Labs: the patient listing, the catalogue and the booking requests.
  indexMigration('0014-lab-indexes', [Lab.name, LabCategory.name, LabTest.name, LabBooking.name]),
  // Labs approved before lab listings existed were never put on the patient site. List each one
  // now, the same way approving it today does (a lab listed already is left alone).
  {
    name: '0015-list-approved-labs',
    async up(connection) {
      const units = connection.collection('units');
      const labs = connection.collection('labs');
      for await (const u of units.find({ kind: 'lab', status: 'verified' })) {
        if (await labs.findOne({ unitId: u._id })) continue;
        const p = (u.profile ?? {}) as Record<string, unknown>;
        const name = String(p.labName ?? u.name ?? '').trim();
        const cityLabel = String(p.city ?? '').trim();
        const address = String(p.address ?? '').trim();
        if (!name || !cityLabel || !address) continue; // too incomplete to list; the owner fixes the form
        const base = plainSlug(name, cityLabel, 'lab');
        let slug = base;
        for (let n = 2; await labs.findOne({ slug }); n++) slug = `${base}-${n}`;
        await labs.insertOne({
          unitId: u._id,
          name,
          slug,
          city: cityLabel.toLowerCase(),
          cityLabel,
          address,
          nablAccredited: p.nablAccredited === true,
          homeCollection: p.homeCollection === true,
          ...(typeof p.turnaroundHours === 'number' ? { turnaroundHours: p.turnaroundHours } : {}),
          isListed: true,
          isDemo: process.env.PROVIDER_MODE === 'demo',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    },
  },
];
