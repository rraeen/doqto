# Doqto API contract

Version **2.1.0** (contract v2, stories BE-12 and BE-21). Owner: BE. Source of truth for shapes is the Zod schemas in `src/`; this file is the readable index. FE and INT import from `@doqto/shared` and never redefine API types.

## Conventions

| Thing | Rule |
| --- | --- |
| Base URL | `/api/v1` (`API_PREFIX`). Swagger UI at `/api/docs`. |
| Auth | Web: httpOnly `doqto_at` / `doqto_rt` cookies only (send `credentials: 'include'`). Mobile: send `X-Doqto-Client: mobile` on `otp/verify` and `refresh` to get tokens in the body, then `Authorization: Bearer <accessToken>`. |
| Ids | 24-char hex strings (`ObjectIdSchema`). Public doctor URLs use `slug`. |
| Instants | ISO 8601 UTC strings, `2026-10-10T04:30:00.000Z` (`IsoDateTimeSchema`). |
| Clinic day | IST date string `YYYY-MM-DD` (`IstDateSchema`). |
| Money | Integer paise. ₹15 is `1500` (`PaiseSchema`). |
| Phones | E.164 Indian mobiles, `+919876543210` (`PhoneSchema`). The web `PhoneInput` outputs this. |
| Lists | `?cursor=&limit=` (default 20, max 50); response `{ items, nextCursor }`, `nextCursor: null` on the last page. |
| Unknown fields | Rejected with `400 VALIDATION_FAILED` on every request body. |
| Enums | `enums.ts`: roles, user status, language, OTP purpose, appointment status and source, doctor state, verification status, would-recommend, payment status, provider mode. |

## Error envelope

Every non-2xx response:

```json
{ "error": { "code": "OTP_INVALID", "message": "Wrong code", "details": { "attemptsLeft": 3 }, "requestId": "…" } }
```

Branch on `code`, never on `message`.

| Code | HTTP | Meaning, `details` |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Body or query invalid. `details.issues: [{ path, message }]` |
| `UNAUTHENTICATED` | 401 | No, invalid or expired access token. Call `/auth/refresh`, then retry once. |
| `FORBIDDEN` | 403 | Role or clinic scope does not allow this. |
| `ACCOUNT_SUSPENDED` | 403 | User status is `suspended` or `deleted`. |
| `NOT_FOUND` | 404 | |
| `CONFLICT` | 409 | Generic conflict. |
| `SLOT_TAKEN` | 409 | Slot booked by someone else (sprint 5). |
| `RATE_LIMITED` | 429 | `details.retryAfterSeconds` when known; also a `Retry-After` header. |
| `OTP_INVALID` | 400 | Wrong code. `details.attemptsLeft` |
| `OTP_EXPIRED` | 400 | No live OTP (expired, never requested, or already used). Request a new one. |
| `OTP_LOCKED` | 400 | 5 wrong codes. Request a new OTP. |
| `REFRESH_INVALID` | 401 | Refresh token unknown, expired or revoked. Log in again. |
| `INTERNAL` | 500 | |

## Sprint 1 endpoints (final in v0)

### `GET /health` (public)

Response `HealthResponse`: `{ status: 'ok', version, providerMode: 'demo' | 'live' }`.

### `POST /auth/otp/request` (public)

Request `OtpRequest`: `{ phone, purpose?: 'login' }`.
Response 200 `OtpRequestResponse`: `{ expiresAt, channel: 'whatsapp' | 'sms' | 'demo' }`. `channel: 'demo'` means no message was sent; the demo code is `123456`.
Errors: `VALIDATION_FAILED`, `RATE_LIMITED` (more than 3 requests in 10 minutes for this phone, or from this IP), `503 INTERNAL` (the code could not be sent; try again).
A new request replaces any earlier unused OTP for the phone. OTPs last 5 minutes.

### `POST /auth/otp/verify` (public)

