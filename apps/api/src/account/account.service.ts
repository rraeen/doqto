import {
  DeleteAccountRequestSchema,
  PUSH_SUBSCRIPTIONS_MAX,
  PushSubscriptionRequestSchema,
  type MyDataExport,
  type PushSubscriptionResponse,
  type TransparencyMonth,
  type TransparencyResponse,
} from '@doqto/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Appointment } from '../appointments/appointment.schema';
import { BookingService, conflict } from '../appointments/booking.service';
import { ChangeService } from '../appointments/change.service';
import { AuditService } from '../audit/audit.service';
import { TokenService } from '../auth/token.service';
import { AppException } from '../common/http/app-exception';
import { zodCheck } from '../common/http/zod-check';
import { istDate } from '../common/time/ist';
import { Notification } from '../notifications/notification.schema';
import { ChatService } from '../chat/chat.service';
import { RecordsService } from '../records/records.service';
import { Review } from '../reviews/review.schema';
import { toMyReview } from '../reviews/reviews.service';
import { User } from '../users/user.schema';
import { toMe } from '../users/users.service';

const hashEndpoint = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex');
const ACTIVE_BOOKINGS = ['pending_payment', 'pending_confirmation', 'confirmed'];
const TRANSPARENCY_MONTHS = 6;

