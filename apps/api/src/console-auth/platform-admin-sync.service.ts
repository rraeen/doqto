import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig } from '../config/app-config.service';
import { Account } from './account.schema';
import { PasswordService } from './password.service';

/**
 * Keeps the Doqto team's admin account in step with `ADMIN_EMAIL`, `ADMIN_PASSWORD` and
 * `ADMIN_NAME` in `.env`. At every start: if the email and password are set, that account exists,
 * is an active admin, and its password is the one in `.env`. Change either value and restart the
 * API to change the login. Leave them empty and nothing is touched (accounts made with
 * `admin:create` keep working). The password is never logged.
 */
@Injectable()
export class PlatformAdminSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformAdminSyncService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly passwords: PasswordService,
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get('ADMIN_EMAIL');
    const password = this.config.get('ADMIN_PASSWORD');
    if (!email && !password) return;
    if (!email || !password) {
      this.logger.warn(
        'ADMIN_EMAIL and ADMIN_PASSWORD must both be set to create the admin login.',
      );
      return;
    }
    const name = this.config.get('ADMIN_NAME');
    const existing = await this.accounts.findOne({ email }).exec();
    const same = existing ? await this.passwords.verify(password, existing.passwordHash) : false;
    if (existing && same && existing.platformRole === 'admin' && existing.status === 'active') {
      if (existing.name !== name)
        await this.accounts.updateOne({ _id: existing._id }, { $set: { name } }).exec();
      return;
    }
    const now = new Date();
    await this.accounts
      .updateOne(
        { email },
        {
          $set: {
            name,
            platformRole: 'admin',
            status: 'active',
            contactVerifiedAt: existing?.contactVerifiedAt ?? now,
            failedLogins: 0,
            ...(same
              ? {}
              : { passwordHash: await this.passwords.hash(password), passwordChangedAt: now }),
          },
          $unset: { lockedUntil: '' },
          $setOnInsert: { email, language: 'en' },
        },
        { upsert: true },
      )
      .exec();
    this.logger.log(`Admin login ${existing ? 'updated' : 'created'} from .env: ${email}`);
  }
}
