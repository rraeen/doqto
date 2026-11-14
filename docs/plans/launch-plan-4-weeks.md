# Launch plan: 4 weeks

**Date:** 2026-11-14. **Goal:** open Doqto to real users in one city in 4 weeks.
**Basis:** the completion audit (about 65% overall in demo mode).

## Launch scope

**In:** patient portal; doctor and clinic console with staff accounts; labs as booking requests (patient pays at the lab); the admin screens needed to run the platform.

**Out (after launch):** pharmacy (about 10% built, needs its own legal review); lab reports in live mode (waits for the ADR 0007 data-protection review); doctor payouts and earnings screens; lab test packages; wider city rollout.

## Rules for the month

1. Feature freeze on day 3 of week 4. Anything not listed here goes to the after-launch list.
2. Every step ships with tests and `tsc` clean. No placeholder screen is reachable by a real user at launch.
3. Anything that waits on an outside party starts in week 1.

---

## Week 1: blockers, clean-up, paperwork

| # | Step | Where | Done when |
|---|---|---|---|
| 1.1 | Start paperwork: Razorpay KYC, WhatsApp provider account and template submission (Hindi read first), SMS/DLT registration, domain, production MongoDB and file storage accounts | You (outside the code) | Each is submitted; dates noted |
| 1.2 | Fix the 5 known failing tests: API `auth.e2e` OTP rate-limit (2), web `auth.test.ts` and `login-flow.test.tsx` rate-limit (2), `whatsapp/templates.spec.ts` CRLF (1) | `apps/api`, `apps/web` | All suites green |
| 1.3 | Run CI (`.github/workflows/ci.yml`) on a branch and fix whatever fails | root | CI is green on push |
| 1.4 | Browser click-through of staff login, lab flow (patient and lab side) and report download; fix bugs found | `apps/web`, `apps/console` | A written checklist with every item passing |
| 1.5 | Redirect old `/clinic/*` and `/admin/*` routes in `apps/web` to the console | `apps/web/src/app/clinic`, `admin` | No duplicate screens reachable |
| 1.6 | Hide every "planned" screen and all pharmacy entry points (apply card, nav, services panel) from real users, behind one config flag | `apps/console` (`app-config.ts`, services panel, apply page) | No page shows "planned" |
| 1.7 | Decide the production domains and cookie/CORS setup (`infra/ENVIRONMENTS.md`) | `infra`, `.env.example` | Staging deploys on the chosen domains |

## Week 2: finish the screens people use

| # | Step | API work | Console/web work |
|---|---|---|---|
| 2.1 | Clinic dashboard: today's appointments, waiting, no-shows, next patient | A summary endpoint under `console/workspaces/:unitId` (reuse queue and day-sheet data) | Replace `PlannedScreen` on `/clinic` |
| 2.2 | Clinic reviews + reply | Review list and reply endpoints (the schema has `reply`, but no route exists yet); permission `reviews` | `/clinic/reviews` screen |
| 2.3 | Clinic settings (notification and language preferences only; owner only) | Small settings endpoint | `/clinic/settings` |
| 2.4 | Admin audit log viewer | New `GET platform/audit` over `auditLogs` (the collection is written, never read) | `/admin/audit` |
| 2.5 | Admin payments and refunds list | New read-only `GET platform/payments` | `/admin/payments` |
| 2.6 | Admin review moderation | Report queue, hide/restore with audit entry (reviews are reported already; no admin route) | `/admin/reviews` |
| 2.7 | Admin bookings overview and notifications monitor | Read-only list endpoints; the notifications one exists (`admin/notifications`) | `/admin/bookings`, `/admin/notifications` |
| 2.8 | Admin settings: reduce to read-only environment and mode info, or hide | None | `/admin/settings` |
| 2.9 | Lab profile and settings screens (owner only) | Lab listing edit goes through the existing profile-change review | `/lab/profile`, `/lab/settings` |
| 2.10 | Lab status alerts: in-app notifications now; WhatsApp when templates are approved | Notification outbox entries on accept, reject, sample collected, report ready | None |
| 2.11 | Doctors/Labs toggle on the search page | None | Search page |
| 2.12 | Hindi copy review for everything added | None | `en.ts`/`hi.ts` pass `messages.test.ts` |

## Week 3: real services, security, testing

| # | Step | Done when |
|---|---|---|
| 3.1 | Staging with `PROVIDER_MODE=live`: Razorpay test keys end to end (pay, webhook, refund, late payment after expiry) | One booking paid and refunded on staging |
| 3.2 | WhatsApp and SMS live on staging; STOP handling; template parameters match the submitted templates | Real message received on a test phone |
| 3.3 | Real file storage for photos and documents; signed URLs work; metadata stripping confirmed | Upload and view on staging |
| 3.4 | Web Push on a real Android phone and an iPhone (installed PWA) | Notification arrives |
| 3.5 | Admin hardening: authenticator code at sign-in, short admin sessions, optional IP allow-list; token audience check | Admin cannot sign in without the code |
| 3.6 | Staff password recovery that needs no phone or email (owner reset already exists; add owner-visible audit and lock-out message) | Documented and tested |
| 3.7 | Privacy, terms, consent and transparency pages reviewed against the launch scope; lab report flag stays off in live | Pages signed off by you |
| 3.8 | Browser end-to-end suite for the four main journeys: book and pay; clinic queue; lab request; admin approval | Suite runs in CI |
| 3.9 | Load test the booking and slots paths; indexes checked on production DB (migrations run) | No errors at the target load |
| 3.10 | Operations: database backups and a restore test, error monitoring, uptime alerts, a one-page runbook | Restore tested once |

## Week 4: pilot, fix, launch

| Days | Step |
|---|---|
| 1–3 | Pilot on staging with 2–3 real clinics and 1 lab. Load their real profiles, schedules and catalogue. Collect every problem in one list. Feature freeze at the end of day 3. |
| 3–5 | Fix pilot bugs in severity order. Re-run the end-to-end suite and CI. |
| 6 | Switch to live domain and live keys. Run a smoke test with a real payment and a real message. Approve and publish the first doctors and labs. Open to the first city. |
| 7 | Watch errors, payments and messages. Rollback plan ready (previous deploy, database backup taken before cut-over). |

## Risks

| Risk | Effect | Fallback |
|---|---|---|
| Razorpay, WhatsApp or SMS approval is late | Cannot go live on the date | Launch with in-app and SMS only; add WhatsApp later. If Razorpay is late, slip the date, since paid booking is the core. |
| Pilot finds many bugs | Week 4 fills up | Week 4 has no new features; cut lower-priority week 2 items (2.8, 2.7) first |
| Week 2 is heavy (12 steps) | Slip into week 3 | Do 2.1, 2.2, 2.4, 2.6 first (they matter most to running the platform), then the rest |
| Legal review not ready for lab reports | Reports unavailable | Flag stays off in live; labs still take bookings |

## After launch

Pharmacy module (own plan and legal sign-off), lab reports in live, test packages, doctor payouts and settlement, more cities, a command palette and saved views in the console.