/**
 * BE-39 to BE-42: what a patient can do about their own data (DPDP Act 2023): register devices for
 * push, download everything Doqto holds, delete the account, plus the public transparency numbers.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    private readonly booking: BookingService,
    private readonly change: ChangeService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly records: RecordsService,
    private readonly chat: ChatService,
  ) {}

  // ------------------------------------------------------------------ web push devices

  /** Registers a device. The same endpoint twice is one device; the sixth device is refused. */
  async registerPush(
    userId: string,
    raw: unknown,
    now = new Date(),
  ): Promise<PushSubscriptionResponse> {
    const body = zodCheck(PushSubscriptionRequestSchema, raw);
    const endpointHash = hashEndpoint(body.endpoint);
    const _id = new Types.ObjectId(userId);
    const added = await this.users
      .updateOne(
        {
          _id,
          'pushSubscriptions.endpointHash': { $ne: endpointHash },
          [`pushSubscriptions.${PUSH_SUBSCRIPTIONS_MAX - 1}`]: { $exists: false },
        },
        {
          $push: {
            pushSubscriptions: {
              endpointHash,
              endpoint: body.endpoint,
              keys: body.keys,
              createdAt: now,
            },
          },
        },
      )
      .exec();
    const user = await this.users.findById(_id, { pushSubscriptions: 1 }).lean().exec();
    const subs = (user?.pushSubscriptions ?? []) as unknown as {
      _id: Types.ObjectId;
      endpointHash: string;
    }[];
    const mine = subs.find((s) => s.endpointHash === endpointHash);
    if (!mine) {
      throw conflict('You have registered the most devices allowed');
    }
    void added;
    return { id: mine._id.toHexString(), count: Math.max(1, subs.length) };
  }

  async removePush(userId: string, id: string): Promise<void> {
    if (!isValidObjectId(id)) return;
    await this.users
      .updateOne(
        { _id: new Types.ObjectId(userId) },
        { $pull: { pushSubscriptions: { _id: new Types.ObjectId(id) } } },
      )
      .exec();
  }

  // ------------------------------------------------------------------ my data

  /** Everything held about the patient, as one file they can keep (the visit code is left out). */
  async exportData(userId: string, now = new Date()): Promise<MyDataExport> {
    const user = await this.users.findById(userId).exec();
    if (!user) throw AppException.notFound('Account not found');
    const rows = await this.appointments
      .find({ patientUserId: user._id })
      .sort({ _id: -1 })
      .limit(1000)
      .lean()
      .exec();
    const presented = await this.booking.present(rows, now);
    const reviews = await this.reviews
      .find({ patientUserId: user._id })
      .sort({ submittedAt: -1 })
      .exec();
    return {
      generatedAt: now.toISOString(),
      profile: toMe(user),
      appointments: presented.map(({ visitCode: _code, order: _order, ...rest }) => rest),
      reviews: reviews.map((r) => toMyReview(r, now.getTime())),
    };
  }

  // ------------------------------------------------------------------ delete

  /**
   * Deletes the account for good (DB doc 6): open bookings are cancelled with the usual refund,
   * the name and phone are removed from the person and from past appointments, devices and
   * messages are dropped, every session ends. Payment amounts and the doctor's own records of a
   * visit stay, as the law needs, without anything that names the patient.
   */
  async deleteAccount(userId: string, raw: unknown, now = new Date()): Promise<void> {
    zodCheck(DeleteAccountRequestSchema, raw);
    const user = await this.users.findById(userId).exec();
    if (!user || user.status === 'deleted') throw AppException.notFound('Account not found');
    if (user.roles.some((r) => r !== 'patient')) {
      throw conflict('Doctor and clinic accounts are removed by Doqto support');
    }

    const open = await this.appointments
      .find({ patientUserId: user._id, status: { $in: ACTIVE_BOOKINGS } }, { _id: 1 })
      .lean()
      .exec();
    for (const a of open) {
      // A cancellation that fails (it just changed) must not stop the deletion.
      await this.change.cancel(userId, a._id.toHexString(), {}, now).catch((e: unknown) => {
        this.logger.warn(
          `Cancel during account deletion failed: ${e instanceof Error ? e.name : 'error'}`,
        );
      });
    }
    await this.appointments
      .updateMany(
        { patientUserId: user._id },
        {
          $set: { patientName: 'Deleted patient', patientPhone: 'deleted' },
          $unset: { visitCode: 1, visitCodeSealed: 1 },
        },
      )
      .exec();
    await this.records.deleteAllOf(user._id);
    await this.chat.deleteAllOfPatient(user._id);
    await this.notifications.deleteMany({ userId: user._id }).exec();
    await this.tokens.revokeAllForUser(user._id);
    await this.users
      .updateOne(
        { _id: user._id },
        {
          $set: {
            status: 'deleted',
            // The unique phone index needs a value; this can never be a real number.
            phone: `deleted-${user._id.toHexString()}`,
            whatsappOptIn: false,
            deviceHashes: [],
            pushSubscriptions: [],
            clinicIds: [],
          },
          $unset: { name: 1, phoneVerifiedAt: 1, alertCounter: 1 },
        },
      )
      .exec();
    await this.audit.record({
      actorUserId: userId,
      action: 'account.delete',
      entity: 'user',
      entityId: user._id,
    });
  }

  // ------------------------------------------------------------------ transparency

  /** Public monthly review numbers: the proof that reviews are not for sale (TDD 5.7). */
  async transparency(now = new Date()): Promise<TransparencyResponse> {
    const rows = await this.reviews
      .aggregate<{ _id: string; submitted: number; published: number; held: number }>([
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$submittedAt', timezone: 'Asia/Kolkata' },
            },
            submitted: { $sum: 1 },
            published: { $sum: { $cond: [{ $eq: ['$state', 'published'] }, 1, 0] } },
            held: { $sum: { $cond: [{ $eq: ['$state', 'held_for_review'] }, 1, 0] } },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: TRANSPARENCY_MONTHS },
      ])
      .exec();
    const months: TransparencyMonth[] = rows.map((r) => ({
      month: r._id,
      reviewsSubmitted: r.submitted,
      reviewsPublished: r.published,
      reviewsHeld: r.held,
      reviewsRemoved: {},
      appealsFiled: { doctor: 0, patient: 0 },
      appealsUpheld: { doctor: 0, patient: 0 },
    }));
    const current = istDate(now).slice(0, 7);
    if (!months.some((m) => m.month === current)) {
      months.unshift({
        month: current,
        reviewsSubmitted: 0,
        reviewsPublished: 0,
        reviewsHeld: 0,
        reviewsRemoved: {},
        appealsFiled: { doctor: 0, patient: 0 },
        appealsUpheld: { doctor: 0, patient: 0 },
      });
    }
    return { months, updatedAt: now.toISOString() };
  }
}
