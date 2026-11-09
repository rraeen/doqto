'use client';

import { HOLD_MINUTES, refundForPatientCancel } from '@doqto/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import type { AppointmentCardData } from '@/lib/appointments-view';
import { useAppointments } from '@/components/appointments/use-appointments';
import {
  useCancelAppointment,
  useDemoPay,
  useVerifyPayment,
} from '@/lib/booking-api';
import { changeDemoBooking } from '@/lib/demo-bookings';
import { formatRupees } from '@/lib/money';
import { payWithRazorpay } from '@/lib/razorpay';
import { useNow } from '@/lib/use-now';

/** The booking fee of the example and demo bookings, in paise. */
const DEMO_BOOKING_FEE = 1500;

/** Minutes left on a payment hold, rounded up; `0` once it has run out. */
export function holdMinutesLeft(holdExpiresAt: string | null | undefined, now: number): number {
  if (!holdExpiresAt || now === 0) return 0;
  // `now` is rounded down to the minute, so cap at the hold length instead of showing 11.
  return Math.min(HOLD_MINUTES, Math.max(0, Math.ceil((Date.parse(holdExpiresAt) - now) / 60_000)));
}

/** Bookings that can still be cancelled: waiting for payment, for the doctor, or confirmed. */
export function canCancel(a: AppointmentCardData): boolean {
  return (
    a.status === 'pending_payment' ||
    a.status === 'pending_confirmation' ||
    a.status === 'confirmed'
  );
}

/** The booking fee: from the booking, or the demo fee for example bookings. */
export const feeOf = (a: AppointmentCardData) => a.fee ?? DEMO_BOOKING_FEE;

/** The payment step for a booking on hold: what is due, the time left, and the Pay button. */
export function PayHold({ a }: { a: AppointmentCardData }) {
  const { t, locale } = useI18n();
  const now = useNow();
  const pay = useDemoPay();
  const verify = useVerifyPayment();
  const { me } = useAppointments();
  const [checkingOut, setCheckingOut] = useState(false);
  if (a.status !== 'pending_payment') return null;
  const timed = Boolean(a.holdExpiresAt);
  const left = holdMinutesLeft(a.holdExpiresAt, now);
  const expired = timed && now > 0 && left === 0;
  const fee = formatRupees(feeOf(a), locale === 'hi' ? 'hi-IN' : 'en-IN');

  const payNow = () => {
    if (!a.api) {
      // Demo and example bookings: the payment is pretend, and is remembered on this device.
      changeDemoBooking(a.id, { status: 'pending_confirmation', holdExpiresAt: null });
      toast.success(t('appointments.paid'));
      return;
    }
    const order = a.api.order;
    if (order?.provider === 'razorpay' && order.keyId) {
      // Real gateway (Razorpay test or live key): Checkout, then the API checks the signature.
      setCheckingOut(true);
      payWithRazorpay({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        doctorName: a.doctor.name,
        patientName: me.data?.name ?? '',
        patientPhone: me.data?.phone ?? '',
      })
        .then((result) => {
          if (result.kind === 'paid') {
            verify.mutate(
              {
                appointmentId: a.id,
                razorpayOrderId: result.response.razorpay_order_id,
                razorpayPaymentId: result.response.razorpay_payment_id,
                razorpaySignature: result.response.razorpay_signature,
              },
              {
                onSuccess: () => toast.success(t('appointments.paid')),
                onError: () => toast.error(t('appointments.paymentCheckFailed')),
              },
            );
          } else if (result.kind === 'failed') {
            toast.error(t('appointments.paymentFailed'));
          } else {
            toast(t('appointments.paymentDismissed'));
          }
        })
        .catch(() => toast.error(t('appointments.paymentUnavailable')))
        .finally(() => setCheckingOut(false));
      return;
    }
    pay.mutate(a.id, {
      onSuccess: () => toast.success(t('appointments.paid')),
      onError: () => toast.error(t('common.somethingWrong')),
    });
  };

  return (
    <div className="flex flex-col items-center gap-2 sm:items-end">
      <p
        className={
          expired ? 'text-sm font-semibold text-danger' : 'text-sm font-semibold text-warning'
        }
      >
        {expired
          ? t('appointments.holdExpired')
          : timed
            ? t('appointments.payWithin', { minutes: left })
            : t('appointments.payToKeep')}
      </p>
      <Button
        type="button"
        size="sm"
        className="px-5"
        loading={pay.isPending || verify.isPending || checkingOut}
        disabled={expired}
        onClick={payNow}
      >
        {t(
          a.api?.order?.provider === 'razorpay' ? 'appointments.payNowReal' : 'appointments.payNow',
          {
            fee,
          },
        )}
      </Button>
    </div>
  );
}

/** Cancel with the refund rule explained before the patient confirms. */
export function CancelButton({ a, className }: { a: AppointmentCardData; className?: string }) {
  const { t, locale } = useI18n();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const cancel = useCancelAppointment();
  // `now` is 0 until the browser has hydrated; the server applies the real rule on cancel.
  if (!canCancel(a) || now === 0) return null;

  const fee = feeOf(a);
  const refund = refundForPatientCancel({
    status: a.status,
    slotStart: a.start,
    bookingFee: fee,
    now,
  });
  const fmt = (paise: number) => formatRupees(paise, locale === 'hi' ? 'hi-IN' : 'en-IN');
  const rule =
    a.status === 'pending_payment'
      ? t('appointments.cancelUnpaid')
      : refund.kind === 'full'
        ? t('appointments.cancelRefundFull', { fee: fmt(refund.amount) })
        : t('appointments.cancelRefundNone');

  const done = (refundAmount: number) => {
    setOpen(false);
    toast.success(
      refundAmount > 0
        ? t('appointments.cancelledRefund', { fee: fmt(refundAmount) })
        : t('appointments.cancelled'),
    );
  };

  const confirm = () => {
    if (!a.api) {
      // Demo and example bookings: remembered on this device only.
      changeDemoBooking(a.id, { status: 'cancelled_by_patient' });
      done(refund.amount);
      return;
    }
    cancel.mutate(
      { id: a.id },
      {
        onSuccess: (res) => done(res.refund.amount),
        onError: () => toast.error(t('common.somethingWrong')),
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className ?? 'px-5 text-danger'}
        onClick={() => setOpen(true)}
      >
        {t('appointments.cancel')}
      </Button>
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t('appointments.cancelTitle')}
        description={a.doctor.name}
        confirmLabel={t('appointments.cancelConfirm')}
        cancelLabel={t('appointments.cancelKeep')}
        danger
        loading={cancel.isPending}
        onConfirm={confirm}
      >
        <p className="rounded-xl bg-brand-500/10 px-4 py-3 text-sm font-medium text-ink">{rule}</p>
      </ConfirmSheet>
    </>
  );
}
