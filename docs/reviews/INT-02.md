# Review: INT-02 Provider interfaces and demo implementations

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved** (no blockers; two should-fix items to settle before BE-04 and INT-12, plus notes for later reviews)

## What was checked

I read every file under `apps/api/src/integrations/` (interfaces, `Demo*` and live stubs, module, config, crypto, errors, tokens, barrel and the five specs). `provider-safety.ts` and the INT-03 fields in `test-config.ts` were already present in the folder. They belong to INT-03 and are not reviewed here.

I ran these in a scratch mirror through `scripts/ops/workspace.sh`:

- `cd apps/api && npx jest src/integrations`: **5 suites, 49 tests, all pass**.
- `pnpm lint`: **clean**.
- `pnpm --filter @doqto/api typecheck`: **clean**.

Checklist sections applied: A, C, E, G (webhook parts), H, I. The others are n/a because there are no routes, schemas or UI yet.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| Interfaces `OtpProvider` (`send`, `verify`), `WhatsAppProvider` (`sendTemplate`, `parseWebhook`), `SmsProvider` (`send`), `PaymentProvider` (`createOrder`, `verifyPayment`, `verifyWebhook`, `refund`), `StorageProvider` (`putPrivate`, `putPublic`, `signedUrl`) | Yes | `otp/otp.provider.ts`, `whatsapp/whatsapp.provider.ts`, `sms/sms.provider.ts`, `payment/payment.provider.ts`, `storage/storage.provider.ts` |
| Demo OTP accepts fixed `123456` and still respects attempt limits | Yes | `DEMO_FIXED_OTP` is a constant (`otp/demo-otp.provider.ts`). Expiry and the 5-attempt limit are in `BaseOtpProvider.verify`, shared with live. The spec shows `123456` is refused after 5 wrong tries |
| Demo messages recorded as `sent`, no network call | Yes | `DemoWhatsAppProvider.sendTemplate` and `DemoSmsProvider.send` return `status: 'sent'`. The spec spies on `fetch` and asserts no call |
| Demo payment creates `gateway: 'demo'` orders | Yes | `DemoPaymentProvider.createOrder`. `PaymentGateway = 'demo' \| 'razorpay'` (closes design-doc-differences row 16) |
| Demo storage writes to a local folder | Yes | `DemoStorageProvider` writes under `DEMO_STORAGE_DIR/{public,private}` and rejects traversal keys (spec) |
| One `IntegrationsModule` picks implementations from `PROVIDER_MODE` | Yes | `createProviderSet()` is the only branch on mode, `parseProviderMode` rejects anything but `demo` or `live`, and binding is by Symbol token |
| Live stubs throw "not configured" | Yes | Each live class throws `ProviderNotConfiguredError` naming its story |
| Unit tests for each demo provider | Yes | Four demo specs plus the module spec. `DemoSmsProvider` has no spec of its own, but the OTP spec's SMS-fallback tests exercise it |

Security points checked:

- OTPs are stored only as an HMAC-SHA256 hash, peppered and bound to phone and purpose, and compared in constant time (`crypto.ts`). The plain code never leaves the provider except as the message parameter.
- Live codes come from `crypto.randomInt`.
- Both demo webhooks verify the HMAC on the raw bytes before `JSON.parse`. A missing, short or non-hex signature fails in `safeEqualHex`.
- The demo signing keys come from `HASH_PEPPER` through separate labels, so no extra secret is needed.
- Nothing in the folder logs anything.

## Findings

### Blockers

None.

### Should fix

1. **OTP delivery bypasses the notifications outbox, and two stories assume it doesn't.** `BaseOtpProvider.send` calls the WhatsApp and SMS providers directly. TDD 7 and BE-21 describe the outbox job doing the SMS fallback for OTPs, and INT-08 says the demo walk-in OTP "writes the message to the outbox only".
   - I think the direct send is the better design. Login should not wait for a 10-second outbox job, and an outbox row would have to hold the plain code in `params`, which breaks checklist E (codes are stored as hashes only).
   - Ask: INT notes this design in its status file, and the coordinator tells BE (BE-04, BE-21) and INT (INT-08) that OTPs do not go through the outbox.
   - If a Demo inbox entry is wanted for OTPs, BE writes a `notifications` row with the code masked, never the code itself.
2. **The barrel exports the concrete `DemoPaymentProvider` and `DemoStorageProvider` classes** (`index.ts`). That invites business modules to import a demo class, which ADR 0006 rules out ("business code never branches on demo mode").
   - INT-12 (demo pay action) and the demo storage route need `simulatePayment()` and `verifySignedUrl()`. Better options are to keep those routes inside `apps/api/src/integrations/`, or to bind a narrow `DEMO_PAYMENT_ACTIONS` token that exists only when `PROVIDER_MODE=demo`.
   - Settle this before INT-12. RD will grep for `Demo` imports outside `integrations/` in every BE review.

### Nits

1. `DemoPaymentProvider` keeps orders and refunds in in-memory Maps, so refund idempotency resets when the API restarts. That is fine for demo, provided BE-29 also guards against double refunds through the `payments` row (`refund_pending` / `refunded`).
2. A two-test `demo-sms.provider.spec.ts` (E.164 rejection, records `sent`) would make "each demo provider has tests" true on its face.
3. Both demo webhooks use the same header name (`x-doqto-demo-signature`) with different keys. That is harmless, but separate names would make simulator mistakes easier to read.

## Notes for later reviews (not INT-02 findings)

- **BE-04:** `verify()` does not consume the code. BE must delete the `otps` row (or mark it used) on success, increment `attempts` on `invalid_code` with an atomic `$inc`, and send a new code only by replacing the row.
- **BE-27 / INT-14:** the demo `payment.captured` event carries whatever `orderId` and `amountPaise` it was given. The webhook handler must check both against the `payments` row before confirming, in demo and live alike.
- **BE-16:** demo `123456` at check-in comes from the OTP provider for walk-ins. The booked-patient visit code is BE's own hash, and TDD 13 says demo also accepts `123456` there. Check that this goes through a provider or config binding, not an `if (demo)` in the queue module.

## Requests to other workstreams

- To the coordinator: relay should-fix 1 to BE (BE-04, BE-21) and INT (INT-08).
- To FE (seen while installing, not part of this story): `vitest 5.0.3` warns about an unmet peer, `msw@^2.4.9` (found 3.0.2). Check that MSW 3 works with the vitest mocker before FE-03.

## Re-review log

- Round 2, 2026-10-10 (checked during INT-03): should-fix 2 closed, as Demo classes are no longer exported from `index.ts`. INT reports should-fix 1 handled; RD will confirm OTP-outbox alignment in the BE-04 and BE-21 reviews.
