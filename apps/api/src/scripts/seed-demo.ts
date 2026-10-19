/** CLI for the BE-11 demo seed (data and rules in `demo-seed.ts`). Optional `DEMO_ADMIN_PHONE` seeds an admin. */
import './script-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../app.module';
import { Clinic } from '../clinics/clinic.schema';
import { AppConfig } from '../config/app-config.service';
import { validateEnv } from '../config/env';
import { Doctor } from '../doctors/doctor.schema';
import { ScheduleEntity } from '../schedules/schedule.schema';
import { User } from '../users/user.schema';
import { assertSeedTarget, seedDemo } from './demo-seed';

async function main(): Promise<void> {
  // Before booting: booting connects and runs migrations against whatever database is configured.
  const env = validateEnv(process.env);
  const mode = env.PROVIDER_MODE;
  assertSeedTarget({ mode, dbName: env.MONGODB_DB_NAME, uri: env.MONGODB_URI });
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  try {
    const dbName = app.get(AppConfig).get('MONGODB_DB_NAME');
    const result = await seedDemo(
      {
        users: app.get(getModelToken(User.name)),
        doctors: app.get(getModelToken(Doctor.name)),
        clinics: app.get(getModelToken(Clinic.name)),
        schedules: app.get(getModelToken(ScheduleEntity.name)),
      },
      { mode, adminPhone: process.env.DEMO_ADMIN_PHONE || undefined },
    );
    console.warn(
      `Seeded ${result.clinics} clinics and ${result.doctors} doctors into ${dbName}` +
        (result.admin
          ? ' with the DEMO_ADMIN_PHONE admin'
          : ' (no admin: DEMO_ADMIN_PHONE is unset)') +
        '. Log in with OTP 123456.',
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
