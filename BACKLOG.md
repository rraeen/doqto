# Doqto Phase 1 MVP: Development Backlog

Oct 10, 2026 · Source: `doqto-technical-design.md` (TDD) and `doqto-database-design.md` (DB doc), including TDD section 13 (demo mode).

Phase 1 is built clinic-console-first over about 12 weeks, as TDD section 12 lays out. The work is split into four workstreams, each run by one agent, and into seven sprints. Every story is small (half a day to two days for one agent), has one owner, lists what it depends on, and has acceptance criteria that a reviewer can check.

## 1. Workstreams and who owns what

| Code | Workstream | Owns (only this agent writes here) |
| --- | --- | --- |
| **FE** | Frontend: Next.js PWA (patient app, `/clinic` console, `/admin` panel) | `apps/web/**` |
| **BE** | Backend: NestJS + MongoDB, the API contract | `apps/api/**` except `apps/api/src/integrations/**`; `packages/shared/**` |
| **INT** | Integration: provider adapters (OTP, WhatsApp, SMS, payments, storage) with demo and live modes, webhooks plumbing, hosting, CI, backups | root config files (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, lint config, `.env.example`, `docker-compose.yml`), `apps/api/src/integrations/**`, `infra/**`, `.github/**`, `scripts/ops/**` |
| **RD** | Review + Docs: code review against the TDD, security checklist, ADRs, API and user docs, legal page copy | `docs/**` |

Rules that keep four agents from colliding in one shared folder:

- An agent writes only inside the folders it owns. To change something another workstream owns, it writes a note in its own status file (section 2) and the owner makes the change.
- `packages/shared` holds the **API contract** (Zod schemas and TypeScript types for every request and response). BE owns it; FE and INT import it and never redefine API types locally.
- Business code calls external services only through the provider interfaces in `apps/api/src/integrations` (TDD section 13). INT owns the interfaces and the `Demo*` and live implementations; BE consumes them through Nest dependency injection.
- `reviews` and ranking code never import `payments` (TDD 5.8). INT enforces this with an ESLint import-boundary rule; RD checks it in every review.

## 2. How a story moves

1. **Ready**: its dependencies are Done.
2. **In progress**: the owner works in its own folders and logs progress in `docs/status/<FE|BE|INT|RD>.md` (each agent owns its own status file; this backlog is edited only by the coordinator).
3. **In review**: the owner lists the story id, changed files and how to test it in its status file. RD reviews against the acceptance criteria, the TDD, and the checklist in RD-02, and writes findings to `docs/reviews/<story-id>.md`.
4. **Done**: RD marks it approved; every acceptance criterion holds; typecheck, lint and tests pass.

Definition of Done for every code story: TypeScript strict with no `any` in new code, unit tests for logic, no patient data (phone, OTP, visit code, tokens) in logs, DTOs validated with `whitelist` and `forbidNonWhitelisted`, and Swagger updated for any API change.

Code lives in `/mnt/project-files/doqto` as a pnpm monorepo (`apps/web`, `apps/api`, `packages/shared`) until a GitHub repository is attached; then INT moves it into the repo and CI starts running on pushes. `node_modules` and build output are never treated as source.

Everything runs in **demo mode** (`PROVIDER_MODE=demo`, fixed OTP `123456`, Demo inbox, mock payment) until the WhatsApp BSP, MSG91 DLT and Razorpay KYC paperwork is done. Live adapters are built behind the same interfaces and switched on by configuration only.

## 3. Sprint plan at a glance

| Sprint | Weeks | Theme (TDD step) | Outcome |
| --- | --- | --- | --- |
| 1 | 1 to 2 | Foundations (step 2) | Monorepo, API skeleton, contract v0, demo providers, phone OTP login end to end, CI |
| 2 | 2 to 3 | Doctor profiles and search (step 3) | Doctor onboarding, admin verify, clinics with map, public SEO doctor pages, search |
| 3 | 4 to 5 | Clinic console (step 4) | Schedules, day sheet, walk-ins and manual bookings, check-in with visit code, queue, status buttons |
| 4 | 6 | Live status for patients (step 5) | Public status and queue page with polling, notifications outbox, delay and leave alerts, Demo inbox |
| 5 | 7 to 8 | Online booking and payments (step 6) | Slots, holds, double-booking guard, payment (demo then Razorpay), confirmations, reminders, cancel and refund |
| 6 | 9 to 10 | Reviews (step 7) | Eligibility and cool-down, review form, fraud scoring, Bayesian summary, reply, admin queue, appeals |
| 7 | 11 to 12 | PWA polish and launch hardening (steps 8, 9) | Installable PWA, Web Push, offline card, backups, nightly jobs, transparency and legal pages, load test, demo-to-live switch |

Critical path: `INT-01 → BE-01 → BE-02 (contract) → BE-04 (auth) → FE-04 (login)` in sprint 1; then contract additions always land one story ahead of the FE screens that use them, so FE builds against MSW mocks generated from the contract while BE builds the real endpoint.

## 4. Stories

Size: **S** is about half a day, **M** is one to two days. "Deps" lists stories that must be Done first.

### Sprint 1: Foundations (weeks 1 to 2)

