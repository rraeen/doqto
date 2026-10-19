import { type ModelDefinition } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../audit/audit-log.schema';
import { Otp, OtpSchema } from '../auth/otp.schema';
import { RefreshToken, RefreshTokenSchema } from '../auth/refresh-token.schema';
import { Clinic, ClinicSchema } from '../clinics/clinic.schema';
import { Doctor, DoctorSchema } from '../doctors/doctor.schema';
import { Appointment, AppointmentSchema } from '../appointments/appointment.schema';
import { Job, JobSchema } from '../jobs/job.schema';
import { ScheduleEntity, ScheduleEntitySchema } from '../schedules/schedule.schema';
import { DoctorStatusEntity, DoctorStatusEntitySchema } from '../status/doctor-status.schema';
import { StatusEvent, StatusEventSchema } from '../status/status-event.schema';
import { Notification, NotificationSchema } from '../notifications/notification.schema';
import { User, UserSchema } from '../users/user.schema';

/**
 * Every Mongoose model, registered once by DatabaseModule so models, the migration runner and
 * tests agree. Feature modules inject them with `@InjectModel(X.name)`.
 */
export const MODELS: ModelDefinition[] = [
  { name: User.name, schema: UserSchema },
  { name: Otp.name, schema: OtpSchema },
  { name: RefreshToken.name, schema: RefreshTokenSchema },
  { name: Doctor.name, schema: DoctorSchema },
  { name: Clinic.name, schema: ClinicSchema },
  { name: AuditLog.name, schema: AuditLogSchema },
  { name: ScheduleEntity.name, schema: ScheduleEntitySchema },
  { name: Appointment.name, schema: AppointmentSchema },
  { name: DoctorStatusEntity.name, schema: DoctorStatusEntitySchema },
  { name: StatusEvent.name, schema: StatusEventSchema },
  { name: Job.name, schema: JobSchema },
  { name: Notification.name, schema: NotificationSchema },
];
