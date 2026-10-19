# Review: INT-13 Razorpay live adapter

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved as code** (no blockers). Not verified against the real Razorpay API; the five checks in `infra/ENVIRONMENTS.md` ("Razorpay test mode") stay open until Raunak creates test-mode keys.

## What was checked

I read `payment/live-payment.provider.ts`, its spec, the `RAZORPAY_*` keys in `integrations.config.ts` and `.env.example`, and the "Razorpay test mode" section of `infra/ENVIRONMENTS.md`.

- `cd apps/api && npx jest src/integrations` in a scratch mirror: **162 tests, all pass** (the stub-test failure seen during the INT-12 review is gone).
- The full API suite run for the BE reviews earlier today was green, and lint is clean.

Checklist sections applied: A, E (secrets), G (webhooks), H, I.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| Orders API | Yes (fakes only) | `POST /v1/orders`, Basic auth, amount in paise, INR, receipt 1 to 40 characters (spec) |
| HMAC-SHA256 checkout signature check with the key secret | Yes | `order_id|payment_id` with the key secret, constant-time compare. Wrong payment id is rejected (spec) |
| Refunds API | Yes (fakes only) | `POST /v1/payments/:id/refund`, `speed: normal`, paise (spec) |
| Test-mode keys from env | Yes | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; missing keys throw `ProviderNotConfiguredError` before any network call (spec) |
| Never logs secrets | Yes | The class logs nothing. Errors carry only method, the first path segment, HTTP status and Razorpay's error code (spec checks no secret appears) |

Security points checked:

- The webhook signature is checked on the raw bytes with the webhook secret before `JSON.parse`, and a missing `x-razorpay-event-id` is refused, so BE-27 always has an idempotency key.
- Unknown events are acknowledged and ignored, so Razorpay stops retrying them.
- Every call has a 10-second timeout.
- `paymentId` is URL-encoded in the refund path.

## Findings

### Blockers

None.

### Should fix

None.

### Nits

1. If a `payment.captured` or `refund.processed` body has no `amount`, the event carries `amountPaise: undefined` although the type says `number`. Refuse it as `ProviderInputError` like the missing ids, so BE-27's amount check never compares against `undefined`.

## Notes for BE-27, BE-29 and INT-14 (not INT-13 findings)

- **Refund idempotency is not proven.** Passing the idempotency key as `receipt` only prevents double refunds if Razorpay dedupes on it, which is check 4 in `ENVIRONMENTS.md`. Until that check passes, BE-29 must guard with the `payments` row (`refund_pending` before the call, never a blind retry).
- A timeout after Razorpay has accepted an order or refund leaves the outcome unknown. INT-14's nightly reconciliation should cover refunds as well as payments.
- `notes` are stored by Razorpay and shown in its dashboard. BE should put only ids there (appointment id, never a patient phone or name).
