# Patient app completion plan

**Date:** 2026-10-21. **Goal:** the patient app works end to end on the real API (no mocks): sign in,
search, book, pay, wait for the doctor, get the visit code, reschedule, cancel with refund, review,
keep records, manage the profile and settings, get notifications.
**Basis:** `docs/plans/patient-backend-audit.md` (what is missing) and the contract in
`packages/shared` (what the web app already expects). The frontend, contract and mocks exist; the work
is the **API behind them**, then wiring the web app to it.

## Status (2026-10-21)

All of Phase A (A1 to A10) and Phase B (B1 to B7) are built and checked. Phase C was run: API e2e `booking` 16, `reviews` 9, `account` 9 plus the existing suites; real-browser runs against the real API for the whole patient journey (see `docs/status/FE.md`). Still open: a Razorpay run with real test keys, and a Web Push test on a real device.

## Ground rules

1. **Contract first.** Every route and shape already exists in `packages/shared`. New shapes
   (records, notification read state, payment fields) are added there first, with a spec.
2. **Same behaviour as the mocks.** The MSW handlers in `apps/web/src/mocks` are the reference
   for what the web app expects; the API must answer the same way (same status codes, same
   `SLOT_TAKEN` / `CONFLICT` errors).
3. **Rules live in `packages/shared`.** Refund, reschedule and review-window rules are already pure
   functions there; the API calls them, never copies them.
4. **Safe by construction.** Double booking is blocked by the unique slot index; payments are
   idempotent; every status change is an atomic `findOneAndUpdate` on the expected status; the
   visit code is hashed at rest, with a sealed copy so the patient can see it again.
5. **Fast.** Lean reads, one aggregate per list (no N+1), indexes for each query, short `Cache-Control`
   on slots, projections on lists.
6. **Each step ships with tests** (unit specs for rules, e2e specs for routes) and is checked with
   `tsc` and `eslint`. Steps are done one at a time in the order below.

## Phase A - Backend

| # | Work | Routes | Notes |
| --- | --- | --- | --- |
| A1 | **Slots and booking core** | `GET /doctors/:id/slots`, `POST /appointments`, `GET /appointments/mine`, `GET /appointments/:id` | Slot list = schedule expansion minus held/booked slots, minus the walk-in share, inside the booking window. Create = `pending_payment`, 10-minute hold, unique-index `SLOT_TAKEN`, order created. List/detail join doctor and clinic in one aggregate. |
| A2 | **Hold expiry job** | (job) | Every minute: `pending_payment` past `holdExpiresAt` becomes `expired`, slot freed. Idempotent. |
| A3 | **Payments** | `POST /payments/demo-pay`, `POST /payments/verify`, webhook handler | `payments` collection (DB doc 3.10). Webhook is the source of truth, idempotent on event id and payment id. Late payment after expiry: confirm if the slot is free, else refund automatically. Razorpay gateway used when test keys are present, demo gateway otherwise. |
| A4 | **Doctor confirms + visit code** | `POST /clinic/appointments/:id/confirm` | Only clinic staff or the doctor. `pending_confirmation` to `confirmed`, 4-digit code issued (hash for check-in, sealed copy so the patient can see it), WhatsApp confirmation queued. |
| A5 | **Cancel and reschedule** | `POST /appointments/:id/cancel`, `POST /appointments/:id/reschedule` | Uses `refundForPatientCancel` and `canReschedule`. Real refund through the payment provider (replaces the `RefundRequests` stub for clinic cancels too). Reschedule moves the slot atomically, keeps fee and visit code. |
| A6 | **Notifications for booking events** | (outbox) | Booking confirmed, cancelled, rescheduled, refund processed, day-before and 2-hour reminders (job). Notification inbox gets read state. |
| A7 | **Reviews** | `GET /reviews/eligibility`, `POST /reviews`, `PATCH /reviews/:id`, `GET /reviews/mine/:appointmentId`, `GET /doctors/:id/reviews`, `POST /reviews/:id/report` | Window and edit rules from `reviewWindow` / `canEditReview`. One review per visit (unique index). Rule-based fraud score, rating-summary recompute (Bayesian) written to `doctor.ratingSummary`. |
| A8 | **Account** | `GET /me/export`, `DELETE /me`, `GET/POST/DELETE /me/push-subscriptions`, `GET /transparency` | Export is everything about the patient. Delete blanks name/phone, revokes tokens, keeps payment amounts. Web Push sender with VAPID keys. |
| A9 | **Records** | new: `GET/POST /me/records`, `GET /me/records/:id/file`, `DELETE /me/records/:id` | Patient-owned uploads (lab reports, prescriptions, scans, vaccination) with category, doctor, date, type (IP/OP). Server-side filter and search, download through a short-lived signed URL. See the ADR 0007 note below. |
| A10 | **Auth review** | existing `/auth/*` | Confirm OTP, refresh, logout behave under the web client; add `logout-all` (revoke every device) and keep the rate limits. |

