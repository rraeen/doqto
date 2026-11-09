# Patient frontend roadmap: closing the audit gaps

**Date:** 2026-10-20
**Inputs:** [patient frontend audit](./patient-frontend-audit.md), [BACKLOG.md](../../BACKLOG.md) (story ids FE-xx, BE-xx, INT-xx, RD-xx), [technical design](../doqto-technical-design.md) section 4, [ADR 0007](../adr/0007-no-clinical-data-phase-1.md).
**Scope:** how and where to build each missing patient feature. Backend is built next; this plan says what the frontend can do now, what it must wait for, and what the backend must provide.

---

## 1. What already exists (so we don't rebuild it)

| Need | State today |
| --- | --- |
| Doctor live status | Backend done: `GET /doctors/:id/status` (`apps/api/src/status`). Contract in `packages/shared/src/status.ts`. |
| Position in queue for a booking | Backend done: `GET /appointments/:id/position` (`apps/api/src/appointments`). |
| Patient notification list | Backend done: `GET /me/notifications` (`apps/api/src/notifications`). |
| Profile read / update | Backend done: `GET` and `PATCH /me`. |
| Appointment create, list, cancel | **Not built.** Only the `Appointment` schema exists in the contract. Backend stories BE-24 to BE-29. |
| Payments | Module empty. Demo provider done (INT-12). Backend BE-27. |
| Reviews | Module empty. Backend BE-31 to BE-38. |
| Push, account deletion, transparency | Backend BE-39, BE-41, BE-42. |
| Records, Consult, Prescriptions | **Not in the backlog at all** (Phase 2 per ADR 0007). |

Most of what the audit calls "missing" is already a numbered story in the backlog. The frontend work is the FE-16 to FE-31 stories, plus a few items the backlog does not cover (listed in section 6).

## 2. How the frontend will be built

1. **Contract first.** Every endpoint is added to `packages/shared/src/endpoints.ts` with Zod schemas by backend (BE owns `packages/shared`). The web app never defines its own API types.
2. **Mocks in parallel.** For each new endpoint, add an MSW handler in `apps/web/src/mocks/handlers-v1.ts` (data in `mocks/db.ts`) so the screen is built and tested before the real endpoint exists. Switching to real is changing an environment flag, not code.
3. **One hook module per resource** in `apps/web/src/lib/api/` (same pattern as `doctors.ts`, `clinics.ts`): `appointments.ts`, `reviews.ts`, `status.ts`, `notifications.ts`. Components call hooks, never `fetch`.
4. **Replace demo stores behind the same shape.** `lib/demo-bookings.ts` and `lib/demo-consults.ts` stay only for preview mode. The booking and appointments screens read from the new hooks; a single flag decides which source feeds them, so the UI does not change when the backend lands.
5. **Every data screen gets four states:** loading skeleton, empty, error with retry, and offline. Use `EmptyState`, `Skeleton` and the route `error.tsx`.
6. **Done means:** typecheck, lint, unit tests, a 360px check, English and Hindi strings, keyboard and screen-reader pass for new screens.

## 3. Where code goes

| Area | Location |
| --- | --- |
| New API hooks | `apps/web/src/lib/api/{appointments,reviews,status,notifications}.ts` |
| Mocks | `apps/web/src/mocks/handlers-v1.ts`, `mocks/db.ts` |
| Booking flow | `components/booking/` (`booking-flow.tsx`, `booking-confirm.tsx`), `lib/booking.ts`, `lib/availability.ts` (client slot maths is replaced by the slots endpoint) |
| My appointments, cancel, live position | `components/appointments/` (`appointments-page.tsx`, `use-appointments.ts`), `lib/appointments-view.ts` |
| Live status | new `components/status/` (`live-status-card.tsx`, `queue-position.tsx`, `use-live-status.ts` polling hook), route `app/(patient)/d/[slug]/live/page.tsx` |
| Reviews | new `components/reviews/` (`review-form.tsx`, `review-list.tsx`, `rating-bars.tsx`, `eligibility-list.tsx`), route `app/(patient)/reviews/[appointmentId]/page.tsx`, reviews block in `components/doctor-page/profile-view.tsx` |
| Notifications | new `app/(patient)/notifications/page.tsx`, `components/notifications/`, unread count in `components/shell/notifications-bell.tsx` |
| Legal and trust | new `app/(home)/{terms,refunds,contact,transparency}/page.tsx`; privacy text stays in `lib/privacy-content.ts` |
| Settings and data rights | `components/profile/` (new `profile-settings.tsx`), route `app/(patient)/profile/settings/page.tsx` |
| Feature flags | new `lib/flags.ts` (reads `env.ts`) |
| Hardening | `next.config.ts` (headers), `app/robots.ts`, `app/sitemap.ts`, `app/layout.tsx` (analytics, error reporting) |
| Tests | unit next to code; end-to-end in new `apps/web/e2e/` (Playwright); accessibility checks with `vitest-axe` in component tests |

