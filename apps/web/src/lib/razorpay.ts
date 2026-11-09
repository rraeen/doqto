'use client';

/**
 * Razorpay Standard Checkout (TDD 8). The script is loaded only when a real Razorpay order has to
 * be paid; the demo gateway never loads it. The key id comes with the order from the API, never
 * from a build setting, so a test key and a live key cannot be mixed up.
 */

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: 'INR';
  name: string;
  description: string;
  prefill?: { name?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
  on(
    event: 'payment.failed',
    handler: (response: { error?: { description?: string } }) => void,
  ): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

/** Loads Checkout once; rejects if the script cannot be fetched (offline, blocked). */
export function loadCheckout(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_URL;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      loading = null;
      el.remove();
      reject(new Error('Razorpay Checkout could not be loaded'));
    };
    document.head.appendChild(el);
  });
  return loading;
}

export interface CheckoutInput {
  keyId: string;
  orderId: string;
  /** Paise. */
  amount: number;
  doctorName: string;
  patientName: string;
  patientPhone: string;
}

export type CheckoutResult =
  | { kind: 'paid'; response: RazorpaySuccess }
  | { kind: 'dismissed' }
  | { kind: 'failed'; reason: string };

/** Opens Checkout and settles with how it ended. */
export async function payWithRazorpay(input: CheckoutInput): Promise<CheckoutResult> {
  await loadCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) return { kind: 'failed', reason: 'unavailable' };
  return new Promise<CheckoutResult>((resolve) => {
    const rzp = new Razorpay({
      key: input.keyId,
      order_id: input.orderId,
      amount: input.amount,
      currency: 'INR',
      name: 'Doqto',
      description: input.doctorName,
      prefill: { name: input.patientName, contact: input.patientPhone },
      theme: { color: '#087a08' },
      handler: (response) => resolve({ kind: 'paid', response }),
      modal: { ondismiss: () => resolve({ kind: 'dismissed' }) },
    });
    rzp.on('payment.failed', (r) =>
      resolve({ kind: 'failed', reason: r.error?.description ?? 'failed' }),
    );
    rzp.open();
  });
}
