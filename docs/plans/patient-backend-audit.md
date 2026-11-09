# Patient backend audit

> **Update 2026-10-21:** every gap listed here has been built; see `docs/plans/patient-completion-plan.md` and the BE and FE status files. This page is kept as the record of what was missing.

**Date:** 2026-10-21. **Scope:** what the patient app needs from `apps/api` that is not there yet.
**Method:** every path in `ENDPOINTS` (`packages/shared/src/endpoints.ts`) compared with the routes the
API actually serves (`@Controller` / `@Get` / `@Post` in `apps/api/src`), plus a read of the jobs,
notifications, payments and reviews modules. `docs/status/BE.md` agrees: "Sprint 5 next: BE-24 slot
availability and booking".

**Headline:** a patient can sign in, see their profile, search doctors, open a profile, see live status
and their queue position. A patient **cannot book, pay, cancel, reschedule or review**, because none of
those routes exist in the API yet. The web app only works for them with the mock API.

---

## 1. Endpoint coverage (patient routes)

| Area | Endpoint | API today |
| --- | --- | --- |
| Auth | `POST /auth/otp/request`, `/otp/verify`, `/refresh`, `/logout` | Done |
| Profile | `GET /me`, `PATCH /me` | Done |
| Search | `GET /doctors` (filters, near me, cursor, `total`) | Done |
| Profile page | `GET /doctors/:slug` (slug or id) | Done (id lookup added 2026-10-21) |
| Live status | `GET /doctors/:id/status` | Done |
| Queue | `GET /appointments/:id/position` | Done |
| Notifications | `GET /me/notifications` | Done (list only) |
| **Slots** | `GET /doctors/:id/slots` | **Missing** (the slot maths exists in `schedules/slots.ts`, no route) |
| **Book** | `POST /appointments` | **Missing** |
| **My bookings** | `GET /appointments/mine`, `GET /appointments/:id` | **Missing** |
| **Cancel** | `POST /appointments/:id/cancel` | **Missing** |
| **Reschedule** | `POST /appointments/:id/reschedule` | **Missing** |
| **Pay** | `POST /payments/verify`, `POST /payments/demo-pay` | **Missing** (only the webhook receiver exists) |
| **Doctor confirms** | `POST /clinic/appointments/:id/confirm` | **Missing** (clinic console has day sheet, walk-in, check-in, queue only) |
| **Reviews** | `GET /doctors/:id/reviews`, `GET /reviews/eligibility`, `POST /reviews`, `PATCH/DELETE /reviews/:id`, `GET /reviews/mine/:appointmentId`, `POST /reviews/:id/report` | **Missing**; `ReviewsModule` is an empty shell |
| **Data export** | `GET /me/export` | **Missing** |
| **Delete account** | `DELETE /me` (confirm word `DELETE`) | **Missing** |
| **Push** | `GET/POST /me/push-subscriptions`, `DELETE /me/push-subscriptions/:id` | **Missing** |
| **Transparency** | `GET /transparency` (public numbers) | **Missing** |

13 of the 27 patient-facing routes exist; the 14 that do not are the whole booking and review loop.

---

## 2. Gaps by severity

### P0 - the patient cannot complete the core journey

1. **Slot availability** (`GET /doctors/:id/slots`). Needed before anything can be booked. The pure
   function is done (`slots.ts`, tested); it needs a route, the 7-day window, and "taken" slots from
   active appointments.
2. **Booking** (`POST /appointments`). Must be atomic: the unique partial index on a slot already
   exists in `appointment.schema.ts`, so a clash becomes `SLOT_TAKEN` (409). Creates
   `pending_payment` with `holdExpiresAt` (10 min), copies the booking fee, returns the appointment ID.
3. **Payment** (`payments/verify`, `payments/demo-pay`). `PaymentsModule` is empty. Demo provider and
   the webhook receiver exist (`integrations/payment`); the module that turns a payment into
   `pending_confirmation` does not. Webhooks and `verify` must be idempotent.
4. **Hold expiry job.** A `pending_payment` booking must lapse after 10 minutes and free the slot.
   The index for it exists, but no job does it (jobs today: end-of-day only).
5. **Doctor confirms** (`/clinic/appointments/:id/confirm`). Without it a paid booking stays at
   "waiting for the doctor" forever. Confirming issues the 4-digit visit code (`visit-code.ts` is
   ready) and sends the patient the confirmation.
