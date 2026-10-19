# Doqto Database Design (Phase 1, MongoDB)

Companion to `doqto-technical-design.md` (section 3). This file is the full schema reference: collections, fields, indexes, constraints, retention and query patterns. Mongoose + MongoDB Atlas (Mumbai, `ap-south-1`).

## 1. Conventions

- **IDs**: `_id` is `ObjectId`. Public URLs use `doctors.slug`, never the id.
- **Time**: stored UTC (`Date`). Clinic days are stored as an IST date string `'YYYY-MM-DD'` in `date` fields, because "today's queue" is an IST concept.
- **Money**: integers in paise. Never floats.
- **Phones**: E.164 strings (`+919876543210`).
- **Timestamps**: every collection has `createdAt`, `updatedAt` (`timestamps: true`).
- **Soft state, not soft delete**: use a `status`/`state` field. Hard deletes only for TTL data and DPDP erasure.
- **Embed vs reference**: embed small, bounded, always-read-together data (address, qualifications, rating summary). Reference anything that grows (appointments, reviews, events).
- **Enforce rules with indexes**, not only application code: double-booking, one review per visit, idempotent webhooks, and notification dedupe are all unique indexes.
- **Validation**: Mongoose schemas with `strict: true`; DTO validation in NestJS (`whitelist: true, forbidNonWhitelisted: true`). Add MongoDB `$jsonSchema` validators later only if more than one service writes.
- **No clinical data**. No diagnosis, prescription, report or treatment fields anywhere (DPDP review pending, see TDD section 11).

## 2. Entity relationships

```
users 1 ───── 0..1 doctors 1 ───── * schedules * ───── 1 clinics
  │                  │                                      │
  │                  ├── * doctorStatus (1 per day)         │
  │                  │        └── * statusEvents            │
  │                  │                                      │
  │ 1                │ 1                                    │ 1
  └──── * appointments * ───────────────────────────────────┘
              │ 1                │ 1
              │                  │
              ├── 0..1 payments  └── 0..1 reviews ── 0..1 reply, 0..1 appeal (embedded)
              │                          │
              │                          └── * reviewClusters (fraud groupings)
users 1 ── * refreshTokens, * pushSubscriptions (embedded), * notifications
otps (by phone, TTL)      auditLogs (append-only)      jobs (scheduled work)
[reserved, not designed]  medicalRecords
```

Cardinality notes:
- A user is at most one doctor (`doctors.userId` unique).
- A doctor works at many clinics; a clinic has many doctors (`doctors.clinicIds` and `clinics.doctorIds`, both kept in sync by the API; `schedules` is the source of truth for who works where and when).
- An appointment has exactly one patient user, doctor and clinic. It has at most one payment and at most one review.

## 3. Collections

### 3.1 `users`

| Field | Type | Notes |
| --- | --- | --- |
| phone | string | E.164, **unique** |
| phoneVerifiedAt | Date | |
| name | string | |
| roles | string[] | `patient`, `doctor`, `clinic_staff`, `admin` |
| language | string | `en`, `hi`, ... |
| whatsappOptIn | boolean | consent flag, default true with explicit text |
| consentLog | `[{ type, version, at }]` | privacy policy / WhatsApp consent versions |
| status | string | `active`, `suspended`, `deleted` |
| deviceHashes | string[] | last 5 hashed fingerprints (fraud scoring) |
| pushSubscriptions | `[{ endpointHash, endpoint, keys, createdAt }]` | embedded, max 5 per user |
| clinicIds | ObjectId[] | clinics where the user is staff (role `clinic_staff`) |
| lastLoginAt | Date | |

Indexes: `{ phone: 1 }` unique; `{ roles: 1, status: 1 }`.

### 3.2 `doctors`

| Field | Type | Notes |
| --- | --- | --- |
| userId | ObjectId | unique |
| slug | string | unique, `dr-anita-sharma-bareilly` |
| name, gender, photoUrl, bio | | |
| languages | string[] | |
| qualifications | `[{ degree, institute, year }]` | embedded |
| specialties | string[] | from a controlled list |
| experienceYears | number | |
| registration | `{ council, number, year, docKey }` | `docKey` = private R2 object key |
| verification | `{ status, verifiedBy, verifiedAt, notes }` | `pending`, `verified`, `rejected` |
| clinicIds | ObjectId[] | |
| consultFee | number | paise, informational only |
| bookingFee | number | paise, 1000 to 2000 |
| ratingSummary | `{ count, recommendPct, waitTime, explanation, behaviour, facilities, valueForMoney, updatedAt }` | cache, written only by the rating job |
| isListed | boolean | true only when verified and profile complete |
| city | string | denormalised from primary clinic for fast filtering |