| ID | Story | Size | Deps |
| --- | --- | --- | --- |
| INT-01 | Root monorepo workspace and tooling (Done) | S | none |
| BE-01 | NestJS API skeleton (Done) | M | none (adopts INT-01 root config when it lands) |
| FE-01 | Next.js app skeleton (Done) | M | none (adopts INT-01 root config when it lands) |
| RD-01 | Project docs and working agreement (Done) | S | none |
| BE-02 | API contract v0 in `packages/shared` (Done) | M | INT-01 |
| INT-02 | Provider interfaces and demo implementations (Done) | M | INT-01 |
| RD-02 | Review checklist (Done) | S | none |
| FE-02 | Design system and app shell (Done) | M | FE-01 |
| BE-03 | Database layer: connection, migrations, users, otps, refreshTokens (Done) | M | BE-01 |
| INT-03 | Demo-mode startup safety checks | S | INT-02, BE-01 |
| RD-03 | Review API contract v0 | S | BE-02 |
| BE-04 | Phone OTP auth and `/me` | M | BE-02, BE-03, INT-02 |
| FE-03 | Mock API layer from the contract (Done) | S | BE-02, FE-01 |
| FE-04 | Login and profile screens | M | FE-02, FE-03 |
| INT-04 | CI pipeline (Done) | S | INT-01 |
| INT-05 | Local dev environment and staging/demo deploy config | M | BE-01, FE-01 |
| RD-04 | ADRs for locked decisions (Done) | S | RD-01 |

**INT-01 Root monorepo workspace and tooling.** As a developer I can install and run every app from one root.
- `pnpm-workspace.yaml` covers `apps/*` and `packages/*`; root `package.json` has `dev`, `build`, `typecheck`, `lint`, `test` scripts that run across workspaces.
- `tsconfig.base.json` (strict), shared ESLint and Prettier config, `.editorconfig`, `.gitignore` (node_modules, dist, .next, .env).
- ESLint import-boundary rule: anything under `apps/api/src/reviews/**` or `apps/api/src/ranking/**` importing `apps/api/src/payments/**` fails lint (TDD 5.8). A deliberate violating fixture proves it.
- `.env.example` lists every variable used in Phase 1 with a comment each.

**BE-01 NestJS API skeleton.** As a client I can reach a versioned, documented API.
- `apps/api` boots with global prefix `/api/v1`, Swagger at `/api/docs`, `GET /api/v1/health` returning `{ status, version, providerMode }`.
- Config module with validated env (fails fast on missing vars); Pino logger with redaction of `phone`, `otp`, `visitCode`, `token`, `authorization`.
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, Helmet, CORS from an env allowlist, `@nestjs/throttler` defaults.
- Module folders created empty for auth, users, doctors, clinics, schedules, appointments, queue, status, notifications, payments, reviews, admin, jobs.
- A Jest e2e test hits `/health`.

**FE-01 Next.js app skeleton.** As a user I can open the web app on a phone.
- `apps/web` on Next.js App Router with Tailwind, shadcn/ui, TanStack Query provider.
- Route groups: patient (`/`), `/clinic`, `/admin`, each with a placeholder page.
- API client reads `NEXT_PUBLIC_API_URL`; no business logic in Next.js server actions or route handlers (TDD 9.2).
- Persistent demo banner shown when `NEXT_PUBLIC_DEMO_MODE=true`: "Demo: no real messages or payments. Do not enter real patient details."

**RD-01 Project docs and working agreement.** As any agent or Raunak I know how the repo works.
- `README.md` (what Doqto is, how to run locally, demo mode), `docs/CONTRIBUTING.md` (folder ownership from section 1, story flow from section 2, Definition of Done).
- `docs/status/` with one file per workstream, each with a short template.

**BE-02 API contract v0.** As FE and BE we build against one agreed shape.
- `packages/shared` exports Zod schemas and inferred types for: auth (`otp/request`, `otp/verify`, `refresh`, `logout`), `/me`, error envelope, cursor pagination, and placeholder shapes for doctor list item, doctor profile, clinic, doctorStatus, appointment (from DB doc 3.1 to 3.6).
- Enums from the DB doc (roles, appointment status, doctor state, appointment source) exported once and reused.
- Money in paise as integers; dates as ISO strings; IST day as `YYYY-MM-DD` string.
- `CONTRACT.md` in the package lists endpoints with request, response and error codes for sprint 1 and 2.

**INT-02 Provider interfaces and demo implementations.** As BE I can send OTPs, messages and take payments without any real account.
- Interfaces in `apps/api/src/integrations`: `OtpProvider` (`send`, `verify`), `WhatsAppProvider` (`sendTemplate`, `parseWebhook`), `SmsProvider` (`send`), `PaymentProvider` (`createOrder`, `verifyPayment`, `verifyWebhook`, `refund`), `StorageProvider` (`putPrivate`, `putPublic`, `signedUrl`).
- `Demo*` implementations: OTP accepts fixed `123456` while still respecting attempt limits; messages are recorded as `sent` with no network call; payment creates `gateway: 'demo'` orders; storage writes to a local folder.
- One `IntegrationsModule` picks implementations from `PROVIDER_MODE=demo|live`; live stubs throw "not configured" until their stories land.
- Unit tests for each demo provider.

**RD-02 Review checklist.** As a reviewer I check every story the same way.
- `docs/review-checklist.md` covering: acceptance criteria met; DTO whitelist; role guard and clinic scoping on every non-public route; no PII in logs; hashes only for OTP, visit code, refresh token, device fingerprint; unique indexes present where the DB doc marks them; idempotency on webhooks and notifications; demo safety rules (TDD 13); no clinical data fields; reviews/ranking never import payments; no time estimates in user copy that promise precision (TDD 6.3).