6. **My bookings** (`mine`, `:id`). The Appointments tab and the details page read these. The visit
   code is returned only once, at confirmation (hashed at rest), so the contract needs a documented
   way for the patient to see it again; today the mock stores it in the browser.

### P1 - the patient can book but the loop is incomplete

7. **Cancel with refund.** Rules are pure functions (`refundForPatientCancel`); needs the route, the
   status change, and the refund. `RefundRequests` is a stub that only logs ("Stubbed until BE-29").
   Refunds are never actually issued.
8. **Reschedule.** Route plus `canReschedule`; must keep the same visit code and fee and move a
   `pending_confirmation` booking back to waiting at the new time.
9. **Reviews** (whole module). Eligibility window (`reviewWindow`), one review per visit, edit
   window, report, fraud checks, and the rating summary job that fills `ratingSummary`. Search
   ranking already reads `ratingSummary`, but nothing writes it.
10. **Notifications for the booking events.** The outbox and sender exist (WhatsApp, falling back to
    SMS when not opted in). No booking, payment, confirmation, reschedule, cancel or reminder
    messages are queued because those events do not exist yet. A visit reminder job is also missing.

### P2 - account, trust and operations

11. **Data export and account deletion** (`/me/export`, `DELETE /me`). DPDP expectation; the contract
    is written (`account.ts`), the routes are not. Deletion must blank name/phone on past records,
    revoke tokens, and keep appointment rows needed for the doctor's records.
12. **Push subscriptions.** Three routes plus a Web Push sender (no `web-push` dependency or VAPID
    keys in config). The web app already registers a service worker for it.
13. **Transparency numbers** (`GET /transparency`): counts of verified doctors, reviews and so on,
    public and cached.
14. **Notification inbox read state.** `GET /me/notifications` lists; there is no mark-as-read.
15. **Rate limits for booking.** Global throttling exists; booking and payment routes need their own
    tighter limits and an idempotency key so a double tap does not double book.
16. **E2E coverage.** E2E specs exist for auth, doctors, clinic console, notifications, jobs. None for
    booking, payment, cancel or review, because those routes do not exist.
17. **Search at scale.** `DoctorSearchService` loads up to `MAX_CANDIDATES` doctors and ranks them in
    memory, then slices by an offset cursor. Fine for the pilot (tens of doctors); needs a real query
    or an index-backed sort once a city has hundreds.
18. **Photo hosting.** Doctor photos use a demo local storage controller; live mode needs R2 and a
    public base URL.

---

## 3. Things that work but have an edge

- **Profile cache:** the web profile page caches API answers for 60 seconds, so a doctor who was
  just listed can show "not found" for up to a minute.
- **Search** now accepts no filter at all (lists everyone). Throttling and `limit` protect it, but
  review whether the public directory should require at least one filter in production.
- **Demo seed** is the only data source: 25 doctors (5 original, 20 added 2026-10-21). Ratings are
  empty ("New on Doqto") until reviews exist.
- **Secrets:** `.env` holds a live Atlas connection string; rotate it and keep it out of git.
- **Unrelated failing test:** `templates.spec.ts` (WhatsApp template submission pack out of date).

---

## 4. Suggested build order

| Step | Work | Unblocks |
| --- | --- | --- |
| 1 | Slots route, `POST /appointments`, hold-expiry job | Booking exists |
| 2 | Payments module (`demo-pay`, `verify`, webhook wiring), booking events to outbox | Pay, "waiting for doctor" |
| 3 | Clinic confirm route + visit code issue + `mine` / `:id` | Full Phase 1 loop, visit code on the details page |
| 4 | Cancel, reschedule, real refund (replace `RefundRequests` stub) | Change time and cancel buttons |
| 5 | Reviews module + rating summary job | Reviews, ratings in search |
| 6 | `/me/export`, `DELETE /me`, push subscriptions + sender, `/transparency` | Settings, push, transparency pages |
| 7 | Reminder job, e2e for steps 1-6, search query hardening | Production readiness |

Steps 1-3 are the minimum for the web app to run on the real API instead of the mocks
(`NEXT_PUBLIC_BOOKING_API=true`). Every step should land its e2e spec and any contract change in
`packages/shared` first, so the mocks and the API stay in step.
