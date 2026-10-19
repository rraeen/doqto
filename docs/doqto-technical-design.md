# Doqto Technical Design (Phase 1 MVP)

Oct 9, 2026 · @Raunak

Phase 1 is one NestJS API on MongoDB serving a Next.js web app that installs as a PWA, with WhatsApp for every patient message and Razorpay for a ₹10-20 booking fee. Everything here is sized for one developer and ₹2,500-10,000 a month of infra.

## 1. Architecture overview

Doqto is a modular monolith: one NestJS API, one MongoDB database, one Next.js app. No microservices, no message broker, no Kubernetes. Every external dependency (WhatsApp, Razorpay, SMS fallback, file storage) sits behind a small NestJS provider so it can be swapped without touching business logic.

Three clients talk to the same API:

- **Patient app** (Next.js, installable PWA): search, doctor profile, book, pay, live status, review.
- **Doctor / clinic console** (same Next.js app, `/clinic` route group): manage slots, update status, advance the queue, reply to reviews. Built mobile-first because clinic staff will run it on a cheap Android phone at the front desk.
- **Admin panel** (same Next.js app, `/admin` route group, founder-only at first): verify doctors, moderate flagged reviews, handle appeals.

Inbound traffic from outside (Razorpay webhooks, WhatsApp BSP delivery and reply webhooks) lands on dedicated `/webhooks/*` routes in the same API. Background work (reminders, cool-down unlocks, fraud scans, no-show marking) runs as scheduled jobs inside the API process using `@nestjs/schedule` plus a Mongo-backed job collection, not a separate worker fleet.

```
            Patients (PWA)      Clinic staff (PWA)      Admin
                  \                    |                 /
                   +------ Next.js on Vercel (SSR + PWA) +
                                       |  HTTPS / JSON (REST)
                                       v
                       NestJS API (single container, Render/Railway)
          +---------+---------+---------+---------+---------+---------+
          | auth    | doctors | booking | queue   | reviews | payments|
          +---------+---------+---------+---------+---------+---------+
          | notifications (WhatsApp first, SMS fallback) | jobs (cron) |
          +-----------------------+-------------------------------------+
                 |               |                   |
                 v               v                   v
          MongoDB Atlas    WhatsApp BSP        Razorpay
          (M0 -> M10)      (Interakt/AiSensy)  (orders + webhooks)
                 |
          Cloudflare R2 / Cloudinary (doctor photos, credential scans)
```

## 2. Tech stack

One language (TypeScript) end to end, so types are shared between frontend and backend and one person never context-switches.

| Layer | Choice | Why this, for a solo dev on a small budget |
| --- | --- | --- |
| Repo | pnpm monorepo: `apps/web`, `apps/api`, `packages/shared` | Shared DTO types and Zod schemas used by both apps; one CI pipeline |
| Web + PWA | Next.js (App Router), Tailwind, shadcn/ui, TanStack Query | SSR doctor pages rank on Google ("cardiologist in Bareilly"); TanStack Query gives polling and caching for free |
| PWA layer | Serwist (`@serwist/next`) service worker + web manifest | Maintained successor to next-pwa; offline shell, install prompt, Web Push |
| Backend | NestJS (REST, modular), class-validator, Swagger via `@nestjs/swagger` | Modules map 1:1 to features; Swagger doc becomes the contract for the Kotlin app later |
| Database | MongoDB Atlas + Mongoose | Flexible doctor profiles; geo queries (`2dsphere`) for "near me"; free M0 tier to start |
| Auth | Phone + OTP (WhatsApp first, SMS fallback), JWT access + refresh tokens | Tier-2/3 users have phones, not emails or passwords |
| Jobs | `@nestjs/schedule` cron + a `jobs` collection | No Redis or BullMQ until there is real load |
| Files | Cloudflare R2 (S3 API) or Cloudinary free tier | Doctor photos and credential scans; R2 has no egress fees |
| Payments | Razorpay Orders API + webhooks | UPI-first, India KYC, fast onboarding |
| Messaging | WhatsApp Cloud API via a BSP (AiSensy or Interakt), MSG91 for SMS fallback | Patients live on WhatsApp; BSP handles template approval |
| Monitoring | Sentry free tier, Better Stack / UptimeRobot free uptime checks | Know about errors before a doctor calls |

Deliberately not used in Phase 1: GraphQL, Redis, websockets, microservices, Docker Compose in production, a separate admin app. Each one is a reasonable later addition, and each costs time now with no user-visible benefit.

## 3. Data models (MongoDB)

Twelve collections. Rule of thumb used throughout: embed what is always read together and small (clinic address inside clinic, rating breakdown inside doctor), reference what grows without bound (appointments, reviews, status events). All documents carry `createdAt`/`updatedAt` (Mongoose `timestamps: true`). Money is stored in paise as integers. Times are stored in UTC and rendered in IST.

**users** (one login identity for patients, doctors, staff, admins)

```ts
{
  _id, phone: string /* E.164, unique */, phoneVerifiedAt: Date,
  name: string, roles: ('patient'|'doctor'|'clinic_staff'|'admin')[],
  language: 'hi'|'en'|..., whatsappOptIn: boolean,
  status: 'active'|'suspended', lastLoginAt: Date,
  deviceFingerprints: string[]   // last 5, used by fraud scoring
}
// index: { phone: 1 } unique
```

Patients do not get a separate collection in Phase 1. A patient is a `user` with role `patient`. This avoids a join on every request and keeps health data out of the model entirely (see section 11).

**doctors**

