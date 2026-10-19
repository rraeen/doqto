# Review checklist

RD runs every story through this list. Owners can run it on themselves before moving a story to In review. A "never" item that fails is always a **Blocker** (CONTRIBUTING section 3). Items that do not apply to a story are marked n/a in the review note, not skipped silently.

Review note template: `docs/reviews/_template.md`.

## A. Scope and acceptance

- [ ] Every acceptance criterion in BACKLOG.md for this story holds, checked one by one, with evidence (file:line, test name or command output).
- [ ] Nothing outside the story's scope was built without a note (no silent extra endpoints, fields or screens).
- [ ] Files changed are all inside the owner's folders (CONTRIBUTING section 1).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` pass (or `pnpm ci:local` once INT-04 lands). RD runs them, not only reads the claim.
- [ ] TypeScript strict; no new `any`, no `@ts-ignore` / `eslint-disable` without a one-line reason.

## B. API and contract (BE, and FE/INT consumers)

- [ ] Request and response shapes come from `packages/shared`; FE and INT do not redefine API types.
- [ ] Field names and enums match the DB doc (`docs/reviews/design-doc-differences.md` for known conflicts).
- [ ] Money is integer paise; times are ISO strings; clinic day is IST `YYYY-MM-DD`; phones are E.164; ids are 24-hex strings.
- [ ] Errors use the shared envelope with a defined `code`; status codes are right (400 validation, 401, 403, 404, 409 conflict, 429 rate limit).
- [ ] Lists use cursor pagination with a capped `limit`.
- [ ] Every new route is under `/api/v1`, appears in Swagger, and is listed in `packages/shared/CONTRACT.md`.
- [ ] Contract changes land in `packages/shared` before or with the endpoint, never after.

## C. Validation and injection

