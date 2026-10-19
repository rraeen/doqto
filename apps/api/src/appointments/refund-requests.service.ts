import { Injectable, Logger } from '@nestjs/common';
import type { Types } from 'mongoose';

/**
 * Hook for refunds the clinic side causes (doctor on leave or done early, BE-22). Stubbed until
 * BE-29 builds refunds: it only records that a refund is owed. Payments stay out of this module.
 */
@Injectable()
export class RefundRequests {
  private readonly logger = new Logger(RefundRequests.name);

  async clinicCancelled(appointmentId: Types.ObjectId): Promise<void> {
    this.logger.log(
      `Refund owed for clinic-cancelled appointment ${appointmentId.toHexString()} (BE-29)`,
    );
    return Promise.resolve();
  }
}
