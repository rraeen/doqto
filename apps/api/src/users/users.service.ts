import { WHATSAPP_CONSENT_VERSION, type Me, type UpdateMeRequest } from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { AppConfig } from '../config/app-config.service';
import { User, UserDocument } from './user.schema';

export function toMe(user: UserDocument): Me {
  return {
    id: user._id.toHexString(),
    phone: user.phone,
    name: user.name ?? null,
    roles: user.roles,
    language: user.language,
    whatsappOptIn: user.whatsappOptIn,
    status: user.status,
    clinicIds: user.clinicIds.map((id) => id.toHexString()),
    isDemo: user.isDemo,
    createdAt: user.createdAt.toISOString(),
  };
}

export function assertActive(user: UserDocument): void {
  if (user.status !== 'active') {
    throw new AppException(
      HttpStatus.FORBIDDEN,
      'ACCOUNT_SUSPENDED',
      'This account is not active. Contact Doqto support.',
    );
  }
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly config: AppConfig,
  ) {}

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.users.findOne({ phone }).exec();
  }

  /**
   * Front desk entries (BE-15): the patient account for this phone, created if new. A new account
   * has no `phoneVerifiedAt` and no WhatsApp opt-in, so the person's own first login records
   * their consent (same rule as staff accounts).
   */
  async matchOrCreatePatient(phone: string, name: string): Promise<UserDocument> {
    for (let attempt = 0; ; attempt++) {
      try {
        return (await this.users
          .findOneAndUpdate(
            { phone },
            {
              $setOnInsert: {
                phone,
                name,
                roles: ['patient'],
                whatsappOptIn: false,
                status: 'active',
                isDemo: this.config.isDemo,
              },
            },
            { upsert: true, new: true },
          )
          .exec())!;
      } catch (e) {
        if ((e as { code?: number }).code === 11000 && attempt === 0) continue;
        throw e;
      }
    }
  }

  async findById(id: string): Promise<UserDocument | null> {
    return isValidObjectId(id) ? this.users.findById(id).exec() : null;
  }

  /**
   * Called after a correct login OTP. Creates the user with role `patient` on first login
   * (atomic upsert, safe under concurrent logins) and stamps the login.
   */
  async upsertOnLogin(
    phone: string,
    opts: { whatsappOptIn?: boolean },
  ): Promise<{ user: UserDocument; isNew: boolean }> {
    const now = new Date();
    const optIn = opts.whatsappOptIn ?? true;
    const update = {
      $set: { lastLoginAt: now },
      $setOnInsert: {
        phone,
        phoneVerifiedAt: now,
        roles: ['patient'],
        language: 'en',
        whatsappOptIn: optIn,
        consentLog: [
          { type: 'whatsapp', version: WHATSAPP_CONSENT_VERSION, granted: optIn, at: now },
        ],
        status: 'active',
        isDemo: this.config.isDemo,
      },
    };
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await this.users
          .findOneAndUpdate({ phone }, update, {
            upsert: true,
            new: true,
            includeResultMetadata: true,
          })
          .exec();
        if (!res.value) throw new Error('upsert returned no document');
        if (res.lastErrorObject?.updatedExisting && !res.value.phoneVerifiedAt) {
          // Created by someone else (a clinic adding staff): this is the person's own first login,
          // so record their consent and give them the new-user flow (RD BE-08 should-fix 1).
          const claimed = await this.users
            .findOneAndUpdate(
              { _id: res.value._id, phoneVerifiedAt: { $exists: false } },
              {
                $set: { phoneVerifiedAt: now, whatsappOptIn: optIn },
                $addToSet: { roles: 'patient' },
                $push: {
                  consentLog: {
                    type: 'whatsapp',
                    version: WHATSAPP_CONSENT_VERSION,
                    granted: optIn,
                    at: now,
                  },
                },
              },
              { new: true },
            )
            .exec();
          if (claimed) return { user: claimed, isNew: true };
        }
        return { user: res.value, isNew: !res.lastErrorObject?.updatedExisting };
      } catch (e) {
        // Two first logins racing on the unique phone index: the loser retries and finds the row.
        if ((e as { code?: number }).code === 11000 && attempt === 0) continue;
        throw e;
      }
    }
  }

  async getMe(userId: string): Promise<Me> {
    const user = await this.findById(userId);
    if (!user) throw AppException.unauthenticated();
    assertActive(user);
    return toMe(user);
  }

  async updateMe(userId: string, patch: UpdateMeRequest): Promise<Me> {
    if (
      patch.name === undefined &&
      patch.language === undefined &&
      patch.whatsappOptIn === undefined
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Provide at least one field',
        {
          issues: [{ path: '', message: 'Provide at least one of name, language, whatsappOptIn' }],
        },
      );
    }
    const user = await this.findById(userId);
    if (!user) throw AppException.unauthenticated();
    assertActive(user);
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.language !== undefined) user.language = patch.language;
    if (patch.whatsappOptIn !== undefined && patch.whatsappOptIn !== user.whatsappOptIn) {
      user.whatsappOptIn = patch.whatsappOptIn;
      user.consentLog.push({
        type: 'whatsapp',
        version: WHATSAPP_CONSENT_VERSION,
        granted: patch.whatsappOptIn,
        at: new Date(),
      });
    }
    await user.save();
    return toMe(user);
  }
}