## 4. Phases

### Phase 0: decisions and frontend-only work (start now, no backend needed)

| # | Work | Story | Where | Done when |
| --- | --- | --- | --- | --- |
| 0.1 | **Decide scope of Records, Consult, Prescriptions.** Recommended: hide them in production behind `NEXT_PUBLIC_PHASE2_PREVIEW`, keep them for demos. | none (decision) | `lib/flags.ts`; gate `components/shell/navs.tsx`, the routes (`notFound()` when off), Home quick tiles and Profile links | With the flag off, no link or route reaches them and no clinical data screen exists |
| 0.2 | **Demo labelling.** Restore a visible "example data" label wherever demo stores feed a screen; make production builds refuse demo mode (fail the build if `NEXT_PUBLIC_DEMO_MODE=true` with a production domain). | none | `components/demo-banner.tsx`, `lib/env.ts`, notes in appointments, records, search, consult | Demo data can never look real; CI check exists |
| 0.3 | **Live status for patients** (against the real endpoints). | FE-16 | `components/status/*`, `/d/[slug]/live`, link from the doctor profile and from a booking | Shows doctor state, delay, now serving, tokens ahead and wait range; refreshes by polling; offline shows last value with its time |
| 0.4 | **Notification inbox** (against `GET /me/notifications`). | FE-17 | `app/(patient)/notifications`, bell with unread count, Home reminders read from it | Messages render as WhatsApp-style bubbles, paginated, empty and error states |
| 0.5 | **Legal pages.** Terms, Refund, Contact copy from RD-11; fill grievance officer and support contact in the privacy policy. Footer "Terms" points to `/terms`. | FE-31, RD-11 | `app/(home)/*`, `components/shell/app-footer.tsx` | No footer link goes to Help; lawyer-reviewed copy |
| 0.6 | **Hardening.** Security headers (CSP, frame, referrer, permissions), exclude `public/mockServiceWorker.js` from production builds, `robots.ts`, `sitemap.ts` (doctor URLs), analytics, error reporting (INT-18). | FE-32 (part), INT-18 | `next.config.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/providers.tsx` | Headers verified with a scan; sitemap lists doctors; errors reach the dashboard |
| 0.7 | **Accessibility pass.** Axe on every patient route, keyboard navigation for the records filter dropdown, remaining tap targets under 44px, contrast check on gradients, focus return after sheets and dialogs. | none | components named in the audit | No serious axe findings; every control reachable by keyboard |
| 0.8 | **Testing foundation.** Playwright for login, search, doctor page; axe in CI. | none | `apps/web/e2e/`, CI config (INT) | Golden path runs in CI on every push |
| 0.9 | **Housekeeping.** Remove commented-out blocks, fix the two rate-limit tests, clean `.env.example`, commit in small feature commits and open a PR. | none | repo | Clean history, passing CI |

### Phase 1: booking, appointments, cancel (needs BE-24 to BE-29)

| # | Work | Story | Where | Backend must provide |
| --- | --- | --- | --- | --- |
| 1.1 | Slot picker from real slots; remove client-side slot maths | FE-19 | `booking-flow.tsx`, `lib/api/appointments.ts` (`useSlots`) | `GET` slots by doctor, clinic and date (BE-25) |
| 1.2 | Booking form and checkout: patient name and phone (book for family), fee shown, demo pay button, Razorpay Checkout when live, 10-minute hold with countdown, conflict (409) handling with a "pick another slot" path | FE-20 | `booking-confirm.tsx`, `use-create-appointment` | `POST /appointments` with hold, payments (BE-26, BE-27) |
| 1.3 | Confirmed screen with the 4-digit visit code, calendar add, map link, live-status link | FE-21 | `booking-confirm.tsx` booked state | Visit code in the response |
| 1.4 | My appointments from the API; **cancel with refund rule shown first**, reschedule as cancel plus rebook (or a reschedule endpoint if backend adds it) | FE-22 | `appointments-page.tsx`, `components/ui/confirm-sheet.tsx` | `GET /appointments/mine`, `POST /appointments/:id/cancel` (BE-29) |
| 1.5 | Live position on today's booking card | FE-22 | `appointments-page.tsx` | `GET /appointments/:id/position` (done) |
| 1.6 | Remove demo stores from production paths | none | `lib/demo-bookings.ts` kept for preview only | none |

