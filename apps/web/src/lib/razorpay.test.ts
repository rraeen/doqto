import { afterEach, describe, expect, it } from 'vitest';
import { payWithRazorpay } from './razorpay';

interface Success {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface Opts {
  key: string;
  order_id: string;
  amount: number;
  prefill: { name: string; contact: string };
  handler: (r: Success) => void;
  modal: { ondismiss: () => void };
}
interface Drive {
  opts: Opts;
  fail: (description: string) => void;
}

/** A stand-in for Razorpay Checkout: `script` decides how the payment ends. */
function installCheckout(script: (drive: Drive) => void): Opts[] {
  const opened: Opts[] = [];
  class Razorpay {
    private onFailed: ((r: { error?: { description?: string } }) => void) | null = null;
    constructor(private readonly opts: Opts) {}
    on(_event: string, cb: (r: { error?: { description?: string } }) => void) {
      this.onFailed = cb;
    }
    open() {
      opened.push(this.opts);
      script({ opts: this.opts, fail: (d) => this.onFailed?.({ error: { description: d } }) });
    }
  }
  (window as unknown as { Razorpay: unknown }).Razorpay = Razorpay;
  return opened;
}

const input = {
  keyId: 'rzp_test_abc',
  orderId: 'order_1',
  amount: 1500,
  doctorName: 'Dr Anita Sharma',
  patientName: 'Asha Devi',
  patientPhone: '+919876543210',
};

describe('Razorpay Checkout helper', () => {
  afterEach(() => {
    delete (window as unknown as { Razorpay?: unknown }).Razorpay;
  });

  it('opens Checkout with the order from the API and returns the signed result', async () => {
    const paid: Success = {
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    };
    const opened = installCheckout(({ opts }) => opts.handler(paid));
    expect(await payWithRazorpay(input)).toEqual({ kind: 'paid', response: paid });
    expect(opened[0]).toMatchObject({
      key: 'rzp_test_abc',
      order_id: 'order_1',
      amount: 1500,
      prefill: { name: 'Asha Devi', contact: '+919876543210' },
    });
  });

  it('reports a closed window', async () => {
    installCheckout(({ opts }) => opts.modal.ondismiss());
    expect(await payWithRazorpay(input)).toEqual({ kind: 'dismissed' });
  });

  it('reports a failed payment with the gateway reason', async () => {
    installCheckout(({ fail }) => fail('Card declined'));
    expect(await payWithRazorpay(input)).toEqual({ kind: 'failed', reason: 'Card declined' });
  });
});