Indexes: `{ slug: 1 }` unique; `{ userId: 1 }` unique; `{ isListed: 1, city: 1, specialties: 1 }`; `{ 'verification.status': 1, createdAt: 1 }` (admin queue); text index on `name`, `specialties` for search.

### 3.3 `clinics`

| Field | Type | Notes |
| --- | --- | --- |
| name, phone | | |
| address | `{ line1, area, city, district, state, pincode }` | |
| location | GeoJSON Point `[lng, lat]` | |
| photos | string[] | R2 keys |
| ownerUserId | ObjectId | |
| staffUserIds | ObjectId[] | access control source of truth |
| doctorIds | ObjectId[] | |
| timezone | string | always `Asia/Kolkata` in Phase 1 |

Indexes: `{ location: '2dsphere' }`; `{ 'address.city': 1 }`; `{ staffUserIds: 1 }`.

### 3.4 `schedules`

One per (doctor, clinic). Slots are computed on read, never stored.

| Field | Type | Notes |
| --- | --- | --- |
| doctorId, clinicId | ObjectId | |
| weekly | `[{ day (0-6), start 'HH:mm', end 'HH:mm', slotMinutes, capacityPerSlot }]` | |
| exceptions | `[{ date, type: 'leave' or 'custom', blocks? }]` | |
| bookingWindowDays | number | default 7 |
| walkInShare | number | 0 to 1, share of capacity reserved for walk-ins |
| isActive | boolean | |

Indexes: `{ doctorId: 1, clinicId: 1 }` unique.

### 3.5 `appointments`

Booking, queue entry and visit proof in one document.

| Field | Type | Notes |
| --- | --- | --- |
| doctorId, clinicId, patientUserId | ObjectId | |
| patientName, patientPhone | string | may differ from account holder |
| date | string | IST `YYYY-MM-DD` |
| slotStart, slotEnd | Date | null for pure walk-ins |
| source | string | `online`, `walk_in`, `whatsapp_manual`, `phone_manual` |
| status | string | `pending_payment`, `confirmed`, `checked_in`, `in_consult`, `completed`, `no_show`, `cancelled_by_patient`, `cancelled_by_clinic`, `expired` |
| holdExpiresAt | Date | only while `pending_payment` (10 min) |
| queueToken | number | per doctor per day, assigned at check-in |
| effectiveTime | Date | queue sort key (section 6.2 of TDD) |
| checkInAt, consultStartAt, consultEndAt | Date | |
| visitCode | `{ hash, expiresAt, attempts, lockedUntil }` | 4-digit code, hashed |
| visitVerifiedAt | Date | set by correct code or walk-in OTP |
| reviewUnlockAt | Date | consultEnd + 24 h, or end of clinic day + 24 h |
| paymentId | ObjectId | optional |
| cancelReason | string | |
| statusHistory | `[{ status, at, by }]` | embedded, bounded (< 15 entries) |

Indexes:
- `{ doctorId: 1, slotStart: 1 }` **unique, partial** where `status` in `[pending_payment, confirmed, checked_in, in_consult]` and `slotStart` exists. This is what makes double-booking impossible.
- `{ doctorId: 1, date: 1, status: 1, effectiveTime: 1 }` (live queue and day sheet)
- `{ patientUserId: 1, date: -1 }` (my appointments)
- `{ status: 1, holdExpiresAt: 1 }` partial on `pending_payment` (expiry job)
- `{ status: 1, reviewUnlockAt: 1 }` partial on `completed` (review-nudge job)
- `{ clinicId: 1, date: 1 }`

### 3.6 `doctorStatus`

One live document per doctor per day. This is the polled document; keep it small.

| Field | Type | Notes |
| --- | --- | --- |
| doctorId, clinicId | ObjectId | |
| date | string | IST date |
| state | string | `not_started`, `in_clinic`, `running_late`, `on_break`, `done_for_day`, `on_leave` |
| delayMinutes | number | |
| etaAt | Date | |
| message | string | max 80 chars |
| currentToken, queueLength | number | denormalised by the queue endpoints |
| tokenCounter | number | last token issued today; incremented atomically at check-in |
| avgConsultMinutes | number | EWMA, carried over from the previous day |
| updatedBy | ObjectId | |

Indexes: `{ doctorId: 1, date: 1 }` unique; TTL on `createdAt` after 90 days (history lives in `statusEvents`).

### 3.7 `statusEvents`