**FE-02 Design system and app shell.** As clinic staff on a cheap Android phone I get large, clear controls.
- Tailwind tokens (colours, spacing, type scale) and base components: Button (large tap target variant), Input, PhoneInput (+91, E.164 output), OtpInput (6 boxes), Card, Badge, Sheet, Toast, EmptyState, Skeleton.
- Mobile-first layouts for patient, clinic and admin; bottom nav for patient and clinic.
- i18n scaffold with English and Hindi message files; a language switch persisted per user.
- First-load JS for the shell under 200 KB (measured with `next build` output).

**BE-03 Database layer.** As BE I have a Mongo connection with enforced indexes.
- Mongoose connection from `MONGODB_URI`; `autoIndex` off in production; a startup migration runner applies index scripts idempotently and records them in `migrations`.
- Schemas and indexes for `users`, `otps` (TTL on `expiresAt`), `refreshTokens` (unique `tokenHash`, TTL) exactly as DB doc 3.1 and 3.12; `isDemo` flag on users.
- Tests use `mongodb-memory-server` (replica set mode, for later transactions).

**INT-03 Demo-mode startup safety checks.** As Raunak I can never expose the fixed OTP on production data.
- API refuses to start when `PROVIDER_MODE=demo` and the database name does not start with `doqto_demo`, or when `NODE_ENV=production` with a production database name (TDD 13, rule 2).
- API refuses to start when `PROVIDER_MODE=live` and any `Demo*` provider is bound.
- No header, query flag or endpoint can toggle demo behaviour; a test proves a request header has no effect.

**RD-03 Review API contract v0.** Findings in `docs/reviews/BE-02.md`: every field and enum matches the DB doc, nothing clinical, money and time conventions followed, error codes defined. Owner fixes before FE-03 relies on it.

**BE-04 Phone OTP auth and `/me`.** As a patient, doctor or staff member I log in with my phone number.
- `POST /auth/otp/request`: E.164 validation, OTP hashed in `otps` with 5-minute expiry, sent through `OtpProvider`; 3 requests per 10 minutes per phone and per IP, else 429.
- `POST /auth/otp/verify`: max 5 attempts; creates the user with role `patient` on first login; returns a 15-minute access JWT and a 30-day refresh token (stored hashed); sets httpOnly cookies for web and returns tokens in the body for mobile.
- `POST /auth/refresh` rotates the token and revokes the old one (reuse of a revoked token revokes the family); `POST /auth/logout` revokes.
- `GET/PATCH /me` (name, language, whatsappOptIn); `JwtAuthGuard` and `@Roles()` guard available to all modules.
- e2e tests for the full flow in demo mode with `123456`, wrong-code lockout and rate limit.

**FE-03 Mock API layer.** As FE I can build screens before endpoints exist.
- MSW handlers generated or hand-written from `packages/shared` schemas, switchable with `NEXT_PUBLIC_API_MOCKS=true`.
- Typed API client functions per endpoint that parse responses with the shared Zod schemas.

**FE-04 Login and profile screens.** As a user I sign in with phone and OTP.
- Phone screen, OTP screen with resend timer, error states for wrong code, lockout and rate limit; a demo hint showing `123456` only when demo mode is on.
- Consent checkbox for WhatsApp messages (on by default with clear text) at first signup.
- Profile page to edit name, language and WhatsApp opt-in; logout.
- Works against mocks and against the real API from BE-04.

**INT-04 CI pipeline.** As the team every change is checked automatically.
- `.github/workflows/ci.yml` runs install (pnpm cache), typecheck, lint (including the import-boundary rule), unit and e2e tests with an in-memory Mongo.
- Until a GitHub repo is attached, `pnpm ci:local` runs the same steps locally and agents run it before marking a story In review.

**INT-05 Local dev and deploy config.** As Raunak I can run everything locally and later deploy the demo.
- `docker-compose.yml` runs MongoDB only (replica set); `pnpm dev` starts API and web with hot reload.
- `infra/render.yaml` for the API (staging/demo service) and Vercel project notes for web; env var matrix for local, demo (`doqto_demo` database) and production in `infra/ENVIRONMENTS.md`.
- Nothing is deployed until Raunak provides accounts; the config is ready to apply.

**RD-04 ADRs.** `docs/adr/` with short records for the locked decisions: modular monolith, MongoDB, REST `/api/v1` with Swagger as contract, polling not websockets, visit code for verified visits, demo mode via providers, no clinical data in Phase 1.

### Sprint 2: Doctor profiles and search (weeks 2 to 3)

| ID | Story | Size | Deps |
| --- | --- | --- | --- |
| BE-05 | Contract v1: doctors, clinics, onboarding, admin verify, search (Done) | S | BE-02 |
| BE-06 | Doctors and clinics schemas and indexes (Done) | M | BE-03 |
| BE-07 | Doctor onboarding and profile API (Done) | M | BE-05, BE-06, INT-06 |
| BE-08 | Clinics API and staff management (Done) | M | BE-06 |
| BE-09 | Admin doctor verification API with audit log | S | BE-07 |
| BE-10 | Public doctor search and profile API (Done) | M | BE-06 |
| BE-11 | Demo seed script (Done) | S | BE-06 |
| INT-06 | Storage provider: R2 live adapter and signed URLs (Done) | M | INT-02 |
| INT-07 | Maps: geocoding helper and static map links (Done) | S | INT-02 |
| FE-05 | Doctor onboarding flow | M | FE-04, BE-05 |
| FE-06 | Clinic setup with map location and staff | M | FE-04, BE-05 |
| FE-07 | Admin verification screen | S | FE-02, BE-05 |
| FE-08 | Public doctor profile page (SSR, SEO) | M | FE-02, BE-05 |
| FE-09 | Search page (city, specialty, near me) | M | FE-08 |
| RD-05 | Review sprint 2 stories | M | each story |
| RD-06 | Doctor onboarding guide (English and Hindi) | S | FE-05 |

