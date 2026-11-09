/**
 * Demo and development only: approve, send back or reject a service application until the admin
 * app can do it. Usage: pnpm --filter @doqto/api unit:review <phone-or-email> <clinic|lab|pharmacy> [verified|changes_requested|rejected|suspended|pending]
 * Refuses to run outside demo mode or on a database that is not a demo database.
 */
import './script-env';
import 'reflect-metadata';
import { UNIT_STATUSES, WORKSPACE_TYPES, type UnitStatus, type WorkspaceType } from '@doqto/shared';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { validateEnv } from '../config/env';
import { Account } from '../console-auth/account.schema';
import { Membership, Unit } from '../console-auth/organization.schema';
import { assertSeedTarget } from './demo-seed';

async function main(): Promise<void> {
  const [identifier, kind, status = 'verified'] = process.argv.slice(2);
  if (!identifier || !WORKSPACE_TYPES.includes(kind as WorkspaceType)) {
    throw new Error('Usage: unit:review <phone-or-email> <clinic|lab|pharmacy> [status]');
  }
  if (!UNIT_STATUSES.includes(status as UnitStatus)) {
    throw new Error(`Status must be one of ${UNIT_STATUSES.join(', ')}`);
  }
  const env = validateEnv(process.env);
  assertSeedTarget({ mode: env.PROVIDER_MODE, dbName: env.MONGODB_DB_NAME, uri: env.MONGODB_URI });
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  try {
    const accounts = app.get<Model<Account>>(getModelToken(Account.name));
    const memberships = app.get<Model<Membership>>(getModelToken(Membership.name));
    const units = app.get<Model<Unit>>(getModelToken(Unit.name));
    const key = identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: identifier };
    const account = await accounts.findOne(key).exec();
    if (!account) throw new Error('No account for that phone or email');
    const mine = await memberships.find({ accountId: account._id }).exec();
    const unit = await units.findOne({ _id: { $in: mine.map((m) => m.unitId) }, kind }).exec();
    if (!unit) throw new Error(`That account has not applied for a ${kind}`);
    unit.set({ status, reviewedAt: new Date() });
    await unit.save();
    console.warn(`${kind} of ${identifier} is now ${status}.`);
  } finally {
    await app.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
