import { AuditLog } from '../../audit/audit-log.schema';
import { Otp } from '../../auth/otp.schema';
import { RefreshToken } from '../../auth/refresh-token.schema';
import { Clinic } from '../../clinics/clinic.schema';
import { Doctor } from '../../doctors/doctor.schema';
import { Appointment } from '../../appointments/appointment.schema';
import { Notification } from '../../notifications/notification.schema';
import { Job } from '../../jobs/job.schema';
import { ScheduleEntity } from '../../schedules/schedule.schema';
import { DoctorStatusEntity } from '../../status/doctor-status.schema';
import { StatusEvent } from '../../status/status-event.schema';
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
];