Append-only log of status changes: `{ doctorId, clinicId, date, from, to, delayMinutes, by, at }`. Indexes: `{ doctorId: 1, date: 1, at: 1 }`. Kept 12 months, then archived or dropped.

### 3.8 `reviews`

| Field | Type | Notes |
| --- | --- | --- |
| doctorId | ObjectId | |
| appointmentId | ObjectId | **unique** |
| patientUserId | ObjectId | |
| ratings | `{ waitTime, explanation, behaviour, facilities, valueForMoney }` | each 1 to 5 |
| wouldRecommend | string | `yes`, `no`, `unsure` |
| visitReason | string | controlled non-clinical list |
| text | string | 20 to 1000 chars, optional |
| waitedMinutesReported | number | optional |
| state | string | `pending_checks`, `published`, `held_for_review`, `hidden`, `removed` |
| countsInSummary | boolean | false while fraud score is 40 to 69 or review is superseded |
| supersededBy | ObjectId | newer review by same patient for same doctor |
| submittedAt, publishAt | Date | |
| fraud | `{ score, signals[], clusterId?, scoredAt }` | |
| reply | `{ text, by, at, editableUntil }` | one per review |
| appeal | `{ by, reasonCode, text, status, decidedBy, decidedAt, note }` | `status`: `open`, `upheld`, `rejected` |
| editCount | number | max 2 |
| moderationLog | `[{ action, by, at, reasonCode }]` | embedded, bounded |

The "cooling down" state is not stored: a review cannot be created before `appointments.reviewUnlockAt`, enforced in the API.

Indexes: `{ appointmentId: 1 }` unique; `{ doctorId: 1, state: 1, publishAt: -1 }` (public list); `{ doctorId: 1, patientUserId: 1, submittedAt: -1 }` (supersede lookup); `{ state: 1, 'fraud.score': -1 }` (admin queue); `{ 'fraud.clusterId': 1 }`; `{ 'appeal.status': 1 }` partial on `open`.

### 3.9 `reviewClusters`

Output of the nightly fraud job: `{ doctorId, reviewIds[], signalType, firstSeenAt, status: 'open'|'confirmed_abuse'|'cleared', decidedBy, decidedAt }`. Indexes: `{ status: 1, doctorId: 1 }`.

### 3.10 `payments`

| Field | Type | Notes |
| --- | --- | --- |
| appointmentId, patientUserId | ObjectId | |
| amount | number | paise |
| currency | string | `INR` |
| purpose | string | `booking_fee` |
| gateway | string | `razorpay` |
| gatewayOrderId, gatewayPaymentId | string | |
| signatureVerified | boolean | |
| status | string | `created`, `paid`, `failed`, `refund_pending`, `refunded` |
| refund | `{ id, amount, reason, at }` | |
| processedEventIds | string[] | Razorpay event ids already applied (idempotency) |

Indexes: `{ gatewayOrderId: 1 }` unique; `{ gatewayPaymentId: 1 }` unique sparse; `{ appointmentId: 1 }`; `{ status: 1, createdAt: 1 }` (reconciliation job). Raw webhook bodies go to a separate `webhookLogs` collection with a 30-day TTL, not into this document.

### 3.11 `notifications` (outbox)

| Field | Type | Notes |
| --- | --- | --- |
| userId, phone | | |
| channel | string | `whatsapp`, `sms`, `webpush` |
| template, params | | |
| dedupeKey | string | **unique** |
| status | string | `queued`, `sent`, `delivered`, `read`, `failed` |
| providerMessageId | string | |
| attempts, lastError | | |
| sendAfter | Date | |

Indexes: `{ dedupeKey: 1 }` unique; `{ status: 1, sendAfter: 1 }` (sender job); `{ providerMessageId: 1 }`; TTL `createdAt` 90 days.

### 3.12 Supporting collections

| Collection | Fields | Indexes |
| --- | --- | --- |
| `otps` | `phone, purpose, codeHash, attempts, expiresAt` | `{ phone: 1, purpose: 1 }`; TTL on `expiresAt` |
| `refreshTokens` | `userId, tokenHash, deviceId, expiresAt, revokedAt, replacedBy` | `{ tokenHash: 1 }` unique; `{ userId: 1 }`; TTL on `expiresAt` |
| `jobs` | `type, runAt, payload, status, lockedBy, lockedUntil, attempts` | `{ status: 1, runAt: 1 }` |
| `auditLogs` | `actorUserId, action, entity, entityId, before, after, at` | `{ entity: 1, entityId: 1, at: -1 }`; `{ actorUserId: 1, at: -1 }` |
| `webhookLogs` | `source, eventId, body, receivedAt` | `{ source: 1, eventId: 1 }` unique; TTL 30 days |