Request `OtpVerifyRequest`: `{ phone, code, deviceId?, whatsappOptIn? }`. `whatsappOptIn` is the signup consent checkbox (defaults to `true`); it only applies when this login creates the account, and is logged with `WHATSAPP_CONSENT_VERSION`.
Response 200 `OtpVerifyResponse`: `{ accessTokenExpiresAt, refreshTokenExpiresAt, user: Me, isNewUser }`, plus `accessToken` and `refreshToken` only when the request has `X-Doqto-Client: mobile` (web never sees tokens in JSON).
Also sets httpOnly cookies `doqto_at` (15 minutes) and `doqto_rt` (30 days, path `/api/v1/auth`).
Rate limit: 20 verifies per 10 minutes per IP (on top of 5 attempts per code).
Errors: `VALIDATION_FAILED`, `OTP_INVALID` (with `attemptsLeft`), `OTP_EXPIRED`, `OTP_LOCKED` (after 5 wrong codes), `ACCOUNT_SUSPENDED`, `RATE_LIMITED`.
First login creates the user with role `patient`.

### `POST /auth/refresh` (public)

Request `RefreshRequest`: `{ refreshToken? }`. Mobile sends it in the body; web sends `{}` and the `doqto_rt` cookie.
Response 200 `RefreshResponse` (new expiry times; tokens in the body only with `X-Doqto-Client: mobile`) and fresh cookies. The old refresh token is revoked; presenting a revoked token again revokes every token issued from that login.
Errors: `REFRESH_INVALID`, `ACCOUNT_SUSPENDED`.
Make refresh single-flight in the client: one in-flight refresh per tab (and Web Locks across tabs). If two refreshes still race, the loser gets `REFRESH_INVALID` with `details.raced: true` and **no cookie changes**; the winner's new cookies stand, so just retry the original request. A rotated token presented again more than 20 seconds later is treated as theft and revokes the whole login.

### `POST /auth/logout` (public, idempotent)

Request `LogoutRequest`: `{ refreshToken? }` (body or cookie). Response 204, cookies cleared. Unknown tokens still return 204.

### `GET /me` (any logged-in user)

Response `Me`: `{ id, phone, name, roles, language, whatsappOptIn, status, clinicIds, isDemo, createdAt }`. `name` is `null` until set.
Errors: `UNAUTHENTICATED`, `ACCOUNT_SUSPENDED`.

### `PATCH /me` (any logged-in user)

Request `UpdateMeRequest`: any of `{ name (1 to 80 chars), language: 'en' | 'hi', whatsappOptIn }`, at least one. Response `Me`.
Errors: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `ACCOUNT_SUSPENDED`.

## Sprint 2 endpoints (contract v1, BE-05)

Schemas: `doctors.ts`, `clinics.ts`, `admin.ts`, `specialties.ts`. Uploads are `multipart/form-data` with one field `file`; type and size are checked on the bytes (magic numbers), not the file name.

