import { type PaymentOrder as OrderShape, type PaymentResult } from '@doqto/shared';
import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { toAppointment } from '../appointments/appointment.mappers';
import {
  Appointment,
  AppointmentDocument,
  STATUS_HISTORY_MAX,
} from '../appointments/appointment.schema';
import { AppException } from '../common/http/app-exception';
import {
  DEMO_PAY,
  INTEGRATIONS_CONFIG,
  PAYMENT_PROVIDER,
  PAYMENT_WEBHOOKS,
  type DemoPay,
  type IntegrationsConfig,
  type PaymentEventHandler,
  type PaymentProvider,
  type PaymentWebhookEvent,
  type PaymentWebhooks,
} from '../integrations';
import { dateParam, doctorNameParam, rupeesParam } from '../notifications/message-format';
import { NotificationsService } from '../notifications/notifications.service';
import { Doctor } from '../doctors/doctor.schema';
import { Payment, PaymentDocument } from './payment.schema';

const isDuplicateKey = (e: unknown) => (e as { code?: unknown } | null)?.code === 11000;

const history = (status: string, note: string, at: Date) => ({
  $push: { statusHistory: { $each: [{ status, at, note }], $slice: -STATUS_HISTORY_MAX } },
});

/**
 * Booking-fee payments (TDD 8). The gateway's signed webhook is the source of truth; the
 * Checkout `verify` call and the demo "Pay" button reach the same idempotent confirmation, so a
 * patient who closes the app mid-payment is still booked, and a retried webhook changes nothing.
 */