```ts
{
  _id, userId: ObjectId, slug: 'dr-anita-sharma-bareilly' /* unique, SEO URL */,
  name, photoUrl, gender, languages: string[],
  qualifications: [{ degree: 'MBBS'|'MD'|..., institute, year }],
  specialties: string[] /* controlled list */, experienceYears: number,
  registration: { council: 'NMC'|'UP Medical Council'|..., number, year,
                  docUrl /* private bucket */, },
  verification: { status: 'pending'|'verified'|'rejected', verifiedBy, verifiedAt, notes },
  clinicIds: ObjectId[], consultFee: number /* paise, informational */,
  bookingFee: number /* paise, 1000-2000 */,
  ratingSummary: { count, overall, waitTime, explanation, behaviour, facilities, valueForMoney },
  isListed: boolean   // false until verified
}
// indexes: { slug: 1 } unique, { specialties: 1, isListed: 1 }, { 'verification.status': 1 }
```

`ratingSummary` is a cache recomputed by a job when a review is published or hidden. It is never written by an API a doctor can call.

**clinics**

```ts
{
  _id, name, phone, address: { line1, area, city, district, state, pincode },
  location: { type: 'Point', coordinates: [lng, lat] },
  photos: string[], ownerUserId, staffUserIds: ObjectId[],
  doctorIds: ObjectId[]
}
// index: { location: '2dsphere' }, { 'address.city': 1 }
```

**schedules** (weekly template per doctor per clinic, from which slots are generated)

```ts
{
  _id, doctorId, clinicId,
  weekly: [{ day: 0-6, start: '10:00', end: '13:00', slotMinutes: 10, capacityPerSlot: 1 }],
  exceptions: [{ date: '2026-10-20', type: 'leave'|'custom', blocks?: [...] }],
  bookingWindowDays: 7, walkInShare: 0.4   // fraction of capacity kept for walk-ins
}
```

Slots are not stored as documents. They are computed on read from the schedule minus existing appointments. This removes a whole class of "generate slots nightly" bugs. `walkInShare` matters in Tier-2/3 clinics where most patients still walk in; online booking must not starve them.

**appointments** (one booking, also the queue entry and the visit record used by reviews)

```ts
{
  _id, doctorId, clinicId, patientUserId,
  patientName, patientPhone,               // may differ from account holder (booking for parent)
  date: '2026-10-20' /* IST date */, slotStart: Date, slotEnd: Date,
  source: 'online'|'walk_in'|'whatsapp_manual'|'phone_manual',
  status: 'pending_payment'|'confirmed'|'checked_in'|'in_consult'|
          'completed'|'no_show'|'cancelled_by_patient'|'cancelled_by_clinic',
  queueToken: number,                      // assigned at check-in, per doctor per day
  checkInAt, consultStartAt, consultEndAt,
  visitCode: { hash, expiresAt, usedAt },  // 4-digit code shown to patient; staff enters it at check-in
  visitVerifiedAt: Date,                   // set by check-in with valid code -> unlocks review later
  paymentId?: ObjectId, cancelReason?, statusHistory: [{ status, at, by }]
}
// indexes: { doctorId: 1, date: 1, status: 1 }, { patientUserId: 1, date: -1 },
//          { doctorId: 1, slotStart: 1 } unique partial on active statuses (prevents double-booking)
```

**doctorStatus** (one live document per doctor per day; the thing patients poll)

```ts
{
  _id, doctorId, clinicId, date,
  state: 'not_started'|'in_clinic'|'running_late'|'on_break'|'done_for_day'|'on_leave',
  delayMinutes: number, etaAt?: Date, message?: string /* max 80 chars */,
  currentToken: number, queueLength: number,   // denormalised for cheap reads
  avgConsultMinutes: number,                   // rolling, see section 6
  updatedBy, updatedAt
}
// index: { doctorId: 1, date: 1 } unique
```

**statusEvents** (append-only log of every status change, for audit and for "doctor is always late" signals later): `{ doctorId, date, from, to, delayMinutes, by, at }`.

**reviews**

```ts
{
  _id, doctorId, appointmentId /* unique */, patientUserId,
  ratings: { waitTime: 1-5, explanation: 1-5, behaviour: 1-5,
             facilities: 1-5, valueForMoney: 1-5 },
  wouldRecommend: 'yes'|'no'|'unsure',
  visitReason: string /* controlled list, e.g. 'fever', 'follow-up' */,
  text?: string /* 20-1000 chars */,
  waitedMinutesReported?: number,
  state: 'cooling_down'|'pending_checks'|'published'|'held_for_review'|'hidden'|'removed',
  publishAt: Date, fraud: { score: 0-100, signals: string[], clusterId? },
  reply?: { text, by, at, editedAt },
  appeal?: { by: 'doctor'|'patient', reason, status: 'open'|'upheld'|'rejected', decidedBy, decidedAt, note },
  moderationLog: [{ action, by, at, reason }]
}
// indexes: { appointmentId: 1 } unique, { doctorId: 1, state: 1, publishAt: -1 }, { 'fraud.clusterId': 1 }
```

**payments**

```ts
{
  _id, appointmentId, patientUserId, amount /* paise */, currency: 'INR',
  purpose: 'booking_fee', gateway: 'razorpay',
  gatewayOrderId, gatewayPaymentId, signatureVerified: boolean,
  status: 'created'|'paid'|'failed'|'refund_pending'|'refunded',
  refund?: { id, amount, reason, at }, webhookEvents: [{ type, at, raw }]
}
// indexes: { gatewayOrderId: 1 } unique, { appointmentId: 1 }
```

**notifications** (outbox; every outbound WhatsApp or SMS goes through here)

```ts
{ _id, userId, phone, channel: 'whatsapp'|'sms'|'webpush', template, params,
  dedupeKey /* unique, e.g. 'delay:appt123:30' */, status: 'queued'|'sent'|'delivered'|'read'|'failed',
  providerMessageId, attempts, lastError, sendAfter: Date }
```