### Phase 2: reviews (needs BE-31 to BE-38)

| # | Work | Story | Where |
| --- | --- | --- | --- |
| 2.1 | "Rate your visit" entry on past appointments; eligibility list with countdown for locked ones | FE-24 | `components/reviews/eligibility-list.tsx`, appointments page |
| 2.2 | Review form: five ratings, recommend, visit reason, optional text, edit within the window | FE-24 | `components/reviews/review-form.tsx` |
| 2.3 | Reviews on the doctor profile: dimension bars, % recommend, verified visit count, list, "New on Doqto" | FE-25 | `components/doctor-page/profile-view.tsx`, `components/reviews/*` |
| 2.4 | Report a review (abuse) from the public list | FE-25 | `review-list.tsx` |

Doctor reply and admin moderation (FE-26, FE-27) are doctor and admin work, outside the patient scope here.

### Phase 3: retention and launch (needs BE-39, BE-41, BE-42)

| # | Work | Story | Where |
| --- | --- | --- | --- |
| 3.1 | Install prompt after the first booking (the app already has an install flow; change when it appears) | FE-28 | `components/pwa/install-prompt.tsx` |
| 3.2 | Offline appointment card (visit code and queue token available offline) | FE-29 | `public/sw.js`, appointment card cache |
| 3.3 | Web Push: subscribe, "your turn is near" | FE-30 | `components/pwa/push-subscribe.tsx`, `public/sw.js` |
| 3.4 | Transparency page | FE-31 | `app/(home)/transparency` |
| 3.5 | **Delete my account** and **download my data** in Profile settings | BE-42 (+ new data-export story) | `components/profile/profile-settings.tsx` |
| 3.6 | Low-end phone performance pass: Lighthouse budgets, bundle size, image sizes, font loading | FE-32 | across `apps/web` |
| 3.7 | Final accessibility and Hindi review by a native speaker; real-device tests (Android Chrome, iOS Safari) | none | all |

## 5. Sequence and parallel work

```
Week 1      Phase 0.1, 0.2, 0.9          decisions, labels, cleanup
Week 1-2    Phase 0.3, 0.4               live status, inbox (real endpoints exist)
Week 2      Phase 0.5-0.8                legal, hardening, a11y, tests
            Backend: contract v3 (BE-24), slots, appointments, payments, cancel
Week 3-4    Phase 1                      builds on mocks first, then switch to real
            Backend: reviews contract v4 and endpoints
Week 5-6    Phase 2                      reviews
Week 7      Phase 3                      push, offline, data rights, performance, launch checks
```

Backend and frontend run side by side: backend lands each contract one story ahead, the frontend builds against the mock of that contract.

## 6. Items the backlog does not cover (propose adding)

| Item | Suggested story | Notes |
| --- | --- | --- |
| Hide Records, Consult, Prescriptions in production | FE-33 | Section 4, item 0.1 |
| Demo-mode guard in builds | FE-34 | Item 0.2 |
| Patient data export (DPDP access right) | BE-43 + FE | Needs a backend endpoint |
| Search filters: fee, language, open now, sort; favourites | FE-35 + BE contract change | Add only if Phase 1 needs it; start with sort and "open now" |
| Cancel and reschedule rules copy (Hindi and English) | RD | Shown before confirming |
| End-to-end tests and axe in CI | FE-36 + INT | Item 0.8 |

## 7. Decisions needed from you

1. **Records, Consult, Prescriptions:** hide in production (recommended) or ship as labelled previews?
2. **Reschedule:** cancel and rebook (no new endpoint), or ask backend for a reschedule endpoint?
3. **Booking for family:** in Phase 1 (the contract already allows a different patient name and phone) or later?
4. **Payment at launch:** online payment only, pay at clinic, or both?
5. **Primary button colour:** keep dark green with white text, or the lighter `#87D554`?
6. **Grievance officer and support contact details** for the privacy policy and Contact page.

## 8. Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Contract changes late | Frontend rework | Contract first; mocks generated from it; shared types only |
| Demo data reaches production | Fake appointments shown as real | Items 0.1 and 0.2 |
| Double booking and payment edge cases | Lost trust | Hold countdown, 409 flow tests, idempotent confirm (backend) |
| Slow low-end phones | Poor retention | Performance budgets in Phase 3, test on a cheap Android |
| Legal copy not reviewed | Compliance risk | RD-11, lawyer sign-off before launch |

## 9. Review log

| Date | Author | Notes |
| --- | --- | --- |
| 2026-10-20 | Claude (agent) | First roadmap, mapped to existing BACKLOG story ids. |