### 3.13 Reserved, not designed

`medicalRecords` (QR-linked patient history). Name reserved only. No schema, no endpoints, no UI until the DPDP Act legal review is complete.

## 4. Key query patterns and the index that serves each

| Query | Collection | Index |
| --- | --- | --- |
| Doctors near me by specialty | doctors + clinics | clinics `2dsphere`, then doctors `{ isListed, city, specialties }` |
| Free slots for a doctor on a date | schedules + appointments | `{ doctorId, clinicId }` and `{ doctorId, date, status, effectiveTime }` |
| Reserve a slot | appointments | unique partial `{ doctorId, slotStart }` |
| Today's queue for a clinic | appointments | `{ doctorId, date, status, effectiveTime }` |
| Patient polls doctor status | doctorStatus | `{ doctorId, date }` unique |
| Patient's upcoming visits | appointments | `{ patientUserId, date: -1 }` |
| Public review list | reviews | `{ doctorId, state, publishAt: -1 }` |
| Reviews unlocking now | appointments | partial `{ status, reviewUnlockAt }` |
| Admin moderation queue | reviews | `{ state, 'fraud.score': -1 }`, partial `{ 'appeal.status' }` |
| Expire unpaid holds | appointments | partial `{ status, holdExpiresAt }` |
| Send queued messages | notifications | `{ status, sendAfter }` |
| Webhook idempotency | payments / webhookLogs | unique gateway ids / `{ source, eventId }` |

## 5. Consistency, transactions and concurrency

- Atlas M0/Flex run replica sets, so multi-document transactions are available. Use them in only three places: (1) payment captured -> appointment `confirmed` + visit code + payment `paid`; (2) cancel -> appointment status + refund request; (3) review publish -> review state + queue a rating-recompute job. Everything else is single-document writes.
- Double-booking is prevented by the unique partial index; the API turns the duplicate-key error (`11000`) into `409 Slot taken`.
- Queue token assignment: `findOneAndUpdate` with `$inc` on `doctorStatus.tokenCounter`, so two simultaneous check-ins never share a token.
- Jobs claim work with `findOneAndUpdate({ status: 'queued', runAt: { $lte: now } }, { $set: { status: 'running', lockedUntil } })`, so a second API instance (if scaled) never runs the same job twice.
- Rating summary is recomputed from `reviews` (published, `countsInSummary: true`, not superseded) by a job, never incrementally, so it can always be rebuilt.

## 6. Retention and privacy

| Data | Retention |
| --- | --- |
| `otps`, `refreshTokens` | TTL on expiry |
| `notifications` | 90 days |
| `webhookLogs` | 30 days |
| `doctorStatus` | 90 days; `statusEvents` 12 months with patient ids absent |
| `appointments`, `payments` | kept for accounting and dispute purposes; confirm period with the CA |
| `reviews` | kept; on account deletion, `patientUserId` is nulled and the display name becomes "Verified patient" |
| `auditLogs` | 24 months |

Account deletion (DPDP erasure): delete `users` PII and `refreshTokens`, null patient name/phone in `appointments`, keep payment rows with amounts only. Have the lawyer confirm.

## 7. Operations

- **Indexes**: declared in Mongoose schemas with `autoIndex` off in production; a startup migration creates them idempotently. The unique and partial indexes above are release-blocking.
- **Migrations**: a `migrations` collection of applied script names, run on startup (`migrate-mongo` or a ten-line custom runner). Schema changes are additive first, backfill second, enforce third.
- **Backups**: M0 has none. Nightly `mongodump` to R2 with 14-day retention from day one, and a tested restore before launch. Upgrade to a tier with Atlas backups once real bookings flow.
- **Sizing**: 1,000 appointments a day is about 30,000 documents a month, around 30 MB. M0's 512 MB lasts months; plan the move to Flex or M10 when storage passes 70% or the status endpoint's p95 passes 100 ms.
- **Seed data**: `scripts/seed.ts` creates 3 clinics, 5 doctors, schedules and sample appointments for local development and the pilot demo.

## 8. Differences from the TDD section 3

This file adds `reviewClusters`, `refreshTokens`, `jobs`, `webhookLogs` and `pushSubscriptions` (embedded in `users`), plus `effectiveTime`, `holdExpiresAt`, `reviewUnlockAt`, `countsInSummary`, `supersededBy` and `processedEventIds`. The TDD's "twelve collections" becomes sixteen here; if the founder wants the minimum for week 1, build `users`, `doctors`, `clinics`, `schedules`, `appointments`, `doctorStatus`, `notifications` and `otps` first.