@Injectable()
export class PaymentsService implements PaymentEventHandler, OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(PAYMENT_WEBHOOKS) private readonly webhooks: PaymentWebhooks,
    @Inject(DEMO_PAY) private readonly demo: DemoPay | null,
    @Inject(INTEGRATIONS_CONFIG) private readonly config: IntegrationsConfig,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.webhooks.registerHandler(this);
  }

  // ------------------------------------------------------------------ orders

  /** Creates the gateway order for a held booking and records it. */
  async createOrder(a: {
    id: string;
    patientUserId: Types.ObjectId;
    amount: number;
    isDemo: boolean;
  }): Promise<OrderShape> {
    const order = await this.provider.createOrder({
      amountPaise: a.amount,
      receipt: a.id,
      notes: { appointmentId: a.id },
    });
    await this.payments.create({
      appointmentId: new Types.ObjectId(a.id),
      patientUserId: a.patientUserId,
      amount: order.amountPaise,
      gateway: order.gateway,
      gatewayOrderId: order.orderId,
      isDemo: a.isDemo,
    });
    return this.toOrder(order.orderId, order.amountPaise, order.gateway);
  }

  /** The order still waiting to be paid for a held booking, so the patient can pay later. */
  async openOrder(appointmentId: Types.ObjectId): Promise<OrderShape | null> {
    const p = await this.payments
      .findOne({ appointmentId, status: { $in: ['created', 'failed'] } })
      .sort({ _id: -1 })
      .lean()
      .exec();
    return p ? this.toOrder(p.gatewayOrderId, p.amount, p.gateway) : null;
  }

  /** Open orders for several held bookings, in one query (the "my appointments" list). */
  async openOrders(appointmentIds: Types.ObjectId[]): Promise<Map<string, OrderShape>> {
    const out = new Map<string, OrderShape>();
    if (appointmentIds.length === 0) return out;
    const rows = await this.payments
      .find({ appointmentId: { $in: appointmentIds }, status: { $in: ['created', 'failed'] } })
      .sort({ _id: 1 })
      .lean()
      .exec();
    // Oldest first, so the newest order of a booking wins.
    for (const p of rows) {
      out.set(p.appointmentId.toHexString(), this.toOrder(p.gatewayOrderId, p.amount, p.gateway));
    }
    return out;
  }

  private toOrder(orderId: string, amount: number, gateway: 'demo' | 'razorpay'): OrderShape {
    return {
      provider: gateway,
      orderId,
      amount,
      currency: 'INR',
      keyId: gateway === 'razorpay' ? (this.config.razorpay.keyId ?? null) : null,
    };
  }

  // ------------------------------------------------------------------ patient actions

  private async ownAppointment(userId: string, id: string): Promise<AppointmentDocument> {
    const a = isValidObjectId(id) ? await this.appointments.findById(id).exec() : null;
    if (!a || a.patientUserId.toHexString() !== userId) {
      throw AppException.notFound('Appointment not found');
    }
    return a;
  }

  /** Demo mode only: the "Pay" button. Goes through the same signed-webhook path as Razorpay. */
  async demoPay(userId: string, appointmentId: string): Promise<PaymentResult> {
    if (!this.demo) throw AppException.notFound('Not found');
    if (!isValidObjectId(appointmentId)) throw AppException.notFound('Appointment not found');
    // The two lookups do not depend on each other, so they share one round trip's wait.
    const [a, payment] = await Promise.all([
      this.ownAppointment(userId, appointmentId),
      this.payments
        .findOne({
          appointmentId: new Types.ObjectId(appointmentId),
          status: { $in: ['created', 'failed'] },
        })
        .sort({ _id: -1 })
        .exec(),
    ]);
    if (a.status !== 'pending_payment') return { appointment: toAppointment(a) };
    if (!payment) throw AppException.notFound('No payment is waiting for this booking');
    await this.demo.pay({ orderId: payment.gatewayOrderId, amountPaise: payment.amount });
    return { appointment: toAppointment((await this.appointments.findById(a._id).exec())!) };
  }

  /** Razorpay Checkout result: the signature is checked, then the booking moves forward once. */
  async verify(
    userId: string,
    body: {
      appointmentId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ): Promise<PaymentResult> {
    const a = await this.ownAppointment(userId, body.appointmentId);
    const payment = await this.payments
      .findOne({ gatewayOrderId: body.razorpayOrderId, appointmentId: a._id })
      .exec();
    if (!payment) throw AppException.notFound('Payment not found');
    const ok = this.provider.verifyPayment({
      orderId: body.razorpayOrderId,
      paymentId: body.razorpayPaymentId,
      signature: body.razorpaySignature,
    });
    if (!ok) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'The payment could not be verified',
        { issues: [{ path: 'razorpaySignature', message: 'Signature does not match' }] },
      );
    }
    await this.applyCaptured(payment, body.razorpayPaymentId, `verify:${body.razorpayPaymentId}`);
    return { appointment: toAppointment((await this.appointments.findById(a._id).exec())!) };
  }

  // ------------------------------------------------------------------ gateway events

  async handle(event: PaymentWebhookEvent): Promise<void> {
    if (event.type === 'payment.captured') {
      const payment = await this.payments.findOne({ gatewayOrderId: event.orderId }).exec();
      if (!payment) return void this.logger.warn('Captured payment for an unknown order');
      if (payment.amount !== event.amountPaise) {
        // A different amount than we asked for: never confirm on it.
        return void this.logger.error(`Amount mismatch on payment ${payment.id}`);
      }
      return this.applyCaptured(payment, event.paymentId, event.eventId);
    }
    if (event.type === 'payment.failed') {
      await this.payments
        .updateOne(
          { gatewayOrderId: event.orderId, status: 'created' },
          { $set: { status: 'failed' }, $addToSet: { processedEventIds: event.eventId } },
        )
        .exec();
      return;
    }
    // refund.processed
    const payment = await this.payments.findOne({ gatewayPaymentId: event.paymentId }).exec();
    if (!payment) return;
    const first = await this.payments
      .updateOne(
        { _id: payment._id, processedEventIds: { $ne: event.eventId } },
        {
          $set: {
            status: 'refunded',
            refund: {
              id: event.refundId,
              amount: event.amountPaise,
              reason: payment.refund?.reason ?? 'refund',
              at: event.at,
            },
          },
          $addToSet: { processedEventIds: event.eventId },
        },
      )
      .exec();
    if (first.modifiedCount === 1) await this.notifyRefund(payment, event.amountPaise);
  }

  /**
   * Idempotent: marks the payment paid and moves the booking from `pending_payment` to
   * `pending_confirmation` (waiting for the doctor). A payment that arrives after the hold lapsed
   * revives the booking if the slot is still free; otherwise it is refunded in full.
   */
  private async applyCaptured(
    payment: PaymentDocument,
    gatewayPaymentId: string,
    eventId: string,
  ): Promise<void> {
    // One update (an aggregation pipeline): a payment still open becomes paid, one that is already
    // paid or refunded keeps its state, and the event is remembered either way.
    const open = { $in: ['$status', ['created', 'failed']] };
    await this.payments
      .updateOne({ _id: payment._id }, [
        {
          $set: {
            status: { $cond: [open, 'paid', '$status'] },
            gatewayPaymentId: { $cond: [open, gatewayPaymentId, '$gatewayPaymentId'] },
            signatureVerified: { $cond: [open, true, '$signatureVerified'] },
            processedEventIds: { $setUnion: ['$processedEventIds', [eventId]] },
          },
        },
      ])
      .exec();

    const now = new Date();
    const forward = {
      $set: { status: 'pending_confirmation', paymentId: payment._id },
      $unset: { holdExpiresAt: 1 },
      ...history('pending_confirmation', 'payment received', now),
    };
    const moved = await this.appointments
      .updateOne({ _id: payment.appointmentId, status: 'pending_payment' }, forward)
      .exec();
    if (moved.modifiedCount === 1) return;

    const a = await this.appointments.findById(payment.appointmentId).exec();
    if (!a) return;
    if (a.status === 'expired') {
      try {
        const revived = await this.appointments
          .updateOne({ _id: a._id, status: 'expired' }, forward)
          .exec();
        if (revived.modifiedCount === 1) return;
      } catch (e) {
        if (!isDuplicateKey(e)) throw e;
        // The slot was booked by someone else in the meantime: refund below.
      }
      await this.refundPayment(a, 'late_payment', { lateApology: true });
      return;
    }
    if (a.status === 'cancelled_by_patient' || a.status === 'cancelled_by_clinic') {
      await this.refundPayment(a, 'cancelled_before_payment');
    }
    // Any other status means the booking already moved past payment: nothing to do.
  }

  // ------------------------------------------------------------------ refunds

  /**
   * Returns the booking fee of `a` through the gateway (full amount; Phase 1 has no partial
   * refunds). Safe to call twice: the gateway call is keyed by the payment, and an already
   * refunded payment is left alone. `null` when the booking was never paid.
   */
  async refundPayment(
    a: Pick<AppointmentDocument, '_id' | 'doctorId'>,
    reason: string,
    opts: { lateApology?: boolean; notify?: boolean } = {},
  ): Promise<{ amount: number } | null> {
    const payment = await this.payments
      .findOne({ appointmentId: a._id, status: { $in: ['paid', 'refund_pending'] } })
      .exec();
    if (!payment?.gatewayPaymentId || payment.refund?.id) return null;
    let result;
    try {
      result = await this.provider.refund({
        paymentId: payment.gatewayPaymentId,
        amountPaise: payment.amount,
        reason,
        idempotencyKey: `refund:${payment.id}`,
      });
    } catch (e) {
      // The booking is already cancelled: record that money is owed and let the job retry.
      this.logger.error(
        `Refund of payment ${payment.id} failed: ${e instanceof Error ? e.name : 'error'}`,
      );
      await this.payments
        .updateOne(
          { _id: payment._id, status: 'paid' },
          { $set: { status: 'refund_pending', refundOwedReason: reason } },
        )
        .exec();
      return null;
    }
    await this.payments
      .updateOne(
        { _id: payment._id, status: { $in: ['paid', 'refund_pending'] } },
        {
          $set: {
            status: result.status === 'processed' ? 'refunded' : 'refund_pending',
            refund: { id: result.refundId, amount: result.amountPaise, reason, at: new Date() },
          },
          $unset: { refundOwedReason: 1 },
        },
      )
      .exec();
    if (result.status === 'processed' && opts.notify !== false) {
      if (opts.lateApology) await this.notifyLateRefund(payment, a.doctorId);
      else await this.notifyRefund(payment, result.amountPaise);
    }
    return { amount: result.amountPaise };
  }

  /** Job: retries refunds whose gateway call failed (the booking was cancelled regardless). */
  async retryOwedRefunds(): Promise<number> {
    const owed = await this.payments
      .find({ status: 'refund_pending', 'refund.id': { $exists: false } })
      .limit(50)
      .lean()
      .exec();
    let done = 0;
    for (const p of owed) {
      const a = await this.appointments.findById(p.appointmentId, { doctorId: 1 }).exec();
      if (!a) continue;
      if (await this.refundPayment(a, p.refundOwedReason ?? 'retry')) done++;
    }
    return done;
  }

  private async notifyRefund(payment: PaymentDocument, amount: number): Promise<void> {
    const a = await this.appointments.findById(payment.appointmentId, { date: 1 }).lean().exec();
    await this.notifications.notify({
      userId: payment.patientUserId,
      template: 'refund_processed',
      params: (language) => [rupeesParam(amount), dateParam(a?.date ?? '', language)],
      dedupeKey: `refund:${payment.id}`,
      appointmentId: payment.appointmentId,
    });
  }

  private async notifyLateRefund(payment: PaymentDocument, doctorId: Types.ObjectId) {
    const d = await this.doctors.findById(doctorId, { name: 1, slug: 1 }).lean().exec();
    await this.notifications.notify({
      userId: payment.patientUserId,
      template: 'late_payment_refunded',
      params: () => [
        rupeesParam(payment.amount),
        doctorNameParam(d?.name ?? ''),
        `${process.env.WEB_PUBLIC_URL ?? ''}/d/${d?.slug ?? ''}`,
      ],
      dedupeKey: `late-refund:${payment.id}`,
      appointmentId: payment.appointmentId,
    });
  }
}