**BE-05 Contract v1.** Shared schemas for doctor onboarding, doctor profile (public and private views), clinic create and update, staff add, admin verify decision, search query and result with cursor pagination. RD reviews before FE uses it.

**BE-06 Doctors and clinics schemas.** `doctors`, `clinics` per DB doc 3.2 and 3.3 with every listed index (unique `slug`, unique `userId`, `2dsphere`, text index); slug generator `dr-<name>-<city>` with collision suffix; `isListed` true only when verified and profile complete.

**BE-07 Doctor onboarding and profile API.** `POST /doctor/onboarding` creates a draft profile and uploads the registration document to a private bucket through `StorageProvider`; `PATCH /doctor/profile` accepts only editable fields and rejects `ratingSummary`, `verification` and `isListed`; adding role `doctor` to the user. e2e test that a doctor cannot edit another doctor.

**BE-08 Clinics API and staff.** `POST /clinics`, `PATCH /clinics/:id` (address, GeoJSON location, photos); `POST /clinics/:id/staff` adds a phone as `clinic_staff` and to `staffUserIds`; `doctors.clinicIds` and `clinics.doctorIds` kept in sync; a `ClinicScopeGuard` lets staff touch only their clinics, with an e2e test per role.

**BE-09 Admin verification.** `GET /admin/doctors?status=pending` queue; `POST /admin/doctors/:id/verify` approve or reject with notes; signed 5-minute URL to view the registration scan; every decision written to `auditLogs`; admin-only guard.

**BE-10 Public search and profile.** `GET /doctors?city=&specialty=&near=&cursor=` returns listed doctors only; ranking is one pure function whose input type has distance, specialty match, availability, score and review count, and no payment field (TDD 5.8); `GET /doctors/:slug` returns profile, clinics, rating summary placeholder and today's status. Unit tests for the ranking function.

**BE-11 Demo seed script.** `scripts/seed-demo.ts` creates 3 clinics, 5 doctors (verified, listed), schedules, staff users and an admin, all `isDemo: true`, only against a `doqto_demo*` database.

**INT-06 Storage provider.** Live R2 adapter (S3 API) for public photos and private credential scans; signed URLs that expire in 5 minutes; image size and type limits; demo adapter keeps working with local files.

**INT-07 Maps.** Clinic location picker support: a free geocoding option (or manual pin) and a "Open in Google Maps" link builder used by profile pages and WhatsApp templates. No paid map API in Phase 1.

**FE-05 Doctor onboarding flow.** Multi-step form: personal details, qualifications, specialties (controlled list), registration number and document upload, fees; saves drafts; shows verification status (pending, verified, rejected with notes).

**FE-06 Clinic setup.** Create and edit a clinic with address and a map pin, photos, and a staff list where the doctor adds staff by phone.

**FE-07 Admin verification screen.** `/admin/doctors` queue with document preview through the signed URL, approve and reject with notes.

**FE-08 Public doctor profile.** `/d/<slug>` server-rendered with title and meta tags for "specialty in city" searches, JSON-LD for Physician; shows qualifications, clinics with map link, fees, "New on Doqto" until reviews exist; under 200 KB first-load JS; `next/image` for photos.

**FE-09 Search page.** City and specialty filters, "near me" using browser location with permission prompt fallback to city, result cards with distance and next availability placeholder; infinite scroll with cursor.

**RD-05 Review sprint 2.** Each story reviewed against RD-02; special attention to the private bucket, the profile field allowlist, clinic scoping and the ranking input type.

**RD-06 Doctor onboarding guide.** One-page guide, English and Hindi, for Raunak to send pilot doctors over WhatsApp, with screenshots from the demo.

### Sprint 3: Clinic console (weeks 4 to 5)

| ID | Story | Size | Deps |
| --- | --- | --- | --- |
| BE-12 | Contract v2: schedules, day sheet, manual bookings, check-in, queue, status | S | BE-05 |
| BE-13 | Schedules, appointments, doctorStatus, statusEvents schemas and indexes | M | BE-06 |
| BE-14 | Weekly schedule and exceptions API | S | BE-13 |
| BE-15 | Day sheet and manual or walk-in entries | M | BE-13 |
| BE-16 | Check-in with visit code or walk-in OTP, queue token | M | BE-15, INT-02 |
| BE-17 | Queue: next, no-show, reorder, effective time | M | BE-16 |
| BE-18 | Doctor status update and wait estimate | M | BE-13 |
| BE-19 | Jobs framework (Mongo-backed claims, cron) | S | BE-03 |
| BE-20 | End-of-day job: close day, mark no-shows | S | BE-19, BE-17 |
| INT-08 | Walk-in OTP over WhatsApp provider (demo, live stub) (Done) | S | INT-02 |
| FE-10 | Clinic console home: today at a glance | M | FE-02, BE-12 |
| FE-11 | Schedule editor | M | BE-12 |
| FE-12 | Day sheet with add walk-in and manual booking | M | FE-10 |
| FE-13 | Check-in flow with code entry | M | FE-12 |
| FE-14 | Queue screen: now serving, next, no-show, reorder | M | FE-13 |
| FE-15 | Status buttons (in clinic, late, break, done, leave) | S | FE-10 |
| RD-07 | Review sprint 3 stories, with concurrency tests | M | each story |
| RD-08 | Clinic staff quick guide (English and Hindi) | S | FE-14 |

