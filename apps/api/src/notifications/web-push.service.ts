import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as webPush from 'web-push';
import { AppConfig } from '../config/app-config.service';
import { User } from '../users/user.schema';

/** What the service worker shows: a title, one line and where to go. Nothing clinical, ever. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/**
 * Web Push (INT-16, TDD 6.4): alerts for patients who installed the app. Off unless the VAPID key
 * pair is configured. A subscription the push service reports as gone (404 or 410) is removed.
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  readonly enabled: boolean;

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    config: AppConfig,
  ) {
    const pub = config.get('VAPID_PUBLIC_KEY');
    const priv = config.get('VAPID_PRIVATE_KEY');
    this.enabled = Boolean(pub && priv);
    if (this.enabled) webPush.setVapidDetails(config.get('VAPID_SUBJECT'), pub, priv);
  }

  /** Sends to every device of the user; returns how many accepted it. */
  async sendToUser(userId: Types.ObjectId, payload: PushPayload): Promise<number> {
    if (!this.enabled) return 0;
    const user = await this.users.findById(userId, { pushSubscriptions: 1 }).lean().exec();
    const subs = user?.pushSubscriptions ?? [];
    let sent = 0;
    const gone: Types.ObjectId[] = [];
    for (const s of subs as unknown as {
      _id: Types.ObjectId;
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }[]) {
      try {
        await webPush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify(payload),
          { TTL: 3600 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s._id);
        else this.logger.warn(`Web Push failed (${status ?? 'error'})`);
      }
    }
    if (gone.length > 0) {
      await this.users
        .updateOne({ _id: userId }, { $pull: { pushSubscriptions: { _id: { $in: gone } } } })
        .exec();
    }
    return sent;
  }
}
