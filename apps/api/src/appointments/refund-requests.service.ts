import { Injectable } from '@nestjs/common';
import type { Types } from 'mongoose';
import { PaymentsService } from '../payments/payments.service';

/**
 * Refunds the clinic side causes (doctor on leave or done early, BE-22): the booking fee goes
 * back in full through the gateway. The patient is told by the cancellation message, so no
 * second "refund processed" message is sent. A failed gateway call is retried by the job.
 */
@Injectable()
export class RefundRequests {
  constructor(private readonly payments: PaymentsService) {}

  async clinicCancelled(a: { _id: Types.ObjectId; doctorId: Types.ObjectId }): Promise<void> {
    await this.payments.refundPayment(a, 'clinic_cancelled', { notify: false });
  }
}
