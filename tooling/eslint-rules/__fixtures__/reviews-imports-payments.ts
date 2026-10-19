// Deliberate violation (INT-01): linted as apps/api/src/reviews/reviews.service.ts
// by no-payments-in-trust-code.test.mjs. Must fail lint.
import { PaymentsService } from '../payments/payments.service';

export class ReviewsService {
  constructor(private readonly payments: PaymentsService) {}
}