**BE-12 Contract v2.** Shared schemas for schedule template and exceptions, day sheet items, `POST /clinic/appointments`, check-in request (visit code or walk-in phone and OTP), queue actions, status update, and the position response.

**BE-13 Core clinic schemas.** `schedules`, `appointments`, `doctorStatus`, `statusEvents` per DB doc 3.4 to 3.7, including the **unique partial index** on `{ doctorId, slotStart }` for active statuses and the unique `{ doctorId, date }` on `doctorStatus`. Release-blocking indexes covered by a test that inserts a duplicate and expects error 11000.

**BE-14 Schedule API.** `PUT /doctor/schedules/:clinicId` for weekly blocks (`slotMinutes`, `capacityPerSlot = 1`), exceptions (leave, custom), `bookingWindowDays`, `walkInShare`; doctor and that clinic's staff only.

**BE-15 Day sheet and manual entries.** `GET /clinic/appointments?date=` sorted for the front desk; `POST /clinic/appointments` with source `walk_in`, `whatsapp_manual` or `phone_manual`, no fee; patient user created or matched by phone.

**BE-16 Check-in.** `POST /clinic/queue/check-in` accepts a booked appointment plus 4-digit visit code (hashed compare, 5 wrong attempts lock 15 minutes), or a walk-in phone plus OTP sent through the provider; on success sets `visitVerifiedAt`, assigns a token with atomic `$inc` on `doctorStatus.tokenCounter`, and sets `effectiveTime` per TDD 6.2. A test with parallel check-ins shows no duplicate tokens. Demo mode accepts `123456`.

**BE-17 Queue actions.** `POST /clinic/queue/next` completes the current consult (records duration, updates EWMA `avgConsultMinutes` with weight 0.2, ignoring under 1 and over 45 minutes) and calls the next by effective time; `no-show`; staff reorder logged in `statusHistory`; `doctorStatus.currentToken` and `queueLength` kept in sync.

**BE-18 Status update and wait estimate.** `PUT /clinic/status` with state, `delayMinutes`, message (80 chars), appends `statusEvents`; `GET /doctors/:id/status` public; `GET /appointments/:id/position` returns tokens ahead and a wait range (about 20% either side, TDD 6.3). Alert rules come in sprint 4.

**BE-19 Jobs framework.** `@nestjs/schedule` crons plus a `jobs` collection claimed with `findOneAndUpdate` locks (DB doc section 5); a test shows two workers never run the same job.

**BE-20 End-of-day job.** At clinic day end (IST), unchecked confirmed bookings become `no_show`, checked-in visits get `reviewUnlockAt` set per TDD 5.2, the day's status closes.

**INT-08 Walk-in OTP.** Uses `OtpProvider` with purpose `visit`; demo writes the message to the outbox only; live WhatsApp adapter remains a stub until the BSP is approved.

**FE-10 Console home.** `/clinic` shows the selected doctor and clinic, current status, now-serving token, queue length, next patients; polls every 15 seconds; works one-handed on a 360 px wide screen.

**FE-11 Schedule editor.** Weekly blocks per day with slot length, leave days and custom exceptions, walk-in share slider with plain-language explanation.

**FE-12 Day sheet.** Today's list with status chips; "Add walk-in" and "Add booking from WhatsApp/phone" forms using PhoneInput; date switcher.

**FE-13 Check-in flow.** Tap a booked patient, type the 4-digit code; walk-in path sends OTP and takes the code; shows assigned token large; clear errors for wrong code and lockout.

**FE-14 Queue screen.** Big "Next patient" button, now serving, upcoming tokens, no-show and move actions with confirmation, undo toast for mistaps where the API allows it.

**FE-15 Status buttons.** In clinic, Running late (+15, +30, +60, custom), On break, Done for today, On leave, with an optional 80-character message; confirmation for leave and done-early.

**RD-07 Review sprint 3.** Focus on the unique partial index, atomic tokens, visit-code hashing and lockout, clinic scoping on every `/clinic/*` route, and that staff alone cannot set `visitVerifiedAt` without a code or OTP.

**RD-08 Clinic staff quick guide.** One page, English and Hindi, for the front desk: check in, walk-in, next patient, running late.

### Sprint 4: Live status for patients (week 6)

| ID | Story | Size | Deps |
| --- | --- | --- | --- |
| BE-21 | Notifications outbox module and sender job | M | BE-19, INT-02 |
| BE-22 | Status alert rules (late, delay grows, leave, 3 tokens away) | M | BE-21, BE-18 |
| BE-23 | Public status endpoint caching headers | S | BE-18 |
| INT-09 | WhatsApp templates file (Hindi and English) and BSP submission pack | S | INT-02 |
| INT-10 | WhatsApp webhook plumbing (signature check, delivery receipts, STATUS and CANCEL keywords) | M | BE-21 |
| INT-11 | Cloudflare cache rules for the status endpoint | S | BE-23 |
| FE-16 | Public live status and queue page | M | BE-12 |
| FE-17 | Demo inbox screen | S | BE-21 |
| FE-18 | Admin failed-notifications view | S | BE-21 |
| RD-09 | Review sprint 4 and template copy check | S | each story |

**BE-21 Outbox.** `notify(userId, templateKey, params, dedupeKey)` writes to `notifications` (unique `dedupeKey`) and returns; a 10-second job sends through `WhatsAppProvider` with 3 retries and backoff, OTPs fall back to SMS; `whatsappOptIn: false` routes non-OTP messages to SMS or push; cap of 4 WhatsApp alerts per patient per day.

