import {
  WHATSAPP_ALERTS_PER_DAY,
  type AdminNotification,
  type Language,
  type MyNotification,
  type NotificationStatus,
  type Page,
} from '@doqto/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, isValidObjectId, Model, Types } from 'mongoose';
import { AppException } from '../common/http/app-exception';
import { istDate } from '../common/time/ist';
import { AppConfig } from '../config/app-config.service';
import {
  renderTemplate,
  WHATSAPP_TEMPLATES,
  type TemplateKey,
} from '../integrations/whatsapp/templates';
import { User } from '../users/user.schema';
import { maskPhone } from './message-format';
import { Notification, NotificationDocument } from './notification.schema';
import { WebPushService } from './web-push.service';
import { ParamSealer } from './seal';

export interface NotifyInput {
  userId: Types.ObjectId | string;
  template: TemplateKey;
  /** Built in the recipient's language (dates, times). */
  params: (language: Language) => readonly string[];
  /** 0-based indices of secret parameters (visit codes): sealed at rest, dropped once sent. */
  secret?: readonly number[];
  /** Unique per message (TDD 6.4), e.g. `delay:<appointmentId>:30`. */
  dedupeKey: string;
  appointmentId?: Types.ObjectId;
  sendAfter?: Date;
  /** A status alert: counts toward the daily WhatsApp cap. */
  alert?: boolean;
}

export interface NotifyResult {
  id: string;
  status: NotificationStatus;
  /** `false` when the dedupe key was already used: nothing new was queued. */
  created: boolean;
}

const SECRET_MASK = '••••';
const isDuplicateKey = (e: unknown) => (e as { code?: unknown } | null)?.code === 11000;

const encodeCursor = (id: Types.ObjectId) => Buffer.from(id.toHexString()).toString('base64url');
function decodeCursor(cursor: string | undefined): Types.ObjectId | undefined {
  if (!cursor) return undefined;
  const hex = Buffer.from(cursor, 'base64url').toString();
  if (!isValidObjectId(hex) || hex.length !== 24) {
    throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid cursor', {
      issues: [{ path: 'cursor', message: 'Invalid cursor' }],
    });
  }
  return new Types.ObjectId(hex);
}

/**
 * BE-21 outbox (TDD 7). `notify()` only writes a row; the sender job delivers it. Business code
 * never calls a messaging provider directly.
 */
@Injectable()
export class NotificationsService {
  readonly sealer: ParamSealer;

  constructor(
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly config: AppConfig,
    private readonly webPush: WebPushService,
  ) {
    this.sealer = new ParamSealer(config.get('HASH_PEPPER'));
  }

  async notify(input: NotifyInput, now = new Date()): Promise<NotifyResult | null> {
    const userId = new Types.ObjectId(input.userId);
    const user = await this.users
      .findById(userId, {
        phone: 1,
        language: 1,
        whatsappOptIn: 1,
        status: 1,
        pushSubscriptions: 1,
      })
      .exec();
    if (!user) return null;
    const language = user.language;
    const params = [...input.params(language)];
    const expected = WHATSAPP_TEMPLATES[input.template].params.length;
    if (params.length !== expected) {
      throw new Error(`${input.template} takes ${expected} parameters, got ${params.length}`);
    }
    // STOP (whatsappOptIn false) routes everything but OTPs to SMS (TDD 7). Web Push needs INT's provider.
    const channel = user.whatsappOptIn ? 'whatsapp' : 'sms';
    let status: NotificationStatus = 'queued';
    let lastError: string | undefined;
    if (user.status !== 'active') {
      status = 'skipped';
      lastError = 'Account is not active';
    }
    const date = istDate(now);
    const capped = status === 'queued' && channel === 'whatsapp' && input.alert === true;
    if (capped && !(await this.reserveAlert(userId, date))) {
      status = 'skipped';
      lastError = `Daily cap of ${WHATSAPP_ALERTS_PER_DAY} WhatsApp alerts reached`;
    }
    const secrets: Record<number, string> = {};
    for (const i of input.secret ?? []) {
      secrets[i] = params[i] ?? '';
      params[i] = '';
    }
    try {
      const row = await this.notifications.create({
        userId,
        phone: user.phone,
        channel,
        template: input.template,
        language,
        params,
        ...(Object.keys(secrets).length && status === 'queued'
          ? { sealed: this.sealer.seal(secrets) }
          : {}),
        dedupeKey: input.dedupeKey,
        status,
        ...(lastError ? { lastError } : {}),
        sendAfter: input.sendAfter ?? now,
        appointmentId: input.appointmentId,
        isDemo: this.config.isDemo,
      });
      // Installed-app users also get a push copy (the text keeps secrets masked).
      if (
        status === 'queued' &&
        this.webPush.enabled &&
        (user.pushSubscriptions?.length ?? 0) > 0
      ) {
        await this.notifications
          .create({
            userId,
            phone: user.phone,
            channel: 'webpush',
            template: input.template,
            language,
            params,
            dedupeKey: `${input.dedupeKey}:push`,
            status: 'queued',
            sendAfter: input.sendAfter ?? now,
            appointmentId: input.appointmentId,
            isDemo: this.config.isDemo,
          })
          .catch((e: unknown) => {
            if (!isDuplicateKey(e)) throw e;
          });
      }
      return { id: row._id.toHexString(), status, created: true };
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
      if (capped && status === 'queued') await this.releaseAlert(userId, date);
      const existing = (await this.notifications
        .findOne({ dedupeKey: input.dedupeKey }, { status: 1 })
        .exec())!;
      return { id: existing._id.toHexString(), status: existing.status, created: false };
    }
  }

