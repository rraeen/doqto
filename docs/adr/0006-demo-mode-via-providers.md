# 0006. Demo mode through provider implementations

- Status: Accepted, 2026-10-09 (Raunak; TDD section 13)

## Context

WhatsApp BSP approval, MSG91 DLT registration and Razorpay KYC take days to weeks. Doctors and patients need to try signup, booking and the queue before then. A fixed OTP means anyone can log in as anyone, so it must be impossible to reach production data.

## Decision

- Every external service is behind an interface in `apps/api/src/integrations`: `OtpProvider`, `WhatsAppProvider`, `SmsProvider`, `PaymentProvider`, `StorageProvider`. Each has a `Demo*` and a live implementation.
- `PROVIDER_MODE=demo|live` picks the implementations once at startup. No header, query flag, cookie or endpoint can change it.
- Demo behaviour: OTP and walk-in OTP accept `123456` while still creating the `otps` row and running attempt and rate limits; messages are written to the outbox as `sent` and shown in a Demo inbox; payments use `gateway: 'demo'` and a "Pay ₹15 (demo)" button that drives the same confirm path as the webhook; storage writes to a local folder.
- Safety: the API refuses to start in demo mode unless the database name starts with `doqto_demo`, or in demo mode with `NODE_ENV=production` on a production database; it refuses to start in live mode if any `Demo*` provider is bound. Demo runs on its own deployment (`demo.doqto.in`) and database. Demo data is flagged `isDemo: true`. Every screen shows the demo banner.

## Consequences

- Going live is a configuration change plus the TDD 13 checklist, not a code change.
- Business code must never branch on demo mode; only the provider binding differs. Review flags any `if (demo)` in business modules.
- The `payments.gateway` enum includes `'demo'`.

## When to revisit

Never removed: the demo deployment stays for sales demos after launch, still isolated.