- [ ] Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` is not bypassed; every body, query and param has a DTO.
- [ ] No user input is passed to Mongo as a raw object (no `find(req.body)`, no `$where`, no string-built regex without escaping).
- [ ] Update endpoints use an explicit allowlist of editable fields (e.g. `PATCH /doctor/profile` rejects `ratingSummary`, `verification`, `isListed`).
- [ ] Text inputs have max lengths (status message 80, review text 20 to 1000, reply 1000).

## D. Access control

- [ ] Every non-public route has `JwtAuthGuard` and a `@Roles()` guard. Public routes are explicitly marked public and return no personal data.
- [ ] Clinic scoping: staff and doctors touch only clinics in `clinics.staffUserIds` / their own `clinicIds`; doctors edit only their own profile.
- [ ] Object-level checks: a patient reads and cancels only their own appointments, payments and reviews (no id-guessing).
- [ ] Admin routes are admin-only and every admin action writes `auditLogs`.
- [ ] e2e test per role for each sensitive endpoint (allowed role passes, other roles get 403, other clinic gets 403/404).

## E. Secrets, hashing and personal data

- [ ] OTPs, visit codes, refresh tokens and device fingerprints are stored **only** as hashes; compared in constant time.
- [ ] No patient data in logs, errors or Sentry: `phone`, `patientPhone`, `otp`, `code`, `visitCode`, `codeHash`, `token`, `accessToken`, `refreshToken`, `authorization`, `cookie`, `signature`. Check the Pino redaction list covers new field names.
- [ ] No secrets in code, fixtures, `.env.example` values or docs; only env var names.
- [ ] Responses never leak another user's phone; public reviewer identity is first name and last initial only.
- [ ] Credential scans live in the private bucket and are served only through 5-minute signed URLs to admins.

## F. Data integrity (indexes and concurrency)

- [ ] Every index the DB doc marks for touched collections exists, with the right `unique` / `partial` / `sparse` / TTL options, created by the startup migration (not `autoIndex` in production).
- [ ] Release-blocking unique indexes have a test that inserts a duplicate and expects error 11000: `users.phone`, `doctors.slug`, `doctors.userId`, `refreshTokens.tokenHash`, `appointments {doctorId, slotStart}` partial, `doctorStatus {doctorId, date}`, `reviews.appointmentId`, `payments.gatewayOrderId`, `payments.gatewayPaymentId`, `notifications.dedupeKey`, `webhookLogs {source, eventId}`.
- [ ] Duplicate-key errors map to the right API error (e.g. 11000 on slot becomes `409 Slot taken`).
- [ ] Counters use atomic `$inc` / `findOneAndUpdate`; there is a parallel-request test where the story requires one.
- [ ] Multi-document transactions are used only where DB doc section 5 says (payment confirm, cancel + refund, review publish), and are used there.

## G. Webhooks, notifications and jobs

- [ ] Webhook signature verified on the **raw body before parsing or reading** any field; unsigned or bad signature returns 400/401 and changes nothing.
- [ ] Webhooks are idempotent on the provider event id / payment id; a replayed event is a no-op (test).
- [ ] Only the Razorpay webhook or the demo pay action moves an appointment to `confirmed`; `/payments/verify` does not.
- [ ] Every outbound message goes through `notify()` and the outbox with a deterministic `dedupeKey`; business code never calls a provider directly.
- [ ] The 4-per-day WhatsApp cap and `whatsappOptIn: false` routing hold.
- [ ] Jobs claim work with a lock (`findOneAndUpdate`), are safe to run twice, and are safe if a run crashes halfway.

## H. Demo mode safety (TDD 13)

- [ ] Demo vs live is chosen only by `PROVIDER_MODE` at startup. No header, query, cookie or endpoint changes provider behaviour (test).
- [ ] Startup refuses demo mode on a database not starting with `doqto_demo`, or on a production database with `NODE_ENV=production`; refuses live mode with any `Demo*` provider bound.
- [ ] Demo providers still run attempt limits, rate limits and the `otps` row, so the flow matches live.
- [ ] Demo-created data is flagged `isDemo: true`.
- [ ] The demo banner shows on every screen in demo mode; the `123456` hint shows only in demo mode.
- [ ] Demo-only screens or endpoints (Demo inbox, webhook simulator) are unreachable when `PROVIDER_MODE=live`.

## I. Trust rules (reviews and ranking)

- [ ] Nothing under `reviews/**` or `ranking/**` imports `payments/**` (lint rule present and passing; manual grep as well).
- [ ] The ranking function's input type has no plan, fee or payment field.
- [ ] No doctor-callable path writes `ratingSummary`, review `state`, review weight or order.
- [ ] `visitVerifiedAt` is set only by a correct visit code or walk-in OTP, never by staff alone.
- [ ] One review per appointment is enforced by the unique index, not only by code.

## J. Privacy and clinical data

- [ ] No clinical field anywhere: diagnosis, prescription, report, treatment, symptoms free text, medical history. `visitReason` stays a fixed non-clinical list.
- [ ] `medicalRecords` is not created, referenced or exposed.
- [ ] New personal data has a retention rule from DB doc section 6, and account deletion (BE-42) can find it.

## K. Frontend

- [ ] API calls go through the typed client and parse responses with the shared Zod schemas.
- [ ] No business rules in Next.js server actions or route handlers (TDD 9.2); the API decides.
- [ ] Tokens live in httpOnly cookies on the web; nothing sensitive in `localStorage` except the offline visit card (FE-21, FE-29).
- [ ] Mobile first at 360 px wide; tap targets at least 44 px on clinic screens; works one-handed where the story says.
- [ ] First-load JS under 200 KB on patient-facing pages (from `next build` output) where the story sets a budget.
- [ ] Every string patients or staff read is in the English and Hindi message files.
- [ ] Loading, empty and error states exist for each data screen; 401/403/409/429 have clear copy.
- [ ] Polling intervals match TDD 6.5 (30 s patient, 15 s clinic), paused when hidden.
- [ ] Accessible basics: labels on inputs, visible focus, sufficient contrast, OTP and phone inputs use the right `inputmode` and `autocomplete`.

## L. User-facing copy

- [ ] Wait times are ranges ("about 25 to 35 minutes"), never a precise promise (TDD 6.3).
- [ ] No marketing language in WhatsApp templates; opt-out is clear.
- [ ] Doctor reply form warns against disclosing patient details.
- [ ] Consent text for WhatsApp and for publishing reviews is present where data is first collected.

## M. Docs

- [ ] Swagger and `CONTRACT.md` reflect the change.
- [ ] `.env.example` lists any new variable with a comment.
- [ ] Anything a later story or Raunak must know is in the owner's status file or an ADR, not only in code comments.