**BE-22 Alert rules.** On status change: late by 20+ minutes alerts confirmed, not-checked-in patients; delay growing by 15+ minutes alerts again; leave or done early auto-cancels remaining bookings (refund hook stubbed until sprint 5); 3 tokens away alerts that patient. Dedupe keys per TDD 6.4; tapping twice sends once (test).

**BE-23 Status caching.** `GET /doctors/:id/status` returns `Cache-Control: public, s-maxage=15` and carries no personal data.

**INT-09 Templates.** `templates.ts` with every Phase 1 template from TDD section 7 in Hindi and English, parameter lists, and a submission document Raunak can paste into the BSP portal.

**INT-10 WhatsApp webhook.** `/webhooks/whatsapp` verifies the BSP signature before reading the body, logs to `webhookLogs` (unique `{ source, eventId }`, TTL 30 days), updates delivery status by `providerMessageId`, replies to STATUS with today's doctor status and starts CANCEL confirmation; demo mode exposes a test-only simulator in the demo deployment.

**INT-11 Cloudflare cache.** Rules and a short runbook so one origin request per 15 seconds serves many patients; verified with response headers.

**FE-16 Live status page.** `/d/<slug>/live` and the appointment view show doctor state, delay, ETA, now serving, tokens ahead and the wait range; TanStack Query polling every 30 seconds, paused when hidden, refetch on focus.

**FE-17 Demo inbox.** Read-only list of the user's notification rows rendered like WhatsApp messages, labelled "the message the patient would get"; visible only in demo mode.

**FE-18 Failed notifications.** `/admin/notifications?status=failed` table with retry info.

**RD-09 Review sprint 4.** Dedupe and the daily cap, webhook signature check before parsing, no PII on the public status endpoint, template wording (no marketing, clear opt-out).

### Sprint 5: Online booking and payments (weeks 7 to 8)

| ID | Story | Size | Deps |
| --- | --- | --- | --- |
| BE-24 | Contract v3: slots, appointments, payments, cancel | S | BE-12 |
| BE-25 | Slot computation | M | BE-14 |
| BE-26 | Create appointment with 10-minute hold and 409 on conflict | M | BE-25 |
| BE-27 | Payments module: order, verify, confirm in a transaction, visit code | M | BE-26, INT-12 |
| BE-28 | Hold expiry job and late-payment handling | S | BE-27, BE-19 |
| BE-29 | Cancellation and refund rules | M | BE-27 |
| BE-30 | Reminder jobs (evening before, 2 hours before) | S | BE-21 |
| INT-12 | Demo payment provider flow end to end (Done) | S | INT-02 |
| INT-13 | Razorpay live adapter: orders, signature checks, refunds (Done, unverified against real Razorpay API until test keys exist) | M | INT-12 |
| INT-14 | Razorpay webhook (idempotent) and nightly reconciliation | M | INT-13, BE-27 |
| FE-19 | Slot picker on the doctor profile | M | BE-24 |
| FE-20 | Booking form and checkout (demo pay button, Razorpay Checkout) | M | FE-19 |
| FE-21 | Booking confirmed screen with visit code | S | FE-20 |
| FE-22 | My appointments and cancel | M | BE-24 |
| FE-23 | Admin manual refund | S | BE-29 |
| RD-10 | Review sprint 5 with payment security focus | M | each story |
| RD-11 | Terms, Privacy, Refund and Contact page copy | S | none |

**BE-24 Contract v3.** Schemas for slots by date, appointment create response (appointment plus order), payment verify, cancel with reason, my appointments.

**BE-25 Slot computation.** `GET /doctors/:id/slots?date=` expands the weekly template for the IST date, removes leave and exceptions, booked and held slots, holds back `walkInShare`, respects `bookingWindowDays`. Table-driven unit tests including DST-free IST edge cases and midnight boundaries.

**BE-26 Create appointment.** `POST /appointments` inserts `pending_payment` with `holdExpiresAt` 10 minutes ahead; duplicate key 11000 becomes `409 Slot taken`; a test fires two simultaneous requests and exactly one wins.

**BE-27 Payments and confirmation.** Creates the order through `PaymentProvider` and a `payments` row; `POST /payments/verify` checks the client signature; confirmation (payment `paid`, appointment `confirmed`, visit code generated and hashed, confirmation message queued) happens in one transaction triggered only by the webhook or the demo pay action.

**BE-28 Hold expiry and late payment.** A job each minute expires stale holds; a payment arriving after expiry confirms if the slot is still free, otherwise refunds and queues an apology with next free slots.

**BE-29 Cancellation and refunds.** Patient and staff cancel; refund rules exactly per TDD section 8 table; clinic-side cancels and leave refund in full automatically; `/admin/payments/:id/refund` for disputes; all in audit log.

**BE-30 Reminders.** Evening-before and 2-hours-before jobs queue reminders with the live-status link, deduped.

**INT-12 Demo payment.** Demo provider marks the payment paid when the "Pay ₹15 (demo)" action is called and drives the same confirm path as the webhook.

**INT-13 Razorpay adapter.** Orders API, HMAC-SHA256 checkout signature check with the key secret, refunds API; test-mode keys from env; never logs secrets.

**INT-14 Razorpay webhook.** `/webhooks/razorpay` verifies the webhook signature on the raw body, handles `payment.captured`, `payment.failed`, `refund.processed`, idempotent on event id and `gatewayPaymentId`; nightly job fetches the last 48 hours of orders and fixes missed rows.

**FE-19 Slot picker.** Date tabs for the booking window, slot grid, clear empty and "fully booked" states.