| Method | Path | Who | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/doctors?city=&specialty=&near=lat,lng&radiusKm=&q=&cursor=&limit=` | public | `DoctorSearchQuery` (city or near required; `near` must be inside India, `parseNear`) | `Page<DoctorListItem>` | `VALIDATION_FAILED` |
| GET | `/doctors/:slug` | public | | `DoctorProfile` (listed doctors only) | `NOT_FOUND` |
| POST | `/doctor/onboarding` | logged-in, once | `DoctorOnboardingRequest` | 201 `DoctorPrivateProfile`; adds role `doctor`, status `pending` | `CONFLICT` (already onboarded) |
| GET | `/doctor/profile` | any logged-in user (404 until onboarded; no `@Roles('doctor')` because the role reaches the token only at the next refresh) | | `DoctorPrivateProfile` | `NOT_FOUND` (not onboarded) |
| PATCH | `/doctor/profile` | doctor | `UpdateDoctorProfileRequest` (editable fields only; `null` only clears the nullable ones) | `DoctorPrivateProfile`; a real name change or a registration change sends verification back to `pending` (warn before saving) | `VALIDATION_FAILED` for `ratingSummary`, `verification`, `isListed`, `slug`, `null` on a required field or any unknown field; `CONFLICT` (saved elsewhere meanwhile: reload) |
| PUT | `/doctor/registration-document` | doctor | file: PDF/JPEG/PNG/WebP up to 5 MB (`REGISTRATION_DOC_*`) | `RegistrationDocumentResponse`; verification back to `pending` | `VALIDATION_FAILED` |
| PUT | `/doctor/photo` | doctor | file: JPEG/PNG/WebP up to 2 MB (`PHOTO_*`) | `DoctorPrivateProfile` | `VALIDATION_FAILED` |
| POST | `/clinics` | doctor | `CreateClinicRequest` | 201 `ClinicPrivate`; caller is owner and linked | |
| GET | `/clinics/mine` | doctor, clinic_staff | | `{ items: ClinicPrivate[] }` | |
| GET | `/clinics/:id` | owner, its doctors, its staff | | `ClinicPrivate` (`staff` is empty for read-only staff) | `FORBIDDEN`, `NOT_FOUND` |
| PATCH | `/clinics/:id` | owner or its doctors | `UpdateClinicRequest` (`location: null` clears the pin) | `ClinicPrivate` | `FORBIDDEN` |
| POST | `/clinics/:id/photos` | owner or its doctors | file: photo, max `CLINIC_PHOTOS_MAX` (6) | `ClinicPrivate` | `CONFLICT` (limit) |
| DELETE | `/clinics/:id/photos/:index` | owner or its doctors | | `ClinicPrivate` | `NOT_FOUND` |
| POST | `/clinics/:id/staff` | owner or its doctors | `AddStaffRequest` (user created if new; role `clinic_staff`) | `ClinicPrivate` | `CONFLICT` (already staff) |
| DELETE | `/clinics/:id/staff/:userId` | owner or its doctors | | `ClinicPrivate` | `NOT_FOUND` |
| GET | `/geo/geocode?city=&address=&state=&pincode=` | doctor profile or clinic staff (30/min per user) | `GeocodeQuery` | `GeocodeResponse` (may be empty: place the pin by hand) | |
| GET | `/admin/doctors?status=pending&cursor=&limit=` | admin | `AdminDoctorQueueQuery` | `Page<AdminDoctorQueueItem>`, oldest submission first | |
| GET | `/admin/doctors/:id` | admin | | `AdminDoctorDetail` (5-minute signed `documentUrl`, `reviewToken`); each view is audit-logged | `NOT_FOUND` |
| POST | `/admin/doctors/:id/verify` | admin | `VerifyDoctorRequest` (`reviewToken` from the detail; `notes` required to reject and shown to the doctor) | `DoctorPrivateProfile` | `NOT_FOUND`; `CONFLICT` (already decided, the doctor changed something since the detail was opened, a parallel decision, or approve with no document): reload the detail; audit-logged with what was reviewed |

Rules worth knowing:
- `isListed` is computed, never written: verified **and** `missing` is empty (registration document, at least one clinic, specialties, qualifications, booking fee).
- Slugs are `dr-<name>-<city>` with a numeric suffix on collision; they never change once the doctor is listed.
- Specialties are keys from `SPECIALTIES` (with `en` and `hi` labels); the API rejects anything else.
- Coordinates in requests are `{ lat, lng }` (`LatLngSchema`, India bounds, which catches swapped values). Responses use GeoJSON `[lng, lat]` and carry a ready `mapsUrl`.
- Ranking never sees payment data (TDD 5.8).
- City search matches the city of the doctor's primary (first) clinic (DB doc 3.2); `near` matches any of their clinics. The offset cursor can shift by one if a doctor is listed or unlisted between pages.
- After `POST /doctor/onboarding`, call `POST /auth/refresh` so the access token carries role `doctor`. The `/doctor/*` and `/clinics` routes check for a doctor profile, not the token role, so they work before the refresh.
- Clinic `photoUrls` are public URLs; `DELETE /clinics/:id/photos/:index` unlinks the photo (the storage object stays until storage gets a delete method).

## Sprint 3 endpoints (contract v2, BE-12)

Schemas: `schedules.ts`, `clinic-console.ts`, `status.ts`. Clinic console routes take `clinicId` and `doctorId` (one clinic can have several doctors). "Clinic team" means the clinic owner, its doctors and its staff; the doctor must work at that clinic (`NOT_FOUND` otherwise). Dates are IST `YYYY-MM-DD`; today is computed in IST.

| Method | Path | Who | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/doctor/schedules/:clinicId?doctorId=` | clinic team | `doctorId` defaults to the caller's own doctor profile | `Schedule` (`updatedAt: null` if never saved) | `FORBIDDEN`, `NOT_FOUND` |
| PUT | `/doctor/schedules/:clinicId?doctorId=` | clinic team | `PutScheduleRequest` (replaces the whole schedule) | `Schedule` | `VALIDATION_FAILED` (overlapping blocks, duplicate exception dates) |
| GET | `/clinic/appointments?clinicId=&doctorId=&date=` | clinic team | `DaySheetQuery` | `DaySheetResponse` (sorted for the front desk, with the doctor's live status when `doctorId` is given) | |
| POST | `/clinic/appointments` | clinic team | `CreateClinicAppointmentRequest` (`walk_in` today without slot; `whatsapp_manual` / `phone_manual` with `date` and optional `slotStart` on the schedule) | 201 `DaySheetItem`, status `confirmed`, no fee | `SLOT_TAKEN`, `VALIDATION_FAILED` (slot not on the schedule) |
| POST | `/clinic/queue/:appointmentId/send-otp` | clinic team | | `SendVisitOtpResponse` (6-digit OTP to the patient's phone, purpose `visit`) | `RATE_LIMITED` (3 per 10 minutes per phone), `CONFLICT` (not waiting to check in) |
| POST | `/clinic/queue/check-in` | clinic team | `CheckInRequest` (`visit_code` or `otp`) | `QueueActionResponse`; token assigned, visit verified | `OTP_INVALID` (`attemptsLeft`), `OTP_LOCKED` (visit code: 5 wrong tries lock it 15 minutes), `OTP_EXPIRED`, `CONFLICT` (already checked in, or not today) |
| POST | `/clinic/queue/next` | clinic team | `QueueNextRequest` | `QueueActionResponse` (`completed` = the consult just ended, `appointment` = the one now called, or `null` if the queue is empty) | `CONFLICT` (`currentAppointmentId` no longer in consult: a double tap) |
| POST | `/clinic/queue/:appointmentId/no-show` | clinic team | | `QueueActionResponse` | `CONFLICT` |
| POST | `/clinic/queue/:appointmentId/move` | clinic team | `QueueMoveRequest` (place before another waiting patient; logged) | `QueueActionResponse` | `CONFLICT` |
| PUT | `/clinic/status` | clinic team | `UpdateStatusRequest` | `DoctorStatus` | `VALIDATION_FAILED` (`running_late` without `delayMinutes`) |
| GET | `/doctors/:id/status` | public | | `DoctorStatus` for today (default `not_started` with `updatedAt: null`); `Cache-Control: public, s-maxage=15` | `NOT_FOUND` (not a listed doctor) |
| GET | `/appointments/:id/position` | the patient, clinic team | | `AppointmentPosition` | `NOT_FOUND` |

Queue rules (TDD 6.2, 6.3):
- Tokens are per doctor per day, issued at check-in, never repeated.
- Effective time: slot start if a booked patient checks in no later than 10 minutes after it, else the check-in time. The queue is sorted by effective time, then token.
- Wait estimate: tokens ahead (counting the patient in consult) times the doctor's average consult (EWMA, starts at 8 minutes), plus time until the doctor's `etaAt` while `not_started` or `running_late`; shown as about 20% either side. `null` once seen, cancelled, or when the doctor is on leave or done.
- Poll `GET /doctors/:id/status` and `/appointments/:id/position` every 30 seconds (clinic console: day sheet every 15 seconds).
- At the end of the IST day (23:45, BE-20) a job marks bookings nobody checked in as `no_show` and completes verified visits still open (checked in or in consult) with `reviewUnlockAt` = end of day + 24 hours, so a clinic cannot block a review by never pressing next (TDD 5.2). The doctor becomes `done_for_day` unless on leave.
- Routes that name a `clinicId` answer `FORBIDDEN` to someone outside the clinic team; routes that name an appointment answer `NOT_FOUND`.
- `DoctorProfile.todayStatus` (on `GET /doctors/:slug`) is now filled with the same `DoctorStatus`.

## Sprint 4 endpoints (contract 2.1.0, BE-21 to BE-23)

Schemas: `notifications.ts`.

| Method | Path | Who | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/me/notifications?cursor=&limit=` | logged in, **demo mode only** | `MyNotificationsQuery` | `Page<MyNotification>`, newest first; `text` is the rendered message, secret parameters (visit codes) shown as `••••` | `NOT_FOUND` in live mode |
| GET | `/admin/notifications?status=&cursor=&limit=` | admin | `AdminNotificationsQuery` | `Page<AdminNotification>`, newest first, phone masked | `FORBIDDEN` |

Outbox rules (TDD 6.4, 7):
- Statuses: `queued`, `sending` (claimed by the sender), `sent`, `delivered`, `read`, `failed`, `skipped` (kept for dedupe, not sent: daily cap reached or account not active).
- The sender runs every 10 seconds: first try plus 3 retries (30 s, 2 min, 8 min), then `failed`. Bad input to the provider fails at once.
- Users with `whatsappOptIn: false` get SMS (also when they opt out after the message was queued). OTPs never go through the outbox.
- At most 4 WhatsApp status alerts (running late, turn near) per patient per IST day (`WHATSAPP_ALERTS_PER_DAY`).
- Alerts on `PUT /clinic/status`: running late by 20+ minutes alerts today's booked patients who have not checked in (walk-ins are already there), and again each time the delay grows by 15+ minutes. On leave cancels today's remaining bookings; done for the day cancels bookings whose slot is still to come. Cancelled online bookings get `appointment_cancelled_by_clinic` with a rebook link and are owed their fee (refund lands with BE-29).
- After `next`, `no-show` and `move`, the patient who is now 3 tokens away (counting the one in consult) gets `turn_near` once.
- Dedupe keys: `delay:<appointmentId>:<minutes>`, `cancel:<appointmentId>`, `turn:<appointmentId>`.
- `GET /doctors/:id/status` (BE-23): `Cache-Control: public, s-maxage=15, max-age=15`, no personal data.

## Read shapes still to be finalised

| Schema | DB doc | Used by | Final in |
| --- | --- | --- | --- |
| `Appointment` | 3.5 | my appointments, position | v2/v3 (BE-12, BE-24) |

## Changelog

- **6.15.2** (2026-11-09): `ChatThread` gains an optional `photoUrl` (the doctor's approved photo, patient view only) for the chat list and the chat header. Additive.
- **6.15.1** (2026-11-09): `MyAppointment.doctor` gains an optional `photoUrl` (the doctor's approved profile photo, or `null`), so the patient's appointment cards and the next-visit card can show it. Additive.
- **6.15.0** (2026-11-09, the doctor's profile): the owner of an approved clinic service edits what patients see, in the console. `GET /console/workspaces/:id/profile` returns `MyProfile` (the approved `current` profile and photo, the `pending` change if any, and whether the profile is `listed`). `PUT .../profile` takes the whole clinic form (`{ profile }`, the same checks as the application) and keeps it as a pending change; `PUT .../profile/photo` (multipart `file`, JPEG, PNG or WebP, 2 MB) keeps a new photo as part of the pending change; `DELETE .../profile` withdraws the pending change. Patients keep seeing the approved profile: nothing reaches search or the doctor page until the Doqto team approves. A save that changes nothing is `VALIDATION_FAILED`. The team: `GET /platform/profile-changes` (waiting changes, oldest first), `GET /platform/profile-changes/:id` (`current` next to `proposed`) and `POST /platform/profile-changes/:id/decision` (`approve`, or `reject` with a note of 5+ characters); approving updates the doctor and clinic records patients read (and the photo), rejecting keeps the old profile and the doctor sees the note and can edit again. Decisions are written to the audit log. A change that was already decided or withdrawn is `CONFLICT`/`NOT_FOUND`.
- **6.14.0** (2026-11-09, chat with the doctor): one conversation per booking, text only (`chat.ts`). Patients: `GET /chats` (their conversations), `GET /chats/:appointmentId?after=` (the thread and its messages; reading marks the doctor's messages read), `POST /chats/:appointmentId` (`{ text }`, 1 to 1000 characters). The doctor: the same three under `/console/workspaces/:id/chats`, for the owner of the approved clinic service, only for that doctor's bookings. A thread exists once the doctor has accepted the booking (`confirmed`, `checked_in`, `in_consult`, `completed`); it can be written to until 7 days after the visit (`open`), then it is read-only. A booking that was cancelled or not yet accepted has no chat (`NOT_FOUND`); a closed thread refuses new messages with `CONFLICT`. A message from another patient's or doctor's booking is `NOT_FOUND`. Sending is limited to 30 a minute. Deleting a patient account deletes their messages.
- **6.13.0** (2026-11-09, the visit day in the console): the queue actions of the existing clinic console, for the owner of an approved clinic service, with the clinic and doctor taken from the service in the path (never from the body): `POST /console/workspaces/:id/queue/check-in` (visit code or OTP), `POST .../queue/next`, `POST .../queue/:appointmentId/send-otp`, `.../no-show`, `.../move`, `PUT /console/workspaces/:id/status` (the doctor's live status; `running_late` needs `delayMinutes`) and `POST /console/workspaces/:id/appointments` (a walk-in or a booking taken by phone or WhatsApp). Responses are the existing `QueueActionResponse`, `DoctorStatus` and `DaySheetItem`. A booking of another doctor is `NOT_FOUND`; a body that names `clinicId` or `doctorId` is refused. The queue order, the visit-code and OTP rules and the turn-near alerts are unchanged.
- **6.12.0** (2026-11-09, a moved booking needs the doctor again): `POST /appointments/:id/reschedule` on a `confirmed` booking now sets its status back to `pending_confirmation` (it was left `confirmed` before), drops the old visit code, and keeps the paid fee. The doctor has to accept the new time with the usual confirm; that creates a new visit code and sends it to the patient. A booking that was already waiting just stays waiting at its new time. The old slot is freed at once and the new one is held. `DaySheetItem` gains an optional `rescheduled` (true when the patient moved it at least once) so the doctor can tell a changed booking from a new one. The old "your confirmation was sent again" message after a move is gone.
- **6.11.0** (2026-11-09, upcoming bookings): `GET /console/workspaces/:id/appointments/upcoming` returns the accepted bookings (`confirmed`, `checked_in`, `in_consult`) from today on, on any date, earliest first (`DaySheetItem[]`, up to 200), with the same access rules as the other booking routes. A booking leaves `waiting` when accepted and shows here.
- **6.10.0** (2026-11-09, bookings in the console): `GET /console/workspaces/:id/appointments?date=` (one day of the approved clinic's bookings, today by default, the existing `DaySheetResponse`), `GET /console/workspaces/:id/appointments/waiting` (paid bookings on any date waiting for the doctor, `DaySheetItem[]`) and `POST /console/workspaces/:id/appointments/:appointmentId/confirm` (accepts a paid booking: creates the visit code and tells the patient; the existing `ConfirmAppointmentResponse`). Same access rules as the schedule: a member of an approved clinic service; `FORBIDDEN` before approval, `NOT_FOUND` for a lab, a non-member, or another doctor's booking. The owner account of an approved clinic now counts as the clinic's manager in the existing clinic services, so the same rules (visit code, WhatsApp confirmation) apply.
- **6.9.0** (2026-11-09, schedule from the console): `GET /console/workspaces/:id/schedule` and `PUT /console/workspaces/:id/schedule` read and replace the weekly hours (the existing `Schedule` and `PutScheduleRequest` shapes, with the same rules: no overlapping sessions, valid times) of an approved clinic or doctor service, for its members. A service that is not approved gets `FORBIDDEN`, a lab or pharmacy and anyone not a member get `NOT_FOUND`. A newly listed doctor has no schedule, so patient slots are empty (`scheduled: false`) until it is saved; saving it is what opens booking.
- **6.8.0** (2026-11-09, applicants can read the reason): `Workspace` gains `reviewNote` (`string | null`), the note Doqto wrote when sending an application back or rejecting it; the console shows it on the services panel and above the form being fixed. Migration `0012` sends clinic applications that were approved before the clinic form asked for the registration year, state and PIN code back for changes with a note saying so, because they could not be put on the patient site.
- **6.7.0** (2026-11-09, publishing to the patient site): approving a `clinic` application now creates (or updates) the doctor and clinic records that patient search reads, so the doctor appears in `GET /doctors` and `GET /doctors/:slug`. The clinic form gains three required fields, `registrationYear`, `state` and `pincode` (a 6-digit PIN), because the patient listing needs them. Approving an application that lacks them is refused with `VALIDATION_FAILED` (`details.issues` lists the paths) and it stays `pending`; the team sends it back for changes instead. Sending back (`request_changes`) or rejecting an application that is already `verified` is now allowed and takes the doctor off the site (`isListed` false); an already sent-back or rejected one cannot be decided again until the applicant resubmits (`CONFLICT`). Labs and pharmacies have no patient-facing list yet. The booking fee of a listing from an application is the platform minimum (₹10) until it is set; a listing from an application has no patient-side user and needs no uploaded registration scan (the team checked the details).
- **6.6.0** (2026-11-09, admin merged into the console): the separate team sign-in is removed (`/platform/auth/*` and the `doqto_pt` / `doqto_prt` cookies and `admin` token audience are gone). The Doqto team signs in with `POST /console/auth/login` like everyone else; `ConsoleAccount` gains `platformRole` (`admin` or `null`). `/platform/applications*` accept a console session and require the `admin` role, checked in the database on every request: a signed-in provider gets `FORBIDDEN` (403), no session or a patient token gets `UNAUTHENTICATED` (401). Nothing else changes.
- **6.5.0** (2026-11-09, admin console; sign-in part superseded by 6.6.0): `platform.ts`. The Doqto team signs in at `/platform/auth/*` (`login`, `refresh`, `logout`, `me`) with an email or phone and a password; only accounts that were given the admin role by hand (`admin:create`) can, and anyone else gets the same `INVALID_CREDENTIALS` as a wrong password. Own cookies (`doqto_pt`, `doqto_prt`) and token audience (`admin`); the role is checked on every request, so removing it takes effect at once. `GET /platform/applications?status=&kind=` lists submitted applications (newest first, drafts are not listed) with `counts` per status; `GET /platform/applications/:id` returns one in full with the other services of the same business; `POST /platform/applications/:id/decision` approves (`verified`), sends back (`changes_requested`) or rejects, needing a note of 5+ characters unless approving; only a `pending` application can be decided (`CONFLICT` otherwise); every decision is written to the audit log. An authenticator-code step is not built yet.
- **6.4.0** (2026-11-09, application form): `POST /console/applications` applies for one or more services at once, each with its form answers (`unit-forms.ts`: `UNIT_FORMS` lists the fields per kind, `checkUnitProfile` checks them; the console and the API use the same list). Every form is checked first and nothing is saved unless all pass (`VALIDATION_FAILED`, issue paths like `lab.registrationNumber`). Each service becomes a `pending` unit; one that is `pending`, `verified` or `suspended` cannot be applied for again (`CONFLICT`), one `draft` or `changes_requested` can be resubmitted. `POST /console/workspaces` is removed; `GET /console/workspaces/:id` returns `WorkspaceDetail` (with the form answers). Only a `verified` service opens a dashboard.
- **6.3.0** (2026-11-09, plain sign-up): registering asks for no service (`services` is not accepted); it creates the account and its organization only. After signing in the owner sets up each service with `POST /console/workspaces` (`clinic`, `lab` or `pharmacy`, once each; a draft unit). `ConsoleAccount` has no `accountType`; it has `workspaces` (`Workspace`: unit id, organization id, kind, name, approval `status`, member `role`). New `GET/POST /console/workspaces` and `GET /console/workspaces/:id` (a unit only for its members). Unit statuses: `draft`, `pending`, `changes_requested`, `verified`, `rejected`, `suspended`; only `verified` is listed on the patient site.
- **6.1.0** (2026-11-09, console sign-in): `console-auth.ts`. Doctors, clinics, labs and pharmacies sign in at `/console/auth/*` with a phone or email and a password, confirmed once with a 6-digit code: `register`, `verify`, `resend`, `login`, `forgot-password`, `reset-password`, `refresh`, `logout`, `me`. Own cookies (`doqto_ct`, `doqto_crt`) and a token audience (`aud: console`), so a console token never opens a patient route and the other way round. New error codes `INVALID_CREDENTIALS` and `CONTACT_NOT_VERIFIED`. Patient auth (`/auth/*`) is unchanged.
- **6.0.0** (2026-10-21, patient completion): the patient routes are implemented in the API. New or changed in the contract: `GET /doctors` takes no required filter (city, near, name and specialty are all optional; an empty search lists everyone) and its page carries `total` (`DoctorSearchPageSchema`); `MyAppointment.order` (the payment order of a booking that is still `pending_payment`); `MyNotification.read` and `.appointmentId`, `GET /me/notifications` now works in every mode, plus `GET /me/notifications/unread-count` and `POST /me/notifications/read`; `POST /auth/logout-all`; health records (`records.ts`: `GET/POST /me/records`, `GET /me/records/:id/file`, `DELETE /me/records/:id`). Everything else in v3 to v5 (slots, booking, payments, doctor confirm, cancel, reschedule, reviews, export, delete, push, transparency) is served by the API as specified.

- **2.1.0** (2026-10-10, BE-21): notifications (`MyNotification`, `AdminNotification`, queries, statuses, channels, `WHATSAPP_ALERTS_PER_DAY`), `/me/notifications` and `/admin/notifications`. Additive.
- **2.0.0** (2026-10-10, BE-12): contract v2. Admin: `AdminDoctorDetail.reviewToken`, required in `VerifyDoctorRequest` (RD BE-09 blocker); `phone` nullable and `specialties` typed in admin shapes; queue ordered by submission. `DoctorSearchQuery` rejects unknown keys. Geocode is for doctors and clinic staff only. Schedules (`PutScheduleRequest`, `Schedule`), day sheet, manual and walk-in entries, check-in by visit code or OTP, queue next / no-show / move, status update, public status, appointment position. `DoctorStatus` is final: `updatedAt` is now nullable (no status set today). Review fixes: `near` checked against India bounds (`parseNear`, `NEAR_MESSAGE`); read-only staff get `staff: []` on clinics; refresh race behaviour; `PATCH /me` and OTP 503 errors documented. Package version now follows the contract version.

- **1.0.0** (2026-10-10, BE-05): contract v1. Doctor onboarding, private and public profiles, uploads, clinics and staff, geocode, admin verification queue and decision, search query, `SPECIALTIES`, `LatLngSchema`, `ClinicPrivate`. `DoctorListItem`/`DoctorProfile` specialties are now `SpecialtyKey`s.
- **0.2.0** (2026-10-10, BE-04, RD BE-02 should-fix): tokens appear in JSON only for `X-Doqto-Client: mobile` (`CLIENT_HEADER`, `MOBILE_CLIENT`); `accessToken`/`refreshToken` now optional in `TokenPair`; `AccessTokenClaims.roles` uses `RoleSchema`; `WHATSAPP_CONSENT_VERSION`; package `source` export condition; verify rate limit documented.
- **0.1.0** (2026-10-10, BE-02): first contract. Auth, `/me`, health, error envelope, pagination, enums, placeholder read shapes.
