# Review: INT-12 Demo payment flow end to end

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved** (no blockers; notes for BE-27)

## What was checked

I read `payment-webhooks.service.ts`, `payment-webhooks.controller.ts`, `demo-pay.ts`, `demo-pay.spec.ts`, the `PAYMENT_WEBHOOKS` and `DEMO_PAY` bindings, and `DemoPaymentProvider.simulatePayment` and `verifyWebhook`.

I ran these in a scratch mirror through `scripts/ops/workspace.sh`:

- `cd apps/api && npx jest src/integrations`: **155 tests, 154 pass**. The one failure is the live Razorpay stub test in `demo-payment.provider.spec.ts`, and both that spec and `live-payment.provider.ts` were being rewritten for INT-13 at the moment I ran it. It is not an INT-12 file. `demo-pay.spec.ts` passes in full. INT should make sure the suite is green again when INT-13 goes to review.
- `pnpm lint` and `pnpm --filter @doqto/api typecheck`: **clean**.

Checklist sections applied: A, C, E, G (webhooks), H, I.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| Demo provider marks the payment paid when the "Pay ₹15 (demo)" action is called | Yes | `DEMO_PAY.pay()` builds a signed `payment.captured` event and returns a checkout response that `verifyPayment` accepts (spec) |
| Drives the same confirm path as the webhook | Yes | `pay()` calls `PaymentWebhooks.process()`, the same method behind `POST /api/v1/webhooks/payments`. There is no second confirm route |

Security points checked:

- The signature is checked on the raw bytes before `JSON.parse`. Unsigned and tampered calls get 401, and the spec shows the handler never runs.
- The signature is checked before the "handler registered" check, so an unsigned caller gets 401, never 503.
- `DEMO_PAY` is `null` in live mode (spec), and no Demo class leaves the barrel. In live mode the webhook route verifies with the Razorpay provider, so a demo-signed event is refused.
- `registerHandler` allows one handler only, so nothing else can listen in on payment events.
- Redeliveries reach the handler with the same `eventId`. Dedupe belongs to BE-27, which matches TDD 8.

## Findings

### Blockers

None.

### Should fix

None.

### Nits

1. `@SkipThrottle()` on the webhook route is right for Razorpay retries. Note in `ENVIRONMENTS.md` (INT-11) that the route relies on signature checks alone, so any edge rate limit must allow Razorpay's IPs.

## Notes for BE-27 (not INT-12 findings)

- `main.ts` and `test/app.ts` do not yet pass `rawBody: true`. Until they do, every webhook gets 400 "raw body unavailable".
- `POST /payments/:id/demo-pay` must pass the **stored** `orderId` and `amountPaise` from the `payments` row, never values from the request body.
- The handler must still check the event's `orderId` and `amountPaise` against the `payments` row before confirming (INT-02 review note), and dedupe on `eventId` and the gateway payment id.
- The handler should not log the raw webhook body outside `webhookLogs`.