**otps**: `{ phone, purpose: 'login'|'visit', codeHash, expiresAt /* TTL index */, attempts }`.

**auditLogs**: `{ actorUserId, action, entity, entityId, before, after, at }` for every admin and moderation action.

Relationship summary: a user may be a doctor (1:1 via `doctors.userId`); a doctor works at one or more clinics; an appointment ties patient, doctor, clinic and date; a review hangs off exactly one appointment; a payment hangs off exactly one appointment.

**Placeholder, not designed:** `medicalRecords` / QR-linked patient history. Reserved collection name only. No fields, no endpoints, no UI until the DPDP Act legal review is done (section 11).

## 4. API design (REST, `/api/v1`)

REST with NestJS, JSON in and out, versioned under `/api/v1` from day one so the Kotlin app can pin a version. Auth is a `Bearer` JWT; role checks use a `@Roles()` guard. Swagger is published at `/api/docs` and is the contract. Lists use cursor pagination (`?cursor=&limit=20`).

**Auth**

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/auth/otp/request` | public | `{ phone, purpose: 'login' }`; sends WhatsApp OTP, SMS if WhatsApp fails; 3 per 10 min per phone |
| POST | `/auth/otp/verify` | public | Returns access token (15 min) + refresh token (30 days) |
| POST | `/auth/refresh` | public | Rotates the refresh token |
| POST | `/auth/logout` | any | Revokes refresh token |
| GET / PATCH | `/me` | any | Name, language, WhatsApp opt-in |

**Doctors and clinics**

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/doctors?city=&specialty=&near=lat,lng&availableOn=` | public | Listed doctors only; sort by distance or rating; never by payment |
| GET | `/doctors/:slug` | public | Profile, clinics, rating summary, today's status |
| GET | `/doctors/:id/slots?date=` | public | Computed free slots |
| POST | `/doctor/onboarding` | doctor | Creates draft profile + uploads registration doc |
| PATCH | `/doctor/profile` | doctor | Editable fields only; never `ratingSummary` or `verification` |
| PUT | `/doctor/schedules/:clinicId` | doctor, staff | Weekly template + exceptions |
| POST | `/clinics` / PATCH `/clinics/:id` | doctor | Clinic details, location, photos |
| POST | `/clinics/:id/staff` | doctor | Add a staff phone number |
| POST | `/admin/doctors/:id/verify` | admin | Approve or reject with notes |

**Booking**

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/appointments` | patient | `{ doctorId, clinicId, slotStart, patientName, patientPhone }`; returns appointment in `pending_payment` + Razorpay order |
| GET | `/appointments/mine` | patient | Upcoming and past |
| GET | `/appointments/:id` | patient, staff | Includes live queue position |
| POST | `/appointments/:id/cancel` | patient, staff | Refund rules in section 8 |
| GET | `/clinic/appointments?date=` | staff | Day sheet |
| POST | `/clinic/appointments` | staff | Walk-in or manual WhatsApp/phone booking, no fee |

**Queue and live status**

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/doctors/:id/status` | public | Cached 15 s at the edge; the polled endpoint |
| PUT | `/clinic/status` | staff | `{ state, delayMinutes?, message? }`; triggers alerts |
| POST | `/clinic/queue/check-in` | staff | `{ appointmentId, visitCode }` or walk-in; assigns token, marks visit verified |
| POST | `/clinic/queue/next` | staff | Completes current, calls next token |
| POST | `/clinic/queue/:appointmentId/no-show` | staff | Skips a token |
| GET | `/appointments/:id/position` | patient | `{ tokensAhead, estimatedWaitMinutes, doctorState }` |

**Reviews**

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/reviews/eligibility` | patient | Appointments that can be reviewed now and when the rest unlock |
| POST | `/reviews` | patient | `{ appointmentId, ratings, wouldRecommend, visitReason, text? }` |
| GET | `/doctors/:id/reviews?sort=recent` | public | Published only |
| POST | `/reviews/:id/reply` | doctor | One reply, editable for 48 h |
| POST | `/reviews/:id/appeal` | doctor, patient | Reason required; one open appeal per review |
| POST | `/reviews/:id/report` | any logged-in | Abuse report from the public |
| GET | `/admin/reviews/queue` | admin | Held, flagged and appealed reviews |
| POST | `/admin/reviews/:id/decision` | admin | `publish`, `hide`, `remove`, with reason; written to audit log |

**Payments**

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/payments/verify` | patient | Client-side signature check after Checkout closes |
| POST | `/webhooks/razorpay` | Razorpay | Source of truth; signature verified with webhook secret |
| POST | `/admin/payments/:id/refund` | admin | Manual refund |

