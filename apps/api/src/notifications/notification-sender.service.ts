import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProviderInputError,
  SMS_PROVIDER,
  WHATSAPP_PROVIDER,
  type SmsProvider,
  type WhatsAppProvider,
} from '../integrations';
import { scrubError } from '../jobs/jobs.service';
import { JobRunner } from '../jobs/job-runner.service';
import { User } from '../users/user.schema';
import { Notification, NotificationDocument } from './notification.schema';
import { NotificationsService } from './notifications.service';
import { WebPushService } from './web-push.service';

/** First try plus 3 retries (BE-21). */
export const NOTIFICATION_MAX_ATTEMPTS = 4;
export const SEND_INTERVAL_MS = 10_000;
const SEND_LEASE_MS = 60_000;
const BATCH = 100;

/** 30 s, 2 min, 8 min. */
export function notificationBackoffMs(attempts: number): number {
  return 30_000 * 4 ** Math.max(0, attempts - 1);
}

/** BE-21 sender: every 10 seconds, delivers due outbox rows through the providers. */
@Injectable()
export class NotificationSender implements OnModuleInit {
  private readonly logger = new Logger(NotificationSender.name);

  constructor(
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    private readonly outbox: NotificationsService,
    private readonly runner: JobRunner,
    private readonly webPush: WebPushService,
  ) {}

  onModuleInit(): void {
    this.runner.every('notifications-send', SEND_INTERVAL_MS, () =>
      this.sendDue().then(() => undefined),
    );
  }

  /** Claims one due row (or one whose sender died) with a single atomic update. */
  claim(now = new Date()): Promise<NotificationDocument | null> {
    return this.notifications
      .findOneAndUpdate(
        {
          $or: [
            { status: 'queued', sendAfter: { $lte: now } },
            { status: 'sending', lockedUntil: { $lt: now } },
          ],
        },
        {
          $set: { status: 'sending', lockedUntil: new Date(now.getTime() + SEND_LEASE_MS) },
          $inc: { attempts: 1 },
        },
        { sort: { sendAfter: 1 }, new: true },
      )
      .exec();
  }

  /** Sends due rows; returns how many were attempted. */
  async sendDue(max = BATCH): Promise<number> {
    let n = 0;
    for (; n < max; n++) {
      const row = await this.claim();
      if (!row) break;
      await this.sendOne(row);
    }
    return n;
  }

  private async sendOne(row: NotificationDocument): Promise<void> {
    const now = new Date();
    try {
      if (row.channel === 'webpush') {
        const sent = await this.webPush.sendToUser(row.userId, {
          title: 'Doqto',
          body: this.outbox.render(row).replace(/\s+/g, ' ').slice(0, 160),
          url: row.appointmentId
            ? `/appointments/${row.appointmentId.toHexString()}`
            : '/appointments',
          tag: row.template,
        });
        await this.notifications
          .updateOne(
            { _id: row._id, status: 'sending' },
            sent > 0
              ? { $set: { status: 'sent', sentAt: new Date() }, $unset: { lockedUntil: 1 } }
              : {
                  $set: { status: 'skipped', lastError: 'No device accepted the push' },
                  $unset: { lockedUntil: 1 },
                },
          )
          .exec();
        return;
      }
      const params = [...row.params];
      if (row.sealed) {
        for (const [i, v] of Object.entries(this.outbox.sealer.open(row.sealed)))
          params[Number(i)] = v;
      }
      // A STOP since the row was queued moves it to SMS.
      let channel = row.channel;
      if (channel === 'whatsapp') {
        const user = await this.users.findById(row.userId, { whatsappOptIn: 1 }).exec();
        if (user && !user.whatsappOptIn) channel = 'sms';
      }
      const message = { to: row.phone, templateKey: row.template, language: row.language, params };
      const result =
        channel === 'whatsapp'
          ? await this.whatsapp.sendTemplate(message)
          : await this.sms.send(message);
      await this.notifications
        .updateOne(
          { _id: row._id, status: 'sending' },
          {
            $set: {
              status: 'sent',
              channel,
              providerMessageId: result.providerMessageId,
              sentAt: result.sentAt,
            },
            $unset: { sealed: 1, lockedUntil: 1, lastError: 1 },
          },
        )
        .exec();
    } catch (e) {
      const final = e instanceof ProviderInputError || row.attempts >= NOTIFICATION_MAX_ATTEMPTS;
      this.logger.warn(
        `Notification ${row._id.toHexString()} (${row.template}) failed, attempt ${row.attempts}${final ? ', giving up' : ''}`,
      );
      await this.notifications
        .updateOne(
          { _id: row._id, status: 'sending' },
          {
            $set: {
              lastError: scrubError(e),
              ...(final
                ? { status: 'failed' }
                : {
                    status: 'queued',
                    sendAfter: new Date(now.getTime() + notificationBackoffMs(row.attempts)),
                  }),
            },
            $unset: { lockedUntil: 1, ...(final ? { sealed: 1 } : {}) },
          },
        )
        .exec();
    }
  }
}
