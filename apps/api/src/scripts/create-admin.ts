/**
 * Creates a member of the Doqto team (invite only: there is no sign-up for this). The account is
 * confirmed and can sign in at the console login straight away (it opens the /admin area). Usage:
 *
 *   ADMIN_PASSWORD='a-long-password-with-1-number' pnpm --filter @doqto/api admin:create <email> "<Full Name>"
 *
 * Without ADMIN_PASSWORD a random one is made and printed once. Run it again for an existing email
 * to give that account the role and set a new password. Refuses to run on a live database unless
 * ALLOW_LIVE_ADMIN=yes is set.
 */
import './script-env';
import 'reflect-metadata';
import { PasswordSchema } from '@doqto/shared';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { validateEnv } from '../config/env';
import { Account } from '../console-auth/account.schema';
import { PasswordService } from '../console-auth/password.service';

async function main(): Promise<void> {
  const [emailArg, name] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name || name.trim().length < 2) {
    throw new Error('Usage: admin:create <email> "<Full Name>"');
  }
  const env = validateEnv(process.env);
  if (env.PROVIDER_MODE === 'live' && process.env.ALLOW_LIVE_ADMIN !== 'yes') {
    throw new Error('Live mode: set ALLOW_LIVE_ADMIN=yes to create a team account on this database.');
  }
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? `${randomBytes(9).toString('base64url')}7a`;
  const strong = PasswordSchema.safeParse(password);
  if (!strong.success) throw new Error(strong.error.issues[0]?.message ?? 'Password is too weak');

  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  try {
    const accounts = app.get<Model<Account>>(getModelToken(Account.name));
    const passwordHash = await app.get(PasswordService).hash(password);
    const now = new Date();
    await accounts
      .updateOne(
        { email },
        {
          $set: {
            name: name.trim(),
            passwordHash,
            platformRole: 'admin',
            status: 'active',
            contactVerifiedAt: now,
            passwordChangedAt: now,
            failedLogins: 0,
          },
          $unset: { lockedUntil: '' },
          $setOnInsert: { email, language: 'en' },
        },
        { upsert: true },
      )
      .exec();
    console.warn(`Team account ready: ${email}`);
    if (generated) console.warn(`Password (shown once, change it after signing in): ${password}`);
  } finally {
    await app.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