## Phase B - Web app wiring

| # | Work |
| --- | --- |
| B1 | Turn the booking flag on by default for real-API runs (`NEXT_PUBLIC_BOOKING_API=true`), set `NEXT_PUBLIC_API_MOCKS=false`, document the three run modes. |
| B2 | **Razorpay Checkout** in the booking confirm step: load Checkout when the order's provider is `razorpay` (key id from the order), post the result to `/payments/verify`; keep the demo "Pay" button for the demo gateway. Handle failure, dismiss, and the 10-minute hold timer. |
| B3 | Appointments list/detail/cancel/reschedule/visit code on the real API (the hooks exist; verify every state). |
| B4 | Reviews on the real API (eligibility, form, edit, doctor page list, report). |
| B5 | Records on the real API: upload, filter, search, download. |
| B6 | Profile edit, settings, export, delete account, push subscribe on the real API. |
| B7 | Notifications page on the real API with read state. |

## Phase C - Verification

1. API: unit specs for every rule, e2e specs for each route group (booking race, payment idempotency,
   cancel/refund matrix, reschedule, review windows). E2E needs MongoDB (Docker or Atlas demo DB).
2. Web: `tsc`, `eslint`, `vitest`.
3. **Browser run on the real API** (no mocks) with Puppeteer: sign in, search, book, pay, doctor
   confirm, see the visit code, reschedule, cancel, review, upload and download a record, edit
   profile, export, delete. Plus a latency pass on the hot routes.
4. Fix what the run finds; write the final status.

## Decisions and risks

- **Razorpay "dummy key".** Razorpay test keys need a Razorpay account; invented keys cannot create
  orders. So: placeholders go in `.env.example`; with `PROVIDER_MODE=demo` and no keys, the demo
  gateway behaves like Razorpay (same signed webhook path). When you paste real `rzp_test_` keys the
  same code uses the real test gateway. I cannot verify the live Razorpay calls without those keys.
- **Records vs ADR 0007 (no clinical data in Phase 1).** Records are the patient's own uploaded
  files, stored privately and shown only to them; Doqto does not read, parse or share them. This still
  needs a privacy/legal check before launch (DPDP: health data is sensitive).
- **Doctor confirmation is required** by the product rules, so the patient flow cannot finish alone:
  the doctor/clinic console must confirm. For demos the web app keeps a "play the doctor" button
  that calls the same confirm route (allowed only in demo mode).
- **WhatsApp/SMS** run through the demo providers (messages land in the Demo inbox) until a BSP is
  registered.
- Out of scope: doctor-side console UI, admin moderation UI, native apps.

## Order of work

A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8 → A9 → A10 → B1-B7 → C. Each step is finished and checked before the
next starts; the status of each is recorded in `docs/status/BE.md` and `docs/status/FE.md`.