**FE-20 Booking and checkout.** Patient name and phone (booking for someone else allowed), fee shown, demo pay button in demo mode or Razorpay Checkout with UPI first in live mode; handles 409 by refreshing slots.

**FE-21 Confirmed screen.** Date, time, clinic map link, the 4-digit visit code large, live-status link; visit code stored locally for the offline card later.

**FE-22 My appointments.** Upcoming and past, live position on today's booking, cancel with refund rule explained before confirming.

**FE-23 Admin refund.** Payment lookup and manual refund with reason.

**RD-10 Review sprint 5.** Webhook is the only path to `confirmed`, signature checks before parsing, idempotency, transaction boundaries match DB doc section 5, refund rules match the table, no secrets or card data logged.

**RD-11 Legal page copy.** Drafts of Terms, Privacy (including data stored in India and API processing location), Refund and Contact pages for FE to render; marked "draft, needs lawyer review". Needed early for Razorpay KYC.

### Sprint 6: Reviews (weeks 9 to 10)

| ID | Story | Size | Deps |
| --- | --- | --- | --- |
| BE-31 | Contract v4: eligibility, review, reply, appeal, report, admin queue | S | BE-24 |
| BE-32 | Reviews and reviewClusters schemas and indexes | S | BE-13 |
| BE-33 | Eligibility and cool-down | S | BE-32, BE-20 |
| BE-34 | Submit and edit review with on-submit fraud scoring | M | BE-33 |
| BE-35 | Rating summary job (Bayesian, recency, latest per patient) | M | BE-34 |
| BE-36 | Doctor reply with content guard | S | BE-34 |
| BE-37 | Appeals, public reports and admin decisions | M | BE-34 |
| BE-38 | Review nudge jobs (unlock and day 5) | S | BE-33, BE-21 |
| INT-15 | Device fingerprint and IP /24 capture | S | BE-04 |
| FE-24 | Review eligibility list and review form | M | BE-31 |
| FE-25 | Reviews and dimension bars on the doctor profile | M | BE-31 |
| FE-26 | Doctor reply and appeal screens | S | BE-31 |
| FE-27 | Admin moderation queue | M | BE-31 |
| RD-12 | Review sprint 6 with trust-rules audit | M | each story |

**BE-31 Contract v4.** Schemas for eligibility, review create and edit, public review list, reply, appeal (fixed reason codes), report, admin queue item and decision.

**BE-32 Review schemas.** `reviews` and `reviewClusters` per DB doc 3.8 and 3.9, unique `appointmentId`, all listed indexes.

**BE-33 Eligibility.** `GET /reviews/eligibility` lists appointments that are verified, past `reviewUnlockAt` and within 30 days, plus when the rest unlock; creating a review before unlock is rejected.

**BE-34 Submit and score.** `POST /reviews` validates five 1 to 5 ratings, recommend, visit reason from a non-clinical list, optional text 20 to 1000 chars; runs every rule-based signal from TDD 5.5; bands under 40 publish, 40 to 69 publish with `countsInSummary: false`, 70+ held; earlier reviews by the same patient for the same doctor marked superseded; edit limits per TDD 5.2.

**BE-35 Rating summary job.** Recomputes `ratingSummary` from published, counted, non-superseded reviews with the Bayesian formula (C = 10, city mean, 12-month recency half-life); fewer than 5 counted shows "New on Doqto"; never written by any doctor-callable API (test).

**BE-36 Reply.** One reply per review, 1000 chars, editable 48 hours; blocks phone numbers, the patient's name and diagnosis or treatment keywords with a clear error; never changes visibility or weight; queues a WhatsApp alert to the patient.

**BE-37 Appeals and moderation.** Doctor and patient appeals with fixed reasons, one per party per review; personal-details and abuse appeals hide immediately, others stay visible; public `report`; `GET /admin/reviews/queue` and `POST /admin/reviews/:id/decision` with reason codes, both parties see the note, every action in `auditLogs`.

**BE-38 Nudges.** WhatsApp nudge at unlock and on day 5, never again, deduped.

**INT-15 Fingerprint capture.** Hash of install id (from the PWA), user agent family and IP /24, stored as hashes only; last 5 per user; feeds fraud signals.

**FE-24 Review form.** Eligible visits list with countdown for locked ones; form with five dimension ratings, recommend, visit reason, optional text and wait time; shows "being checked" when held.

**FE-25 Profile reviews.** Five dimension bars, "% would recommend", verified visit count, most recent first, "earlier visit" labels, "New on Doqto" under 5 reviews; never a single star number; reviewer shown as first name and last initial.

**FE-26 Reply and appeal.** Doctor reply form with the disclosure warning; appeal form with the fixed reasons; patient appeal for held or removed reviews.

**FE-27 Admin moderation.** Queue of held, flagged, appealed and clustered items, signals shown, decision with reason code and note.

**RD-12 Review sprint 6.** Audit the trust rules: no code path from payments into reviews or ranking (lint plus manual check), unique one-review-per-visit index, no doctor-writable path to `ratingSummary` or review visibility, no clinical text fields, reviewer identity minimised.

### Sprint 7: PWA polish and launch hardening (weeks 11 to 12)

