import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { loggerParams } from './common/logging/logger';
import { AppConfig } from './config/app-config.service';
import { ClientIpThrottlerGuard } from './common/http/client-ip-throttler.guard';
import { AppConfigModule } from './config/config.module';
import { AuditModule } from './audit/audit.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { ConsoleAuthModule } from './console-auth/console-auth.module';
import { ClinicsModule } from './clinics/clinics.module';
import { DoctorsModule } from './doctors/doctors.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { ChatModule } from './chat/chat.module';
import { QueueModule } from './queue/queue.module';
import { LabsModule } from './labs/labs.module';
import { RecordsModule } from './records/records.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SchedulesModule } from './schedules/schedules.module';
import { StatusModule } from './status/status.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    IntegrationsModule.forRoot(),
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        loggerParams({ LOG_LEVEL: config.get('LOG_LEVEL'), NODE_ENV: config.get('NODE_ENV') }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('THROTTLE_TTL_SECONDS') * 1000,
            limit: config.get('THROTTLE_LIMIT'),
          },
        ],
      }),
    }),
    DatabaseModule,
    AuditModule,
    HealthModule,
    AuthModule,
    ConsoleAuthModule,
    UsersModule,
    DoctorsModule,
    ClinicsModule,
    SchedulesModule,
    AppointmentsModule,
    QueueModule,
    ChatModule,
    StatusModule,
    NotificationsModule,
    PaymentsModule,
    ReviewsModule,
    RecordsModule,
    LabsModule,
    AccountModule,
    AdminModule,
    JobsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ClientIpThrottlerGuard }],
})
export class AppModule {}
