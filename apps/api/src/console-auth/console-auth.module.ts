import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config.service';
import { AccountCodeService } from './account-code.service';
import { AccountSessionService } from './account-session.service';
import { ConsoleAuthController } from './console-auth.controller';
import { ConsoleAuthGuard } from './console-auth.guard';
import { ConsoleAuthService } from './console-auth.service';
import { PasswordService } from './password.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { PlatformAdminSyncService } from './platform-admin-sync.service';
import { PlatformProfileChangesService } from './platform-profile-changes.service';
import { UnitProfileService } from './unit-profile.service';
import { UnitPublishingService } from './unit-publishing.service';
import { UnitScheduleService } from './unit-schedule.service';
import {
  PlatformApplicationsController,
  PlatformProfileChangesController,
} from './platform.controller';
import { PlatformApplicationsService } from './platform-applications.service';
import { PlatformAuthGuard } from './platform-auth.guard';
import { ApplicationsController, WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

/** Register, sign-in and password reset for doctors, clinics, labs and pharmacies. */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256', expiresIn: config.get('JWT_ACCESS_TTL') },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [
    ConsoleAuthController,
    WorkspacesController,
    ApplicationsController,
    StaffController,
    PlatformApplicationsController,
    PlatformProfileChangesController,
  ],
  providers: [
    ConsoleAuthService,
    AccountCodeService,
    AccountSessionService,
    PasswordService,
    WorkspacesService,
    StaffService,
    PlatformApplicationsService,
    PlatformProfileChangesService,
    UnitProfileService,
    PlatformAdminSyncService,
    UnitPublishingService,
    UnitScheduleService,
    ConsoleAuthGuard,
    PlatformAuthGuard,
  ],
  exports: [ConsoleAuthGuard, JwtModule, WorkspacesService],
})
export class ConsoleAuthModule {}