| ID | Story | Size | Deps |
| --- | --- | --- | --- |
| FE-28 | Web manifest and install prompt after first booking | S | FE-21 |
| FE-29 | Service worker with Serwist and offline appointment card | M | FE-28 |
| FE-30 | Web Push subscribe and "your turn is near" | M | FE-29, BE-39 |
| FE-31 | Transparency page and legal pages | S | BE-41, RD-11 |
| FE-32 | Low-end phone performance pass | M | most FE |
| BE-39 | Push subscriptions endpoint and webpush channel | S | BE-21 |
| BE-40 | Nightly fraud cluster job | M | BE-34 |
| BE-41 | Transparency stats endpoint | S | BE-37 |
| BE-42 | Account deletion (DPDP erasure) | S | BE-04 |
| INT-16 | Web Push VAPID provider | S | INT-02 |
| INT-17 | Nightly `mongodump` to R2 with tested restore | M | INT-06 |
| INT-18 | Sentry and uptime alerts | S | INT-05 |
| INT-19 | Load test on the status endpoint | S | INT-11 |
| INT-20 | Live WhatsApp BSP and MSG91 adapters | M | INT-09, paperwork done |
| INT-21 | Demo-to-live switch: production deploy, demo wipe script | S | INT-03, INT-20, INT-13 |
| INT-22 | Optional Play Store TWA with Bubblewrap | S | FE-29 |
| RD-13 | Launch readiness review and runbook | M | all |

**FE-28 Install prompt.** Manifest with Hindi and English names, maskable icons, standalone display; prompt shown after the first successful booking only.

**FE-29 Service worker.** Precached shell, stale-while-revalidate for doctor pages, network-first API with no caching of personal data, offline page showing the next appointment and visit code from local storage.

**FE-30 Web Push.** Subscribe after install or booking, store subscription, receive "3 tokens away"; WhatsApp remains the fallback.

**FE-31 Transparency and legal pages.** Monthly transparency numbers page; Terms, Privacy, Refund and Contact pages from RD-11 copy.

**FE-32 Performance pass.** Under 200 KB first-load JS on doctor and booking pages, Devanagari font subset, tested on a throttled 3G profile and a low-end Android device profile, results recorded in `docs/perf.md` by RD.

**BE-39 Push subscriptions.** `POST /me/push-subscriptions`, max 5 per user, webpush channel in the outbox preferring push over WhatsApp for "your turn is near".

**BE-40 Cluster job.** Nightly union-find over shared fingerprint, IP /24 within 24 hours and similar text; clusters of 3+ held as one admin item; confirmed abuse shows "Unusual review activity was removed" for 90 days.

**BE-41 Transparency stats.** Monthly counts of reviews submitted, published, held, removed by reason, and appeals filed and upheld by party.

**BE-42 Account deletion.** Deletes user PII and refresh tokens, nulls patient name and phone on appointments, anonymises reviews as "Verified patient", keeps payment amounts (DB doc section 6).

**INT-16 Web Push provider.** VAPID keys from env, send through `web-push`, prune expired subscriptions.

**INT-17 Backups.** Nightly dump to a private R2 bucket with 14-day retention; a documented restore into a scratch database performed once and recorded.

**INT-18 Monitoring.** Sentry in API and web with PII scrubbing on the same fields as the log redaction; UptimeRobot or Better Stack checks on `/health` and the status endpoint.

**INT-19 Load test.** k6 or autocannon script showing the cached status endpoint holds the target viewer count with about one origin request per 15 seconds.

**INT-20 Live messaging adapters.** WhatsApp BSP adapter (AiSensy or Interakt, whichever approves first) and MSG91 SMS fallback behind the existing interfaces; switched on only by `PROVIDER_MODE=live`.

**INT-21 Demo-to-live switch.** Production deployment with live providers and the production database; demo deployment stays isolated on `doqto_demo`; script to wipe `isDemo` data before go-live; the TDD 13 checklist completed.

**INT-22 Play Store TWA.** Optional; cut first if time is short (TDD 12).

**RD-13 Launch readiness.** Final pass over every never-cut item (unique indexes, webhook signature checks, visit-code check, backups), the demo safety rules, privacy basics, and a one-page operations runbook (deploys, restore, rotating secrets, handling a failed webhook).

## 5. Sprint 1 kickoff: what each agent starts on now

Each agent starts with the stories that have no unmet dependencies, then picks up the next in its list as dependencies land.

| Agent | Start now | Then |
| --- | --- | --- |
| **FE** | FE-01 Next.js app skeleton | FE-02 design system and shell, FE-03 mock API layer (after BE-02), FE-04 login and profile |
| **BE** | BE-01 NestJS API skeleton | BE-02 API contract v0 (after INT-01), BE-03 database layer, BE-04 OTP auth and `/me` |
| **INT** | INT-01 root workspace and tooling (first, it unblocks BE-02) | INT-02 provider interfaces and demo implementations, INT-03 demo safety checks, INT-04 CI, INT-05 local dev and deploy config |
| **RD** | RD-01 project docs and working agreement, RD-02 review checklist | RD-03 review contract v0, RD-04 ADRs, then review each sprint 1 story as it enters review |

Sprint 1 is done when a person can run `pnpm dev`, open the web app on a phone-sized screen with the demo banner, log in with any phone number and `123456`, edit their profile, and `pnpm ci:local` passes.

## 6. Things only Raunak can do (start on day 1, in parallel)

- Attach a GitHub repository to the project so CI and pull-request review can start (until then code lives in `/mnt/project-files/doqto`).
- Start the slow paperwork: WhatsApp BSP account and templates (INT-09 prepares the pack), Razorpay KYC, MSG91 DLT registration, domains.
- Create free accounts when needed: MongoDB Atlas (Mumbai), Render, Vercel, Cloudflare (needed for INT-05 deploys; local development does not need them).
- Answer the open TDD questions when convenient: which BSP, Hindi-only console labels or bilingual, booking fee per city.