**Notifications**

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/webhooks/whatsapp` | BSP | Delivery receipts and inbound replies ("CANCEL", "STATUS") |
| POST | `/me/push-subscriptions` | any | Stores a Web Push subscription from the PWA |
| GET | `/admin/notifications?status=failed` | admin | Debug failed sends |

## 5. Review and trust system

A review can only exist if a real visit was verified at the clinic by a code only the patient's phone received, and nothing a doctor pays for can change which reviews show or how they count. Those two rules drive every mechanic below.

### 5.1 Verified visit

1. When a booking is confirmed, the API generates a 4-digit **visit code**, stores only its hash on the appointment, and sends it to the patient on WhatsApp and in the app.
2. At the front desk, staff tap **Check in** and type the code the patient reads out. Correct code sets `visitVerifiedAt` and assigns a queue token. Five wrong attempts lock the code for 15 minutes.
3. **Walk-ins**: staff enter the patient's phone number; the API sends a fresh OTP to that phone over WhatsApp; the patient reads it out. Same result, same proof.
4. A visit counts as reviewable when it is verified **and** either staff mark it completed or the clinic day ends. The end-of-day rule matters: a clinic cannot block a bad review by never pressing "complete".

Why a code and not "staff mark visited": the clinic controls staff accounts, so anything staff can do alone can be faked. The code proves the patient's own phone was involved at the clinic.

Remaining hole: a clinic can register phones it controls as walk-ins. That is covered by fraud signals in 5.5 (new phones first seen at this clinic, shared devices, bursts).

### 5.2 Cool-down and review window

- The review form unlocks **24 hours after** the consult ends (or after the clinic day ends if no end time). This takes the review out of the clinic, where staff could stand over the patient, and out of the heat of a long wait.
- The window stays open for **30 days**. A WhatsApp nudge goes out at unlock and once more on day 5, then never again.
- After submission the review sits in `pending_checks` while the fraud scorer runs (seconds, inline), then moves to `published` or `held_for_review`.
- The patient may edit their review once within 7 days, and once more after the doctor replies.

### 5.3 One review per verified visit

- Enforced by a unique index on `reviews.appointmentId`, not by application code alone.
- A patient who visits the same doctor several times (follow-ups) can review each visit, but only their **most recent** published review counts in the doctor's rating summary. Older ones stay visible, marked as earlier visits. This stops one loyal or angry patient from dominating a small doctor's score.

### 5.4 What a review contains, and how scores are shown

Five dimensions rated 1 to 5: **wait time vs. promised**, **explanation and clarity**, **behaviour and respect**, **clinic cleanliness and facilities**, **value for money**. Plus a required **would you recommend (yes / no / unsure)**, a required visit reason from a fixed list, optional text (20 to 1000 characters), and optional "how long did you wait".

The profile never shows a single star number. It shows the five dimension bars, "% would recommend", the number of verified visits reviewed, and the most recent reviews first. Each dimension score is a Bayesian average so a doctor with three reviews is not shown at 5.0:

```latex
score = (C \cdot m + \sum r_i w_i) / (C + \sum w_i)
```

with m = the city-wide mean for that dimension, C = 10, and w\_i = a recency weight that halves every 12 months. Doctors with fewer than 5 counted reviews show "New on Doqto" instead of scores.

### 5.5 Fraud and abuse detection (rule-based, Phase 1)

No ML. A scorer runs on every submission and again nightly over the last 30 days, adding points per signal:

| Signal | Points | Catches |
| --- | --- | --- |
| Reviewer phone first seen as a walk-in at this same clinic | 20 | Clinic-created fake patients |
| Reviewer account under 7 days old at visit time | 15 | Throwaway accounts |
| Same device fingerprint used by another reviewer of this doctor | 30 | One person, many phones |
| Same IP /24 as 2+ other reviews of this doctor within 24 h | 15 | Review parties |
| Doctor gets over 3x their 30-day daily average reviews within 48 h | 20 (each review in the burst) | Campaigns, positive or negative |
| Text trigram similarity above 0.7 with another review of this doctor | 25 | Copy-paste templates |
| All five dimensions identical at 5 or 1, with text under 40 characters | 10 | Low-effort ratings |
| Reviewer has reviewed 3+ doctors in the same specialty and city, all at 1 | 20 | Competitor bombing |

Decision bands:

- **Under 40**: published at `publishAt`.
- **40 to 69**: published, but weight 0 in the rating summary until an admin clears it. Readers see it; it cannot move the score.
- **70 and over**: `held_for_review`, not visible, reviewer told it is being checked.

**Clusters**: the nightly job links reviews that share a device fingerprint, IP /24 within 24 h, or similar text (union-find over those edges). Any cluster of 3+ reviews on one doctor is held as a group and lands in the admin queue as one item. If an admin confirms the clinic organised it, those reviews are removed and the profile shows "Unusual review activity was removed" for 90 days.

Device fingerprint = hash of (install id kept in the PWA's storage, user agent family, IP /24). Only hashes are stored. Trigram similarity is computed in memory against that doctor's last 200 reviews, which is cheap at this scale.

### 5.6 Doctor right of reply

- One public reply per review, up to 1000 characters, editable for 48 hours. The patient gets a WhatsApp alert and can update their review once in response.
- Replies are blocked if they contain phone numbers, the patient's name, or any diagnosis or treatment details (keyword list plus a warning before posting). A doctor disclosing a patient's medical details in public is an ethics and DPDP problem, and the reply form says so.
- Replying never changes a review's visibility or weight.

### 5.7 Appeals

- **Doctor appeals** use a fixed reason list: not a real visit, contains personal or medical details, abusive or threatening language, about a different doctor, conflict of interest (competitor, ex-employee). "I disagree with the rating" is not a reason.
- During an appeal the review **stays visible**, except for personal-details and abuse appeals, which hide it at once pending a decision.
- **Patient appeals**: if a review was held or removed, the patient can appeal once with an explanation.
- One appeal per party per review. Admin decides within 7 days, picks a reason code, writes a note both sides see. Every decision goes to `auditLogs`.
- **Transparency page** (public, monthly): reviews submitted, published, held, removed by reason, appeals filed and upheld, by party. This is the product's public proof that reviews are not for sale.

### 5.8 Making paid ranking structurally impossible

- The `reviews` and `ranking` code never imports the `payments` or any future `subscriptions` module. Enforced with an ESLint import-boundary rule in CI, so a shortcut breaks the build.
- Search ranking is one pure function with an explicit input list: distance, specialty match, availability in the next 48 h, Bayesian score, number of counted reviews. No plan or payment field exists in its input type.
- Doctors cannot hide, pin, reorder or choose featured reviews. There is no API for it.
- If a paid doctor tier ever ships, it may add profile features or console tools only. Any sponsored placement must be a separately labelled block, never mixed into organic results.
- Phase 2, once there is more than one admin: removing a published negative review needs two admins to agree.

## 6. Booking, live status and queue

Decision: **no websockets in Phase 1.** Patients looking at the screen get 30-second polling; patients not looking get WhatsApp (and Web Push where installed). Doctor status changes a few times a day and the queue moves every 5 to 15 minutes, so 30 seconds of lag is invisible to the user, while websockets on flaky 3G and PWAs that Android kills in the background would cost real debugging time.

### 6.1 Booking a slot

1. Patient opens a doctor, app calls `GET /doctors/:id/slots?date=`. The API expands the schedule template for that date, removes leave and exceptions, removes slots held or booked, and holds back `walkInShare` of capacity.
2. Patient picks a slot, `POST /appointments`. The API inserts the appointment as `pending_payment` with a 10-minute hold. A **unique partial index** on `{doctorId, slotStart}` (only for active statuses) makes double-booking impossible even with two requests in the same millisecond; the loser gets `409 Slot taken`. Phase 1 keeps `capacityPerSlot = 1`; group slots can come later with a counter document.
3. API creates a Razorpay order and returns it. Checkout opens (section 8).
4. Razorpay webhook marks the payment `paid`; the appointment becomes `confirmed`; the visit code is generated; a WhatsApp confirmation goes out with date, time, clinic map link, visit code and a live-status link.
5. A job every minute cancels `pending_payment` holds older than 10 minutes, which frees the slot.
6. Reminders: evening before (if booked earlier than that) and 2 hours before, each with the live-status link.

Manual first weeks: bookings that arrive over WhatsApp or phone are entered in the clinic console (`POST /clinic/appointments`, source `whatsapp_manual` or `phone_manual`, no fee). Same collection, same queue, so nothing changes in the data when patients start booking themselves.

### 6.2 Queue rules (booked + walk-in)

Tier-2/3 clinics run mostly on walk-ins, so the queue must mix both fairly.

- Every checked-in patient gets a **queue token** and an **effective time**.
- Booked patient who checks in no later than 10 minutes after their slot: effective time = slot start.
- Booked patient who arrives later, or any walk-in: effective time = check-in time.
- The queue is sorted by effective time. Staff can move someone (emergency, elderly); every move is logged in `statusHistory`.
- `POST /clinic/queue/next` completes the current patient and calls the next. Consult duration is recorded from these taps.

### 6.3 Wait-time estimate

- `avgConsultMinutes` = exponentially weighted average of the doctor's last consult durations (weight 0.2 on the newest), starting at 8 minutes for a new doctor and ignoring durations under 1 or over 45 minutes.
- Estimated wait = tokens ahead × average, plus time until the doctor arrives if state is `not_started` or `running_late` (from the ETA).
- Shown as a range, about 20% either side ("about 25 to 35 minutes"), because a precise number that turns out wrong destroys trust faster than an honest range.

### 6.4 Doctor status update

1. Staff (or doctor) tap a big button in the clinic console: In clinic, Running late (+15 / +30 / +60 or custom), On break, Done for today, On leave.
2. `PUT /clinic/status` updates the day's `doctorStatus` document, appends a `statusEvents` row, and recomputes `queueLength` and `currentToken`.
3. The notification rules run in the same request and write to the `notifications` outbox:

| Change | Who is alerted | Channel |
| --- | --- | --- |
| Running late by 20+ minutes | Today's confirmed patients not yet checked in | WhatsApp |
| Delay grows by another 15+ minutes | Same group | WhatsApp |
| On leave / done early with bookings left | Every remaining booking; auto-cancel and refund fee, rebook link | WhatsApp |
| Patient is 3 tokens away | That patient | Web Push if subscribed, else WhatsApp |

Each alert has a `dedupeKey` (for example `delay:<appointmentId>:30`) with a unique index, so a staff member tapping twice never sends two messages. Cap: 4 WhatsApp alerts per patient per day.

### 6.5 How updates reach the screen

- Patient status and queue pages poll every **30 seconds** using TanStack Query `refetchInterval`, paused when the tab is hidden, refreshed immediately when it comes back.
- Clinic console polls every **15 seconds** (it is the operator's screen).
- `GET /doctors/:id/status` returns `Cache-Control: public, s-maxage=15`. Cloudflare (free plan) in front of the API serves it, so 1,000 patients watching one doctor still cause about one origin request every 15 seconds.
- Revisit when a clinic wants a waiting-room TV display or concurrent viewers pass a few thousand: add **Server-Sent Events** on the same endpoint (one-way, plain HTTP, simpler than websockets).

## 7. WhatsApp Business API

Use one BSP on the official WhatsApp Cloud API (AiSensy or Interakt; both onboard Indian startups quickly and have low or zero platform fees on starter plans). Pick whichever approves the Doqto business number first. The code talks to it through one interface, so switching later is a one-file change.

**What it is used for**

| Use | Template category | Trigger |
| --- | --- | --- |
| Login OTP | Authentication | `/auth/otp/request` |
| Walk-in visit verification OTP | Authentication | Staff check-in of a walk-in |
| Booking confirmation + visit code | Utility | Payment webhook |
| Reminder (evening before, 2 h before) | Utility | Scheduled job |
| Doctor running late / on leave / cancelled | Utility | Status update |
| Your turn is near | Utility | Queue advance (only if no Web Push) |
| Review window open (unlock + day 5) | Utility | Scheduled job |
| Doctor replied to your review | Utility | Reply posted |

No marketing templates in Phase 1. They cost more per message and hurt the number's quality rating.

**Lean implementation**

- `NotificationsModule` exposes `notify(userId, templateKey, params, dedupeKey)`. It writes to the `notifications` outbox and returns. Business code never calls the BSP directly.
- A job every 10 seconds sends queued rows through a `WhatsAppProvider` interface (`sendTemplate`, `parseWebhook`) with one implementation per BSP. Retries 3 times with backoff; on final failure for OTPs it falls back to SMS through MSG91 (DLT-registered templates).
- `/webhooks/whatsapp` records delivered/read/failed against `providerMessageId` and handles inbound keywords: **STATUS** replies with today's doctor status, **CANCEL** starts a cancel confirmation. Anything else gets an auto-reply with the clinic phone number. No chatbot.
- Templates live in code (`templates.ts`) with Hindi and English variants and are submitted for approval in one batch before launch. Approval can take a day or more and rejection is common, so submit them in week 1 of the build, not at the end.
- Opt-in is collected at signup (checkbox, on by default with clear text) and stored on the user; `whatsappOptIn: false` routes everything except OTPs to SMS or push.
- Cost: Meta charges per delivered template message by category; utility and authentication messages to Indian numbers are roughly ₹0.12 to ₹0.15 each plus BSP markup (verify current rates at signup). At about 6 messages per booking, that is under ₹1 per booking, inside the ₹10 to 20 fee. Messages sent as a reply within 24 hours of the patient writing in are cheaper or free, which is another reason to support the STATUS keyword.

## 8. Payments (Razorpay booking fee)

Razorpay Standard Checkout with the Orders API, auto-capture on, UPI shown first. The ₹10 to 20 fee is Doqto's revenue, so it settles to Doqto's account only; no split payments (Razorpay Route) are needed in Phase 1, which avoids marketplace KYC for every doctor.

**Flow**

1. `POST /appointments` creates the appointment and calls Razorpay `orders.create({ amount, currency: 'INR', receipt: appointmentId })`. A `payments` row is saved as `created`.
2. The PWA opens Checkout with the order id. On Android, UPI intent hands off to GPay / PhonePe / Paytm and back.
3. Checkout's success handler posts `{ order_id, payment_id, signature }` to `/payments/verify`. The API checks the HMAC-SHA256 signature with the key secret and shows "Booking confirmed" immediately.
4. **The webhook is the source of truth.** `/webhooks/razorpay` verifies the webhook signature, handles `payment.captured`, `payment.failed`, `refund.processed`, and is idempotent on `gatewayPaymentId` (Razorpay retries webhooks). Only the webhook moves an appointment to `confirmed` and sends WhatsApp, so a patient who closes the app mid-payment still gets booked.
5. Late payment after the 10-minute hold expired: if the slot is still free, confirm it anyway; if not, refund automatically and send a WhatsApp apology with the next free slots.
6. A nightly job fetches the last 48 hours of orders from Razorpay and fixes any row the webhook missed.

**Refund rules (automatic unless noted)**

| Situation | Refund |
| --- | --- |
| Clinic cancels, doctor on leave, or done early with you still booked | Full, automatic |
| Doctor runs 60+ minutes late and you cancel | Full, automatic |
| You cancel 2+ hours before the slot | Full, automatic |
| You cancel under 2 hours before, or no-show | None |
| Disputes | Admin refund from the panel |

**Before going live**: Razorpay KYC needs a business identity (sole proprietorship is fine) and a live website with Terms, Privacy, Refund and Contact pages, so build those static pages early. Gateway fees are about 2% of a ₹15 fee (about ₹0.30); confirm current pricing at signup. Ask a CA about GST registration once revenue nears the threshold.

## 9. Mobile: PWA now, native Android later

### 9.1 Phase 1 PWA

- **Install**: web manifest (name, Hindi + English short name, maskable icons, `display: standalone`, theme colour). Show the install prompt after a patient's first successful booking, not on first visit.
- **Service worker** (Serwist): precache the app shell; doctor profile pages stale-while-revalidate; API calls network-first with no caching of personal data; a simple offline page that still shows the patient's next appointment and visit code from local storage.
- **Push**: Web Push with VAPID keys, stored per device in `/me/push-subscriptions`. Works on Android Chrome; on iPhone only after the user installs to the home screen. WhatsApp remains the guaranteed channel.
- **Low-end Android budget**: under 200 KB of JavaScript on first load for doctor and booking pages, `next/image` for every photo, a subset Devanagari font, test on a ₹8,000 phone on throttled 3G before launch.
- **Play Store presence for almost nothing**: wrap the same PWA as a Trusted Web Activity with Bubblewrap (one-time Google Play developer fee). Patients who only trust "apps from Play Store" can install it, and nothing new is built.

### 9.2 Rules now that make Phase 2 cheap

- All business logic lives in NestJS. Next.js renders and calls the API; no business rules in Next.js server actions or API routes.
- API is versioned (`/api/v1`) and documented with Swagger from the start.
- Auth works both ways: the web gets the tokens in httpOnly cookies on the shared `doqto.in` parent domain; mobile sends `Authorization: Bearer`. The API accepts either.
- Notifications go through a provider interface, so adding Android push is a new provider, not a rewrite.
- Doctor URLs are stable (`doqto.in/d/<slug>`) so Android App Links can open them in the native app later.

### 9.3 Phase 2 native Android (Kotlin)

| Area | Reused as is | Rebuilt or added |
| --- | --- | --- |
| Backend, database, jobs | All of it | Nothing |
| API contract | Swagger spec | Kotlin Retrofit client generated with OpenAPI Generator |
| Auth | OTP + JWT flow | Token storage in EncryptedSharedPreferences / DataStore; SMS Retriever API for OTP autofill |
| UI | Design system, copy, flows | Jetpack Compose screens |
| Push | Notification rules and outbox | FCM provider in `NotificationsModule`; FCM token endpoint |
| Payments | Orders API, webhook, refunds | Razorpay Android SDK in place of web Checkout |
| Offline | Same caching ideas | Room cache for upcoming appointments |
| Clinic console | Stays on PWA | Native only if clinics ask for it |

Trigger for Phase 2: repeat patients asking for a "real app", Web Push opt-in clearly failing, or Play Store reviews of the TWA asking for features the web cannot do.

## 10. Deployment and infra

Recommendation: **Vercel** for Next.js, **Render** for the NestJS API (one always-on Docker web service), **MongoDB Atlas** in the Mumbai region, **Cloudflare** for DNS, caching and file storage. Launch cost is about ₹2,500 to 4,000 a month, inside the ₹2,500 to 10,000 budget with room to scale. Prices below are approximate from memory; confirm at signup.

| Item | Build phase | At launch | Notes |
| --- | --- | --- | --- |
| Vercel (web + PWA) | Hobby, free | Pro, about $20 (₹1,700) | Hobby terms exclude commercial use, so upgrade before taking payments |
| Render (API) | Free instance for staging | Starter, about $7 (₹600) | Free instances sleep; webhooks and OTPs cannot wait for a cold start, so production must be paid |
| MongoDB Atlas | M0 free | M0, then Flex (about $8 to 30) | Pick AWS Mumbai (ap-south-1). M0 has no backups, so run a nightly `mongodump` to R2 |
| Cloudflare DNS + proxy + cache | Free | Free | Caches the public status endpoint (section 6.5) |
| Cloudflare R2 (photos, credential scans) | Free tier | Free tier | Credential scans in a private bucket, served by signed URL |
| Sentry, UptimeRobot | Free | Free | Alerts to the founder's phone |
| Domains (doqto.in, .com, .care) | — | About ₹2,000 to 4,000 a year total | Buy .in and .com before public launch |
| WhatsApp, SMS, Razorpay | — | Per use | Covered by the booking fee (sections 7, 8) |

**Environments**

- **Local**: `docker compose` runs MongoDB only; API and web run with hot reload. Use BSP and Razorpay test modes.
- **Staging**: Render free instance + a second free Atlas cluster + Vercel preview deployments. Every pull request gets a preview URL.
- **Production**: `doqto.in` on Vercel, `api.doqto.in` on Render behind Cloudflare.

**Pipeline**: GitHub Actions runs typecheck, lint (including the import-boundary rule from 5.8) and tests on each push. Render and Vercel auto-deploy from `main`. Secrets live only in platform environment variables. Run Mongo index creation as a startup migration step so indexes, especially the unique ones that enforce business rules, always exist.

**When to move up**: API p95 latency over 500 ms or memory pressure on Render Starter → Render Standard. Atlas Flex storage or throughput limits → M10 (about $57). Both fit the ₹10,000 ceiling.

## 11. Security and compliance

**Do not build patient health records in Phase 1.** The QR-linked medical history module waits for legal review under India's Digital Personal Data Protection Act, 2023 and its rules. Until that review is done, Doqto stores no diagnosis, prescription, report or treatment data, and the review form's "visit reason" stays a short, non-clinical list (for example "general check-up", "follow-up", "child's visit"). Even so, phone numbers, names and the fact that someone visited a specific doctor are personal data under DPDP, so the basics below still apply.

**Authentication and access**

- Phone OTP: 6 digits, hashed, 5-minute expiry via TTL index, 5 verify attempts, 3 requests per 10 minutes per phone and per IP.
- JWT access tokens of 15 minutes; refresh tokens of 30 days stored hashed and rotated on every use, revocable on logout.
- Role guard on every non-public route; staff can only touch clinics in their `staffUserIds`; doctors only their own profile. Write an e2e test per role for each sensitive endpoint.
- Admin accounts require OTP on every login, and every admin action is written to `auditLogs`.

**Data protection**

- TLS everywhere (Vercel, Render, Cloudflare provide it). Atlas encryption at rest, IP access list limited to Render's outbound IPs, separate database users per environment.
- Credential scans in a private R2 bucket, served only to admins through signed URLs that expire in 5 minutes.
- Visit codes, OTPs and refresh tokens stored only as hashes. Device fingerprints stored only as hashes.
- Public review pages show the reviewer's first name and last initial only, never the phone number.
- No patient data in logs: a Pino redaction list covers `phone`, `otp`, `visitCode`, `token`. Sentry scrubbing on the same fields.
- Helmet headers, CORS limited to `doqto.in` origins, `@nestjs/throttler` rate limits, `class-validator` whitelist on every DTO (rejects unknown fields, which blocks Mongo operator injection).
- Webhooks: verify Razorpay and BSP signatures before reading the body; reject unsigned calls.

**DPDP basics to have at launch** (confirm with the lawyer doing the records review)

- Clear consent text at signup for WhatsApp messages and for publishing reviews.
- Privacy policy naming what is collected and why; a contact for grievances.
- Account deletion in the app: deletes the user's personal data and anonymises their reviews ("Verified patient") rather than deleting them, so a doctor's score cannot be gamed by mass deletions. Have the lawyer confirm this approach.
- Data stored in India (Atlas Mumbai). Render runs in Singapore, so the API processes data outside India; note it in the privacy policy and revisit if the rules require local processing.
- Retention: OTPs auto-expire; notification payloads purged after 90 days; status events kept for analytics without patient identifiers.

## 12. Build sequence for a solo developer

Build the clinic side before the patient side. A clinic using the console every day produces real visits, real status data and verified visits, and those are what make booking and reviews worth anything. Week counts are rough guides for one full-time developer.

1. **Start the slow paperwork on day 1** (runs in parallel with everything below): WhatsApp BSP account and business number verification, submit all message templates, Razorpay KYC, MSG91 DLT registration, buy domains. Each can take days to weeks of waiting.
2. **Foundations (week 1)**: pnpm monorepo, NestJS skeleton with config, logging and Swagger, Atlas cluster, phone OTP login (SMS first, WhatsApp swapped in when approved), Next.js shell, staging deploy on Render + Vercel, CI.
3. **Doctor profiles and search (weeks 2 to 3)**: doctor onboarding form, credential upload, admin verify screen, clinic with map location, public SEO doctor pages, search by city, specialty and distance. Outcome: onboard the first pilot doctors by hand; patients still book over WhatsApp or phone.
4. **Clinic console (weeks 4 to 5)**: weekly schedule, day sheet, manual and walk-in entries, check-in, queue token, "next patient", status buttons. Outcome: 2 or 3 pilot clinics run their day on it; consult durations start feeding wait estimates.
5. **Live status for patients (week 6)**: public status and queue page with 30-second polling, Cloudflare caching, WhatsApp delay and leave alerts through the outbox. Outcome: the first feature patients feel, before any payment exists.
6. **Online booking and payments (weeks 7 to 8)**: slot computation, holds, unique-index guard, Razorpay order + Checkout + webhook + refunds, confirmations with visit code, reminders, cancellation.
7. **Reviews (weeks 9 to 10)**: verified-visit check at check-in (already in step 4, now enforced), eligibility and cool-down, multi-dimension form, Bayesian summary job, doctor reply, on-submit fraud scoring, admin queue, appeals. Built now because by this point real verified visits exist to review.
8. **PWA polish (week 11)**: manifest and install prompt, service worker, Web Push, offline appointment card, performance pass on a low-end phone, optional Play Store TWA.
9. **Launch hardening (week 12)**: nightly backups to R2 with a tested restore, nightly fraud cluster job, transparency page, Terms / Privacy / Refund pages, uptime alerts, a load test on the status endpoint.

If time runs short, cut in this order: the TWA, Web Push (WhatsApp covers it), the nightly cluster job (keep on-submit scoring), the transparency page. Never cut the unique indexes, webhook signature checks, the visit-code check, or backups.

Open questions for the founder: which BSP approves first; whether pilot clinics want Hindi-only console labels; the exact booking fee per city (₹10 or ₹20).

## 13. Demo mode (before WhatsApp API, SMS and Razorpay are registered)

Decision (Raunak, 2026-10-09): until the business paperwork is done, outreach to doctors happens by hand from the personal WhatsApp Business App, and the product runs in a **demo mode** with a fixed OTP, so doctors and patients can try signup, booking and queue flows and give feedback. The real WhatsApp API, SMS and Razorpay are swapped in at launch with configuration only.

**What demo mode changes**

| Area | Demo mode | Launch |
| --- | --- | --- |
| Login OTP | Fixed code `123456` accepted for any phone number | Real OTP via WhatsApp BSP, SMS fallback |
| Visit code / walk-in OTP | Fixed code `123456` also accepted at check-in | Real visit code and WhatsApp OTP |
| WhatsApp / SMS messages | Not sent. Written to the outbox as `sent` and shown in an in-app **Demo inbox** screen ("this is the WhatsApp message the patient would get") | Sent through the BSP |
| Booking fee | Mock payment screen with a "Pay ₹15 (demo)" button, no money moves | Razorpay Checkout |
| Data | Seeded demo doctors, clinics and appointments, separate database | Real data |

**How it is built (about a day of work, and it replaces the provider work in build step 2)**

- Each external service already sits behind a provider interface (`OtpProvider`, `WhatsAppProvider`, `PaymentProvider`). Add a `Demo*` implementation of each and pick the implementation with one env var, `PROVIDER_MODE=demo|live`. No business code changes.
- `DemoOtpProvider.verify()` returns true for the fixed code. It still creates the `otps` row and runs the normal attempt limits, so the flow is identical to live.
- The Demo inbox is a read-only page that lists the user's `notifications` rows. It doubles as a way to show doctors exactly what patients will receive.
- `PaymentProvider` demo creates a payment with `gateway: 'demo'` and marks it paid when the demo button is pressed; the same code path confirms the appointment and generates the visit code. Alternatively use Razorpay test mode (test keys need a Razorpay account but not KYC) if you want the real Checkout UI in demos.
- `scripts/seed-demo.ts` creates 3 clinics, 5 doctors with schedules, sample appointments and a few reviews.

**Safety rules (a fixed OTP means anyone can log in as anyone, so isolate it)**

1. Demo mode runs only on a **separate deployment** (`demo.doqto.in` on Render and Vercel) with its **own database** (`doqto_demo`). Never point it at the production database.
2. The API refuses to start if `PROVIDER_MODE=demo` and either `NODE_ENV=production` with a production database name, or the database name does not start with `doqto_demo`. A second check fails startup if `PROVIDER_MODE=live` and any `Demo*` provider is configured.
3. A visible banner on every screen: "Demo: no real messages or payments. Do not enter real patient details."
4. The fixed OTP cannot be enabled by a request header or query flag. It exists only as a startup configuration, so there is nothing for an attacker to toggle at runtime.
5. Demo users are flagged `isDemo: true`; a launch script wipes the demo database before go-live.
6. Rate limits and the cost of the demo deployment stay on (free tiers are fine).

**WhatsApp number note.** Keep the personal WhatsApp Business App for manual outreach. The WhatsApp Cloud API normally needs its own business number (a number used in the Business App can't also be registered for the API unless Meta's coexistence option applies; check the current rules at registration, and prefer a fresh number for the API).

**Moving from demo to live (checklist)**

- [ ] WhatsApp BSP account approved, message templates approved
- [ ] MSG91 DLT registration done (SMS fallback)
- [ ] Razorpay KYC complete, live keys in the production environment
- [ ] Production deployment has `PROVIDER_MODE=live` and the production database
- [ ] Demo database and demo deployment kept for sales demos, still isolated