  /** One atomic step on the user: counts today's WhatsApp alerts, refusing the fifth. */
  private async reserveAlert(userId: Types.ObjectId, date: string): Promise<boolean> {
    const r = await this.users
      .updateOne(
        {
          _id: userId,
          $or: [
            { 'alertCounter.date': { $ne: date } },
            { 'alertCounter.count': { $lt: WHATSAPP_ALERTS_PER_DAY } },
          ],
        },
        [
          {
            $set: {
              alertCounter: {
                date,
                count: {
                  $cond: [
                    { $eq: ['$alertCounter.date', date] },
                    { $add: ['$alertCounter.count', 1] },
                    1,
                  ],
                },
              },
            },
          },
        ],
      )
      .exec();
    return r.modifiedCount === 1;
  }

  private async releaseAlert(userId: Types.ObjectId, date: string): Promise<void> {
    await this.users
      .updateOne(
        { _id: userId, 'alertCounter.date': date, 'alertCounter.count': { $gt: 0 } },
        { $inc: { 'alertCounter.count': -1 } },
      )
      .exec();
  }

  /** The text the patient sees; secret parameters masked. */
  render(n: Notification): string {
    // Only secret parameters are stored empty.
    const params = n.params.map((p) => (p === '' ? SECRET_MASK : p));
    return renderTemplate(n.template as TemplateKey, n.language, params);
  }

  /** The patient's in-app inbox: their own messages, never the Web Push copies, newest first. */
  async mine(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<Page<MyNotification>> {
    const before = decodeCursor(cursor);
    const rows = await this.notifications
      .find({
        userId: new Types.ObjectId(userId),
        channel: { $ne: 'webpush' },
        status: { $ne: 'skipped' },
        ...(before ? { _id: { $lt: before } } : {}),
      })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();
    const page = rows.slice(0, limit);
    return {
      items: page.map((n) => ({
        id: n._id.toHexString(),
        channel: n.channel,
        template: n.template,
        language: n.language,
        text: this.render(n),
        status: n.status,
        createdAt: n.createdAt.toISOString(),
        sentAt: n.sentAt?.toISOString() ?? null,
        read: Boolean(n.readAt),
        appointmentId: n.appointmentId?.toHexString() ?? null,
      })),
      nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]!._id) : null,
    };
  }

  /** How many inbox messages the patient has not opened yet (the bell's badge). */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notifications
      .countDocuments({
        userId: new Types.ObjectId(userId),
        channel: { $ne: 'webpush' },
        status: { $ne: 'skipped' },
        readAt: { $exists: false },
      })
      .exec();
    return { count };
  }

  /** Marks everything in the inbox as read. */
  async markAllRead(userId: string, now = new Date()): Promise<void> {
    await this.notifications
      .updateMany(
        { userId: new Types.ObjectId(userId), readAt: { $exists: false } },
        { $set: { readAt: now } },
      )
      .exec();
  }

  /** FE-18 admin view. */
  async adminList(
    status: NotificationStatus | undefined,
    cursor: string | undefined,
    limit: number,
  ): Promise<Page<AdminNotification>> {
    const before = decodeCursor(cursor);
    const filter: FilterQuery<Notification> = {
      ...(status ? { status } : {}),
      ...(before ? { _id: { $lt: before } } : {}),
    };
    const rows: NotificationDocument[] = await this.notifications
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();
    const page = rows.slice(0, limit);
    return {
      items: page.map((n) => ({
        id: n._id.toHexString(),
        userId: n.userId.toHexString(),
        phoneMasked: maskPhone(n.phone),
        channel: n.channel,
        template: n.template,
        status: n.status,
        attempts: n.attempts,
        lastError: n.lastError ?? null,
        sendAfter: n.sendAfter.toISOString(),
        createdAt: n.createdAt.toISOString(),
        sentAt: n.sentAt?.toISOString() ?? null,
      })),
      nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]!._id) : null,
    };
  }
}
