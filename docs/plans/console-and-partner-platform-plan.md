# Console and partner platform plan (next phase)

**Date:** 2026-10-25. **Status:** proposal for Raunak's review. No code has changed.
**Goal:** doctors run their practice from their own web app (profile, appointments, staff, earnings), Doqto staff run the marketplace from the admin area of the same console, and pharmacies and labs can join later on the same foundation.
**Progress (2026-10-26):** phase 2A, step 1 is done: `packages/ui`, `packages/i18n` and `packages/api-client` are extracted and the patient app runs on them unchanged; `apps/console` (port 3010) and `apps/admin` (port 3020) exist as skeletons with the sidebar shell, sign-in screen (disabled until phase 2B), Hindi and English, and placeholder screens. `packages/config` was left out on purpose: the root `tsconfig.base.json` and `eslint.config.mjs` already serve every app. Ports 3010 and 3020 replace 3001 and 3002, which clash with other local projects. Next in 2A: move the existing `/clinic` and `/admin` screens out of `apps/web`, add the cross-app links and redirects. See the READMEs in each app and package.
**Starting point:** one Nest API (`apps/api`), one Next.js app (`apps/web`) that also holds `/clinic` and `/admin`, and a shared contract (`packages/shared`). The patient app is done (see `patient-completion-plan.md`).

---

## 1. Review of the "Separate doctor and ops console" plan

The plan's direction is right: a second Next.js app on port 3001, the same API, the same `@doqto/shared` contract, and a first change that only moves code ("no new product features"). Keep those. The points below are what I would change for the business you described (a CMS for doctors, staff with limited access, a real admin console, pharmacies and labs later).

| # | In the plan | Change | Why |
| --- | --- | --- | --- |
| 1 | **Copy** the UI kit, shell, login, i18n and API client into `apps/console`. Extract nothing. | **Extract shared packages now** (`packages/ui`, `packages/i18n`, `packages/api-client`, `packages/config`). Do a one-time import rewrite in `apps/web`. | You will have three or four front ends (patient, console, admin, later partners). A copy is a fork: every button fix, every translation and every API-client fix has to be made 3 to 4 times, and they drift. The rewrite cost is paid once, today, while there are only two apps. |
| 2 | One console app for doctors, clinic staff **and** admin. | **One console app (`apps/console`) for doctors, clinics, labs, pharmacies, their staff and the Doqto team; patients stay separate (`apps/web`).** The features differ by role: providers get their workspaces, the team gets `/admin`. | You asked for patients separate and everyone else in one app with different features per person. (A separate `apps/admin` was built on 2026-11-09 by misreading that and merged back the same day.) Access is decided by the API on every request (the `admin` role for `/platform/*`), not by which screen is shown. Hardening still planned for the team: an authenticator code at sign-in, shorter sessions, and optionally an IP allow-list on `/admin`. |
| 3 | Access = a global `role` on the user plus `clinicIds`, and patients and providers in the same `users` collection. | **Separate `patients` collection; one `accounts` collection for all provider-side logins; `organizations`, `units` and `memberships`** (section 4). | "A doctor can let staff accept appointments but not see earnings" cannot be expressed with `roles: ['clinic_staff']`. It also does not scale to pharmacies and labs. |
| 4 | Cookies shared on localhost, host-only in production. | Keep host-only cookies, **and add a token audience** (`patient`, `console`, `admin`) so a patient session can never call a console route, even if cookies leak across subdomains. | Defence in depth. Cheap to add now, painful later. |
| 5 | "Track his records" is not mentioned. | **Split into practice records (now) and clinical records (blocked, needs legal sign-off).** See section 3. | ADR 0007 says Doqto stores no diagnosis, prescription or report data in Phase 1. Doctor-side clinical records, pharmacy prescriptions and lab reports are all health data under DPDP. |
| 6 | Queue, schedule, admin reviews and admin notifications stay "coming soon". | Build them in the order in section 7. | They are the core of the doctor and admin experience. |
| 7 | No mention of money. | Add **earnings, settlements and invoices** (section 6). | Doctors will judge the console on whether they get paid and can see why. |
| 8 | Amend ADR 0001 to "two Next apps". | Amend it to "three Next apps (web, console, admin), one API, shared packages". Add ADR 0009 for clinical data (gate in section 3) and ADR 0010 for permissions. | Keeps the decisions on record. |

**What stays exactly as in the plan:** step 1 is a mechanical move with no feature changes; the old `/clinic/*` and `/admin/*` URLs on the patient site redirect to the new hosts; the `/api/v1` rewrite and `CORS_ORIGINS` additions; post-login routing by account type; the checks (typecheck, unit tests, browser run).

---

## 2. Target architecture

```
apps/
  web/        patient site                    www.doqto.in        :3000
  console/    doctors, staff, later partners  console.doqto.in    :3010
  api/        one NestJS API (modular monolith, unchanged principle)   :4000
packages/
  shared/     contract: Zod schemas, endpoints, rules (exists)
  ui/         design system: Button, Field, Sheet, tables, charts, shell pieces
  i18n/       message catalogs and the provider
  api-client/ typed fetch client, session, query helpers
  config/     tsconfig, eslint, tailwind preset
```

- **One API, one database, one deploy** (ADR 0001 still holds). The API groups routes by audience: `/api/v1/...` (patient, as today), `/api/v1/console/...` and `/api/v1/admin/...`. Today's `/clinic/*`, `/doctor/*` and `/clinics/*` routes keep working as aliases until the console has moved over.
- **One backend, no exceptions.** There is a single NestJS API (`apps/api`). The three Next apps are front ends only: no route handlers, no server actions, no database access, no per-audience backend or BFF. New server work (accounts, memberships, requests, admin dashboards, partner orders) is added as modules inside `apps/api`. A tooling test enforces it.
- **Each app has its own** host, cookies, login screen, route guard and navigation. They share code, not sessions.
- **Console is one app with feature areas**, switched by the type of workspace the user is in (clinic now; pharmacy and lab later). A user who belongs to several workspaces picks one from a switcher. If the pharmacy and lab teams ever diverge a lot, split them out then; the shared packages make that cheap.
- **Deploy:** three Vercel (or similar) projects and one API service. Same-origin `/api/v1` rewrite per app, as in the plan, or one API host with CORS for the three origins.

### 2.1 Design direction: same theme, a serious working tool

The console and admin look like Doqto (same brand, same components), but they are built for people who work in them all day, on a desktop or a clinic's reception tablet. They should feel calm, dense and trustworthy, not like a consumer app.

**Same, because it comes from `packages/ui`:**
- Colours and tokens from the patient app: brand greens (`brand-600` `#087a08` / `brand-700` for text and actions on light surfaces, the bright `#13ec13` only as an accent), ink `#13201e`, surface `#f0f4f0`, and the status colours (success, warning, danger).
- Manrope for English and Noto Sans Devanagari for Hindi; the same type scale; the same buttons, fields, sheets, chips, badges, toasts and the English / Hindi switch.
- Same voice: short, plain sentences, no jargon.

**Different, because the job is different:**

| Topic | Patient app | Console and admin |
| --- | --- | --- |
| Layout | Phone first, bottom navigation | **Desktop first**: left sidebar, top bar with workspace switcher and search, content area; collapses to a drawer on tablets and phones |
| Surfaces | Soft raised "neumorphic" cards | **Flat panels with thin borders** for lists, tables and forms; the soft raised style only for sign-in, empty states and a few highlight cards. This matches the earlier UI audit |
| Density | Large touch targets | Compact rows (40 px) and tables, with a "comfortable" switch for tablets; touch targets stay at least 44 px on touch devices |
| Data | Cards | **Data tables**: sort, filter, saved views, column chooser, pagination or infinite scroll, bulk actions, CSV export |
| Navigation | Five tabs | Grouped sidebar by area, breadcrumbs, keyboard shortcuts (`/` search, `g` then `a` for appointments), a command palette later |
| Status | Friendly wording | Clear **status chips** (waiting, confirmed, arrived, no-show) with the same colour meaning everywhere, plus an activity timeline on every record |
| Feedback | Toasts | Toasts for results, **confirm dialogs for anything irreversible** (cancel, refund, remove staff, reject), and an undo where it is safe |
| Charts | None | Simple, accessible charts (bars, lines, one colour family), with a table view of the same numbers |
| Environment cue | None | **Admin has its own top bar colour and an "ADMIN" tag**, and the console shows the workspace name at all times, so nobody acts in the wrong place |
| Print | None | Print-friendly day sheet, earnings statement and invoice |

**Quality bars for both apps:**
- WCAG AA contrast and visible keyboard focus; full keyboard use of tables and dialogs; screen-reader labels on icon buttons and charts.
- English and Hindi everywhere, including dates, currency (₹) and numbers.
- Loading skeletons, empty states with the next step, and clear error pages with a request id for support.
- No clinical or sensitive text in page titles, URLs or analytics events.
- Session timeout warning, and a visible "signed in as" and "sign out" on every page.
- Works on a clinic's mid-range Windows laptop and a 10-inch tablet; no horizontal page scroll at 360 px.

**How it is delivered:** `packages/ui` gets the new pieces the console needs once (app shell with sidebar, data table, filter bar, status chip, timeline, stat card, chart wrapper, permission-aware button), each with a small preview page and tests. Both apps use them, so the look cannot drift.

---

## 3. Product scope and the clinical-data gate

### 3.1 What the doctor console does (CMS)

| Area | Doctor can | Exists today |
| --- | --- | --- |
| Profile | Edit bio, photo, qualifications, languages, fees, clinics, services; upload registration documents; see verification status | Partly (`/doctor/profile`, `registration-document`, `photo`) |
| Schedule | Weekly hours per clinic, slot length, walk-in share, leave and holidays, booking window | Weekly hours (`/doctor/schedules`); no leave or holidays |
| Appointments | See the day sheet, **accept or decline** online bookings, reschedule, mark arrived / no-show / completed, add walk-ins | `confirm`, queue, check-in, walk-in exist in the API; no decline; no UI |
| Live status | Set "running late", "on break", "not in today" | `PUT /clinic/status` exists |
| Reviews | See reviews and ratings, reply (rules in ADR 0008), report abuse | Not in console |
| Staff | Invite staff by phone, choose what each person may do, remove them | `POST/DELETE /clinics/:id/staff` (no permissions) |
| Earnings | Per-day and per-month bookings, fees, refunds, commission, settlements, invoices | None |
| Patients (practice view) | A list of people who booked with them: name, phone, visit count, last visit, no-shows | None |
| Notifications | Bookings, cancellations, new reviews, payout updates (WhatsApp, push, email) | Patient side only |
| Dashboard | Today's queue, bookings this week, no-show rate, rating trend, earnings | None |

### 3.2 Records: two different things

1. **Practice records (build now, non-clinical):** who booked, when, fee, status, visit count, no-shows, notes limited to a fixed non-clinical vocabulary. This is what "track his records" can mean without health data, and it fits ADR 0007.
2. **Clinical records (do not build until legal sign-off):** diagnosis, prescriptions, reports, treatment notes, medical history. This also covers the "upload reports" flow for labs and prescriptions for pharmacies.

**Gate for clinical data (ADR 0009, to be written):**
- A lawyer completes the DPDP review (health data is sensitive; consent, purpose limits, retention, breach duty).
- Patient-granted access: a doctor sees only what the patient shared with that doctor, with expiry.
- Encryption at rest with per-record keys, signed short-lived downloads (already used for patient records), data stored in India.
- Every read of a clinical record is written to the audit log and visible to the patient.
- Retention and deletion rules; patient export and erase.

**Heads-up about the current patient app:** the "Records" feature I built stores the patient's own uploaded files, privately, and Doqto never reads them. That is the minimum-risk version, but it still needs the same legal review before launch.

### 3.3 Pharmacies and labs (later)

Both are **partners** that list things patients can buy or book, then fulfil them.

| | Pharmacy | Lab |
| --- | --- | --- |
| Catalogue | Products, strength, price, stock, images | Tests and packages, price, preparation notes, turnaround time |
| Flow | Order placed → accepted / rejected → packed → dispatched → delivered (or cancelled / returned) | Booking → accepted → sample collected (home or walk-in) → processing → report ready → closed |
| Output | Delivery or pickup | Report upload (PDF) to the patient |
| Regulated by | Drug licence; prescription rules for scheduled drugs; e-pharmacy rules | NABL / state registration; sample handling |
| Verification at onboarding | Drug licence, pharmacist registration, GST | Lab registration, accreditation, GST |
| Health data? | **Yes** when a prescription is uploaded | **Yes** (reports) |

Treat both as **later phases behind the clinical-data gate**. The one decision to make now is the foundation: organizations, units, memberships and permissions (section 4) and a generic orders model, so a pharmacy is "another workspace type" and not a rewrite. Whether Doqto may sell or deliver medicines at all is a regulatory question. Get advice before you build the pharmacy side.

---

## 4. Identity, organizations and permissions

*Wording: in the console, a "workspace" is the organization the signed-in person has chosen in the switcher; units (clinic, lab, pharmacy) are filtered inside it.*

### 4.1 Data model: who is stored where

Patients and providers are different kinds of users, so they live in **different collections**, with different sign-in, different sessions and different rules. Everyone on the provider side (doctors, clinic and lab and pharmacy staff, Doqto admins) is one kind of account, kept in **one collection**. The businesses themselves (clinics, labs, pharmacies) are kept in **one organizations collection**, and people are linked to them by memberships.

```
patients          people who book and buy                          (own collection, phone OTP)
accounts          every provider-side login in one place           (doctors, clinic/lab/pharmacy staff, admins)
organizations     the business: a clinic group, a lab, a pharmacy  (legal name, GST, owner, payout account, verification)
units             a place that serves patients: clinic, lab or pharmacy, with address, hours, catalogue
memberships       account ↔ organization (optionally limited to some units), role + permissions
practitioners     the doctor's professional profile (registration, specialties), linked to an account
```

```ts
// patients: separate collection, never mixed with provider accounts
{ _id, phone, name, language, whatsappOptIn, status, pushSubscriptions[], createdAt }

// accounts: one collection for every provider-side login
{ _id, phone?, email?, passwordHash, kind: 'practitioner' | 'staff' | 'platform',
  platformRole?: 'super_admin' | 'verifier' | 'support' | 'finance' | 'moderator' | 'analyst',
  totp?: {...}, status: 'active' | 'locked' | 'disabled', contactVerifiedAt, lastLoginAt }
//   phone and email are each unique inside `accounts` (sparse). A doctor and a patient may use the
//   same phone number: they are two separate identities in two collections.

// organizations: the business that is verified, paid and legally responsible
{ _id, name, legalName, gstin?, ownerAccountId, payoutAccountId?, groupName?,
  status: 'draft' | 'pending_verification' | 'active' | 'suspended' }

// units: a place patients go to or order from; belongs to exactly one organization
{ _id, organizationId, type: 'clinic' | 'lab' | 'pharmacy', name, address, location, phone, hours,
  licence: { number, document, verifiedAt, verifiedBy },   // clinic registration, NABL / lab registration, drug licence
  status: 'draft' | 'pending_verification' | 'active' | 'suspended' }

// memberships: who may do what, and where
{ _id, accountId, organizationId, unitIds: ObjectId[] | 'all', role: 'owner' | 'doctor' | 'manager' | 'receptionist' | 'pharmacist' | 'technician' | 'viewer' | 'custom',
  permissions: string[], status: 'invited' | 'active' | 'removed', invitedBy, acceptedAt }

// practitioners: the doctor's professional page (today's `doctors` collection)
{ _id, accountId, registration, qualifications, specialties, verification: {...}, isListed, slug, unitIds[] }
```

- **Platform staff (admin)** are `accounts` with `kind: 'platform'`. They have no organization membership; their access comes from `platformRole` and always needs the authenticator app.
- **Owner** can do everything in the organization, transfer ownership, and cannot be removed by staff.
- **Presets** are starting points. The owner can tick individual permissions per person, so "accept appointments yes, see earnings no" works.
- **A membership can cover all units or only some**: a receptionist for the clinic only, a technician for the lab only, a manager for all.
- **One person, many organizations**: a doctor who practises at two clinics, or a manager of two labs, has two memberships and a workspace switcher in the console.

### 4.1.1 A clinic that has its own lab and pharmacy

Many clinics run a lab and a pharmacy under the same roof, or in the same building. The model handles that with one organization and several units:

```
Organization: "Sharma Health"            one legal entity, one owner, one payout account
 ├─ Unit (clinic)     Sharma Family Clinic       doctors, queue, appointments
 ├─ Unit (lab)        Sharma Diagnostics         tests, sample collection, reports
 └─ Unit (pharmacy)   Sharma Medicals            products, stock, orders
```

An independent lab or pharmacy is simply an organization with one unit of that type. Nothing about the model changes.

**What is shared inside one organization**
- **Staff and permissions:** one team list. One person can work in several units, with different permissions per unit.
- **Money:** one payout account and one set of statements, with the earnings split by unit. Money moving between units of the same organization is shown as internal and is never counted twice.
- **Verification:** the organization is verified once; each unit also carries its own licence (clinic registration, lab registration, drug licence), and each is reviewed by admin separately. A unit cannot go live on the strength of another unit's licence.
- **Public page:** the patient site can show "Sharma Health" with its clinic, lab and pharmacy together, each with its own hours, listings and reviews.
- **Dashboard:** the owner sees a combined view and can filter by unit.

**Internal connections between the units**
- **Referral inside the organization:** a doctor at the clinic sends a patient to the organization's own lab or pharmacy. It becomes an order with `source: 'internal_referral'`, goes straight to the right unit, and the patient is told "at your clinic's lab". The patient can always choose another lab or pharmacy instead.
- **One order model for all:** `orders` has a type (`appointment`, `lab_booking`, `pharmacy_order`), the unit it is for, the unit it came from, and the same state history and audit trail. Appointments, lab bookings and pharmacy orders then share notifications, payments and refunds.
- **Patient consent follows the organization, not the person who typed it in:** the patient agrees once that "Sharma Health" and its units may see what is needed to serve them, and can withdraw it. Anything clinical stays behind the gate in section 3.2.
- **Across organizations:** a clinic can also link to an outside lab or pharmacy as a **partner**, for referrals without shared ownership. Each side sees only the referred order, never the other's staff, money or patients. This is a later add-on and needs no change to the model above.

### 4.1.2 Moving the existing data

The data in the database today is demo data, but the move is still written as a proper, repeatable migration:

1. **Keep the ids.** Every user with the patient role is copied into `patients` with the **same `_id`**. Appointments, payments, reviews, records, notifications and sessions already point at that id, so none of them has to be rewritten. The field names (`patientUserId`, `userId`) are renamed later in a cleanup step.
2. **Create `accounts`** from users who are doctors, clinic staff or admins. A person who is both a patient and a doctor ends up with one row in each collection.
3. **Turn each clinic into an organization plus a clinic unit.** The existing `ownerUserId` becomes the owner membership; `staffUserIds` become memberships; `doctorIds` become practitioner links.
4. **Sessions:** refresh tokens and push subscriptions get a `subject` of `patient` or `account`, so a token can only ever be used on its own side.
5. **Notifications, audit log and reviews** store `{ type, id }` for who acted or who is notified, instead of a bare user id.
6. **Dual running:** the old fields stay readable for one release, the new code reads the new collections, and the old fields are dropped at the end of Phase 2B. The migration has a dry-run mode and a rollback script.

### 4.2 Permission catalogue (first cut)

| Permission | Owner | Doctor | Manager | Receptionist | Viewer |
| --- | :-: | :-: | :-: | :-: | :-: |
| `profile.edit` | yes | yes | yes | no | no |
| `schedule.edit` | yes | yes | yes | no | no |
| `appointments.view` | yes | yes | yes | yes | yes |
| `appointments.accept` (confirm / decline) | yes | yes | yes | yes | no |
| `appointments.reschedule_cancel` | yes | yes | yes | yes | no |
| `queue.manage` (check-in, next, no-show, walk-in) | yes | yes | yes | yes | no |
| `status.set` (running late, break) | yes | yes | yes | yes | no |
| `reviews.view` | yes | yes | yes | yes | yes |
| `reviews.reply` | yes | yes | yes | no | no |
| `patients.view` (practice list) | yes | yes | yes | yes | no |
| `earnings.view` | yes | yes | no | no | no |
| `payouts.manage` (bank details, withdrawals) | yes | no | no | no | no |
| `staff.manage` (invite, change, remove) | yes | no | no | no | no |
| `analytics.view` | yes | yes | yes | no | yes |

Roles for the other unit types use the same mechanism: `pharmacist` and `technician` (and later `delivery`) get their own presets. A membership can be limited to some units, so one person can be a receptionist at the clinic and a technician at the lab.

Pharmacy and lab add their own (`catalog.edit`, `orders.accept`, `orders.dispatch`, `reports.upload`, `stock.edit`) to the same mechanism.

### 4.3 How it is enforced

- A single Nest guard, `@RequirePermission('appointments.accept')`, loads the membership for the organization (and unit, where the route has one) in the path (`/console/organizations/:organizationId/units/:unitId/...`) and checks the permission. No route trusts a role name directly.
- The web apps hide what a person cannot do, but the **server is the only authority**.
- Every write by a console user goes to the **audit log** (who, organization and unit, action, before and after). The `audit` module already exists; extend it.
- Invitations: owner enters a phone number and role; the invitee gets WhatsApp/SMS, signs in with OTP, accepts. Pending invites expire in 7 days.
- Removing a person revokes their access to that organization at once.

### 4.4 Login, per app

| App | Who | Sign-in | Extra protection |
| --- | --- | --- | --- |
| `web` | Patients | Phone OTP (as today) | None extra |
| `console` | Doctors, staff, partners | **Register once with phone or email + password; sign in with that identifier and password. No OTP at each login.** The phone or email is verified once, at registration (section 4.5) | Optional authenticator-app 2-step for owners; **required before changing bank details**, with a 24-hour cooldown on payout changes |
| `admin` | Doqto staff | Invite-only accounts, email or phone + password, **plus** authenticator app | Mandatory 2-step, 8-hour sessions, admin audit trail, optional IP allow-list; no self sign-up |

- Separate cookie names and hosts per app (host-only cookies, as in the plan) and an `aud` claim in the token. A patient token is rejected on console and admin routes, and the reverse.
- Admin roles: `super_admin`, `verifier`, `support`, `finance`, `moderator`, `analyst` (read-only). A person gets only the screens their role allows, using the same permission mechanism.

### 4.5 Doctor account: register, complete profile, get approved, go live

This is the main flow of the console. Today the API has the middle part (onboarding, document upload, `pending / verified / rejected`, admin approve or reject with notes) and only phone-OTP accounts. Passwords, email and the draft / changes-requested states are new.

```
1 Register          phone or email + password (+ accept terms)
2 Verify contact    one OTP (phone) or one link (email), once, never again at login
3 Sign in           identifier + password → console
4 Complete profile  guided steps with a progress bar; saved as a draft at every step
5 Submit            allowed only when every required item is done
6 Admin review      approve · request changes (per item) · reject (with reason)
7 Live              doctor appears on the patient site; doctor is notified
8 Later edits       small edits go live at once; sensitive edits are re-reviewed
```

**Verification states** (extends `doctors.verification.status`; contract change in `packages/shared`):

| State | Meaning | Visible to patients | Doctor can |
| --- | --- | :-: | --- |
| `draft` | Registered, profile not yet submitted | no | Edit everything, submit when complete |
| `pending` | Submitted, waiting for admin | no | View only (can withdraw to edit) |
| `changes_requested` | Admin asked for fixes, with a comment per item | no | Fix the flagged items and resubmit |
| `verified` | Approved | **yes** (if `isListed`) | Run the practice |
| `rejected` | Refused, with a reason | no | Read the reason, may appeal or reapply once the reason is fixed |
| `suspended` | Taken down by admin (complaint, fraud, lapsed registration) | no | Contact support; existing bookings are cancelled and refunded |

**What "complete" means (server-side checklist; the submit button stays off until all are true):**

| Group | Required items |
| --- | --- |
| Identity | Full name, gender, photo, languages, verified phone **and** a verified email (the second one is verified at this step if it was not used to register) |
| Qualification | Degrees with institution and year, specialties, years of experience |
| Registration | Medical council, registration number, year of registration, **document upload** (certificate) |
| Practice | At least one clinic: name, address with map pin, phone, one photo |
| Fees and schedule | Consultation fee and at least one weekly schedule that produces slots |
| About | Short bio (within the non-clinical content rules) |
| Consent | Accepts the doctor terms and the data-handling terms |
| Payout | **Not required to go live.** Required before the first payout |

**Admin review screen:**
- One page per doctor: submitted details, documents, a link to look up the registration on the state council or NMC register, and a checklist the reviewer ticks.
- Three outcomes: **approve**, **request changes** (a comment on each item that needs fixing), **reject** (reason required, at least 5 characters, as the API already enforces).
- Every decision is written to the audit log with the reviewer's name. The existing review token (guards against two reviewers acting at once) stays.
- Target turnaround is shown to the doctor ("usually within 2 working days") and tracked on the admin dashboard.

**When approved:**
1. `verification.status = verified`, `isListed = true`, the slug is created and then frozen (existing rule).
2. The doctor appears in patient search and on `/d/<slug>`. The patient site caches profiles for 60 seconds, so a new doctor can take up to a minute to show; invalidate that cache on approval.
3. The doctor gets WhatsApp, email and a console notification ("You are live", with the profile link and next steps: share your page, add staff).
4. The first listing is flagged in the admin dashboard for a quick sanity check of the public page.

**Edits after approval:**
- **Live at once:** bio, photo, fees, languages, schedule, clinic phone and photos.
- **Re-review, profile stays live and the old values show until approved:** name, qualifications, specialties, clinic address.
- **Re-review and hidden until approved:** council or registration number and its document. This is today's behaviour and it protects patients.
- Lapsed or expired registrations are checked by a yearly reminder job that asks the doctor to re-upload.

### 4.6 Password sign-in: what it needs

Password-only is simpler for doctors but weaker than OTP, and doctors and their staff will hold patient contact lists and, later, money. The plan keeps the doctor's flow as asked and adds the protections below.

| Topic | Design |
| --- | --- |
| Identifier | A user has a phone, an email, or both. Both are unique. A doctor can sign in with either one |
| Same phone as a patient | A doctor who is also a patient has **two separate identities** (one in `patients`, one in `accounts`). Registering a console account verifies the phone with one OTP and sets a password; it never touches the patient record. The console token has `aud: console`, so a patient session never works there and the reverse |
| Password storage | argon2id with a per-user salt and a server-side pepper. Never stored or logged in clear |
| Password rules | Minimum 10 characters, checked against a list of common and breached passwords. No forced periodic change |
| One-time verification | Phone: one OTP at registration. Email: one link at registration (needs a transactional email provider, section 9). Neither is asked at later logins |
| Sessions | Short access token, rotating refresh token (30 days) as today. "Remember this device" is the default. A new device or country sends an alert by WhatsApp or email |
| Forgot password | Reset by link (email) or OTP (phone). A reset signs out every other session |
| Abuse protection | Rate limit per account and per IP, progressive delay after failures, temporary lock after repeated failures with an unlock by reset, same message for "no such user" and "wrong password" |
| Higher-risk actions | Changing bank details, changing the sign-in email or phone, and adding a new owner re-ask for the password, and need the authenticator app when the owner has turned it on (required for payouts) |
| Optional 2-step | Authenticator app (TOTP), for owners. Admin accounts **always** have it |
| Staff | The owner invites by phone or email. The invitee opens the link, sets a password, and joins the workspace with the permissions chosen. No self-registration into someone else's clinic |
| Admin | Invite-only. Password plus authenticator app. No public sign-up page exists on the admin host |
| Logout | Single device, and "sign out everywhere" (already built for patients) |

### 4.7 Stakeholder flow: landing, register, role-based home

The patient site stays the main landing page. Everything for providers lives in the console app, starting with its own landing page.

```
Patient site (www)                       Console (console)                         Admin (admin)
  "For doctors / Partners" link  ───────▶  /            console landing (public)
                                           /register    choose type, create account
                                           /login       sign in
                                              │
                                              ▼
                                           /home        picks the workspace for this account
                                              ├─ clinic / doctor ──▶ /clinic    doctor dashboard and pages
                                              ├─ lab ──────────────▶ /lab       lab dashboard and pages
                                              └─ pharmacy ─────────▶ /pharmacy  pharmacy dashboard and pages
```

**Console landing (`/`)**: public, only for stakeholders, not patients. It says who the console is for (doctors and clinics now; labs and pharmacies marked "coming later"), what each gets, how it works (register, complete the profile, get verified, go live), what verification means, and has Register and Sign in buttons plus a link back to the patient site. It is in English and Hindi. Features that are not built yet are described as planned, and registration states plainly that it opens soon until the accounts API exists.

**Register (`/register`)**: the person first chooses **what they are**: doctor or clinic, lab, or pharmacy. That choice sets the workspace type and the profile form they will see after sign-in. Then phone or email plus a password, with the one-time phone or email check from section 4.6.

**Home (`/home`)**: after sign-in the server tells the console which workspaces the account belongs to.
- One workspace: go straight to its dashboard (`/clinic`, `/lab` or `/pharmacy`).
- Several (a clinic that also has its own lab and pharmacy, section 4.1.1): a short chooser, and a switcher in the top bar afterwards.
- Not yet approved: the profile-completion flow and a status page (section 4.5), not the dashboard.

**Dashboards by role** (each type has its own navigation, so a pharmacy never sees clinic screens):

| Type | Pages |
| --- | --- |
| Doctor or clinic | Dashboard, Appointments, Queue, Schedule, Reviews, Earnings, Staff, Profile, Settings |
| Lab | Dashboard, Bookings, Test catalogue, Sample collection, Reports, Staff, Profile, Settings |
| Pharmacy | Dashboard, Orders, Products and stock, Dispatch, Staff, Profile, Settings |

Lab and pharmacy pages stay behind the clinical-data gate (section 3.2) for anything that carries prescriptions or reports.

### 4.8 Admin (root) dashboard

The admin area of the console (`/admin`) has one **root dashboard** for Doqto staff:

1. **Registration requests** at the top, because they need action: how many are waiting, the oldest first, with the provider type, name, city and the date submitted. Opening one shows the full profile and documents with approve, request changes and reject (section 4.5).
2. **Cards by provider type**: Doctors, Clinics, Labs and Pharmacies, each showing how many exist and how many are verified, pending and suspended.
3. **Lists**: clicking a card opens the list for that type, with search and filters (status, city, date).
4. **Provider page**: clicking a name opens that provider. It shows **the provider's own dashboard**, read-only, so staff see exactly what the provider sees, and next to it the **admin tools**: profile and documents, bookings, reviews, payments, audit trail, suspend or reinstate, and edit with a recorded reason. The exact extra tools are to be decided with you.
5. **View as** is read-only by default, needs a reason, expires after a short time, and every use is written to the audit log and shown on the provider's own activity page.

```
/admin                      root dashboard: requests + cards
/admin/requests             all registration requests
/admin/requests/:id         review one request: profile, documents, approve / changes / reject
/admin/doctors              list            /admin/doctors/:id      provider page (their dashboard + admin tools)
/admin/clinics              list            /admin/clinics/:id
/admin/labs                 list            /admin/labs/:id
/admin/pharmacies           list            /admin/pharmacies/:id
```

Status: the console landing, register and sign-in pages, the three workspace skeletons, and the admin dashboard, request and provider pages exist as skeletons (see the READMEs). They show no real data until sign-in and the accounts API exist (phase 2B).

---

## 5. Admin console scope

| Area | What admin can do | Exists today |
| --- | --- | --- |
| Verification queue | Review documents, verify / reject with a reason, request more documents | List, detail and verify API; UI partly |
| Doctors and workspaces | View and **edit any profile** (every edit needs a reason and is logged), suspend, reinstate, feature | View only |
| Reviews | Moderation queue (reported, fraud-scored), publish, hide, restore, ban a reviewer | Fraud score and report API; no admin UI |
| Bookings | Search any booking, see timeline, force-cancel and refund, resolve disputes | None |
| Payments | Payments, refunds, failed webhooks, settlements, commission settings | None |
| Users | Search patients and staff, lock an account, anonymise on request (DPDP) | None |
| Notifications | Delivery log (WhatsApp / SMS / push), failures, resend, template status | Placeholder |
| Catalogue | Specialties, cities, languages, review vocabulary | None |
| Dashboards | Bookings, revenue, cities, funnel, no-show and refund rates, ratings, verification time | None |
| System | Jobs health, provider status (payments, WhatsApp, SMS, storage), feature flags | None |
| Support | Tickets from patients and doctors, internal notes | None |
| Audit | Searchable log of every console and admin action | Stored; no UI |
| View as | Read-only "view as this doctor" to help with support, logged and time-limited | None |

Admin never sees a patient's clinical data, even after section 3 lands, unless a patient case requires it and the access is logged and approved.

---

## 6. Business rules to settle before building money screens

1. **Who collects the money?** Today patients pay Doqto (Razorpay) and the booking fee is held. Options: (a) Doqto collects and pays out to doctors (needs a payout ledger, settlement cycle, TDS / GST handling, and Razorpay Route or a nodal-style arrangement); (b) the doctor's own Razorpay account receives the payment and Doqto charges a subscription or a fee. Pick one with your accountant before the earnings screens are built.
2. **Commission and fees.** Fixed per booking, percentage, or monthly plan? Who pays the gateway fee on refunds?
3. **Invoices.** GST invoices to patients (for the booking fee) and to doctors (for the commission).
4. **Accept or decline SLA.** A booking waiting for a doctor should have a deadline (for example 2 hours, or before the slot) and then auto-cancel with a full refund. This protects patients and keeps ratings fair.
5. **Doctor cancels.** Full refund, a reliability score, and a limit before the doctor is warned or suspended.
6. **Multi-doctor clinics.** One organization, several doctors, each with their own schedule; receptionists see all doctors; doctors see only their own earnings.
7. **Notifications for providers.** WhatsApp for new bookings and cancellations (needs approved templates; see the WhatsApp work), plus web push and email.

---

## 7. Roadmap

Effort is a rough guess for one developer. Treat each as a range, not a promise.

| Phase | What ships | Rough effort | Done when |
| --- | --- | --- | --- |
| **2A. Foundation** | Shared packages (`ui`, `i18n`, `api-client`, `config`) plus the console building blocks from section 2.1 (sidebar shell, data table, filter bar, status chip, timeline, stat card); `apps/console` and `apps/admin` skeletons; **mechanical move** of the clinic and admin screens; redirects from the old URLs; ADR 0001 amended | 2 to 3 weeks | Patient site unchanged; `/clinic` and `/admin` run on their own ports; all existing tests pass |
| **2B. Identity and permissions** | New collections `patients`, `accounts`, `organizations`, `units`, `memberships` and the id-preserving migration (section 4.1.2), permission guard, token audience, audit extension, invitations. **Password accounts:** email and password fields, argon2id, register + one-time phone or email verification, sign-in without OTP, reset, lockout and rate limits (section 4.6). Admin invite-only accounts with authenticator-app 2-step | 3 to 4 weeks | A doctor registers and signs in with a password and no OTP; a receptionist can accept a booking but gets 403 on earnings; patient token rejected on console routes; removed staff lose access at once |
| **2B+. First vertical slice: register, complete profile, approval, live** | Registration and profile wizard in the console (section 4.5), completeness checklist, new states `draft / changes_requested / suspended`, submit, admin verification queue with approve / request changes / reject, doctor and patient-site visibility on approval, "you are live" notifications | 3 to 4 weeks | A new doctor registers, completes the profile, an admin approves, and the doctor appears in patient search within a minute; a rejected or change-requested doctor cannot be found by patients |
| **2C. Doctor console MVP** | Dashboard, appointments (accept / **decline** / reschedule), queue and live status, schedule with leave and holidays, profile and documents, staff management with per-person permissions, reviews view and reply | 4 to 6 weeks | A real doctor and receptionist run a clinic day with no demo button |
| **2D. Admin console MVP** | Verification queue, doctor edit with reason, review moderation, booking and payment search, refunds and force-cancel, notification delivery log, audit viewer, KPI dashboard | 4 to 5 weeks | Ops can verify, moderate and refund without touching the database |
| **2E. Money and insight** | Earnings and settlement ledger, invoices, payouts (per the decision in section 6), doctor analytics, admin finance reports | 4 to 6 weeks | Doctor sees every rupee and when it is paid; finance can reconcile with Razorpay |
| **2F. Hardening and launch** | Hosting for three apps, live providers (WhatsApp, SMS, storage, Razorpay live), monitoring, backups, rate limits per audience, security review, load test | 3 to 4 weeks | Pilot clinics onboarded on real hosts |
| **Gate. Clinical data** | Legal review, ADR 0009, consent and access-grant model | Calendar time depends on the lawyer | Written sign-off exists |
| **3A. Lab** | Catalogue, bookings, sample flow, report upload to patient | 6 to 8 weeks after the gate | A pilot lab delivers a report to a patient |
| **3B. Pharmacy** | Catalogue, stock, orders, prescription handling, delivery | 8 to 12 weeks after the gate and a regulatory opinion | A pilot pharmacy completes real orders |

**Why this order:** 2A and 2B are cheap now and expensive later, and everything else depends on them. 2B+ is the first thing a real doctor touches and it is what fills the patient site with real doctors, so it comes before the rest of the console. 2C makes the patient journey real (a doctor can finally confirm without the demo button). 2D lets you operate. Money (2E) needs your business decision first, so it comes after the screens that do not depend on it. Labs and pharmacies wait for the legal gate and reuse the same foundation.

### Order inside 2A (so nothing breaks)

1. Create `packages/config`, then `packages/ui`, then `packages/i18n` and `packages/api-client`; point `apps/web` at them; run the web tests after each package.
2. Create `apps/console` and `apps/admin` from the patient app's toolchain; move the routes and components listed in the plan; no behaviour change.
3. Add the cross-app links (`NEXT_PUBLIC_CONSOLE_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_SITE_URL`), post-login routing, and the redirects from `/clinic/*` and `/admin/*` on the patient site.
4. CORS origins for ports 3001 and 3002, environment docs, ESLint root directories, CONTRIBUTING.
5. Browser check from the plan, once for each app.

---

## 8. Testing and quality bars

- **API:** a permission test for every console route (each role: allowed or 403), tenant isolation tests (a user from organization A can never read organization B), audit-log assertions on writes, migration tests for `clinicIds` / `staffUserIds` to memberships.
- **Web (each app):** typecheck, lint, unit tests, and one real-browser run per role (owner, receptionist, admin) against the real API, as done for the patient app.
- **Security:** token audience tests, session revocation on staff removal, rate limits per audience, no admin routes reachable from the console host.
- **Performance:** list endpoints paginated with indexes per organization; dashboards read from precomputed daily rollups, not live scans.

---

## 9. Decisions needed from you

1. **Three apps (web, console, admin) as recommended, or two?** I recommend three, for the security reasons in section 1.
2. **Shared packages now, or copy first and extract later?** I recommend extracting now.
3. **Money model** (section 6, items 1 to 3): Doqto collects and pays out, or doctors receive payment directly?
4. **Start the legal (DPDP) review now.** It is the slowest item and blocks clinical records, labs and pharmacies.
5. **Domain names** for `console` and `admin`, so cookies, CORS and WhatsApp links can be set once.
6. **Is selling or delivering medicines in scope at all?** If yes, get regulatory advice before any design work.
7. **One organization with several units (clinic, lab, pharmacy), or separate organizations that link to each other?** I recommend one organization with units (section 4.1.1), plus optional partner links to outside labs and pharmacies later.
8. **Can a patient's data be shared across the units of one organization?** Only with the patient's consent and only after the legal gate; decide the wording of that consent with your lawyer.
9. **Transactional email provider** (for email verification, password reset and approval emails): Amazon SES, Resend or similar, with a sending domain and SPF / DKIM set up. Needed before email registration can ship.
10. **Must every doctor have a verified email as well as a phone?** I recommend yes by the time they submit for approval: it is a second recovery path and the channel for approval and payout notices.
11. **Should staff accounts also use password sign-in with no OTP?** I recommend yes, as in section 4.6, with the owner able to require the authenticator app for the whole workspace.

---

## 10. Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Clinical data added too early | DPDP penalties, loss of trust | Gate in section 3; reviewers block any clinical field until ADR 0009 |
| Permissions only enforced in the UI | Staff reach data they should not | Server-side guard on every console route; permission tests are a merge requirement |
| Admin account takeover | Full platform access | Invite-only, mandatory authenticator app, short sessions, IP allow-list, audit alerts |
| Copy-paste UI between apps | Fixes missed, inconsistent screens | Shared packages from day one |
| Password accounts are easier to attack than OTP | Account takeover of a doctor or staff member | Strong hashing, breached-password check, rate limits and lockout, new-device alerts, optional authenticator app, re-ask for password on risky actions (section 4.6) |
| The user-collection split touches many collections | Broken references, lost sessions | Keep the same `_id` for patients so no references change; dry run, rollback script and tests that count references before and after |
| Money rules unclear | Wrong payouts, disputes | Decide section 6 first; ledger with immutable entries |
| One developer, wide scope | Slow delivery, burnout | Ship 2A to 2D as separate releases; keep labs and pharmacies out of Phase 2 |

### Progress: provider sign-in (2026-11-09)

- **Done.** `apps/api/src/console-auth`: `accounts`, `accountCodes`, `accountRefreshTokens` collections (separate from patient `users`); register, confirm-once code, password sign-in, forgot and reset password, refresh with rotation and reuse detection, logout, `/me`. Passwords use scrypt (parameters stored in the hash, so a later move to argon2id needs no data migration). Five wrong passwords lock the account for 15 minutes; code requests are limited per phone or email and per IP; a reset signs out every device. Console tokens carry `aud: console`; the patient guard refuses any token that has an audience. Console UI: register (two steps), sign-in, forgot password, session gate and sign out in the workspace frame. Covered by `test/console-auth.e2e-spec.ts` and checked in a real browser.
- **Not done yet (next).** Organizations, units and memberships (clinic owns a lab and a pharmacy; staff access), the profile wizard per type, admin review and listing on the patient site, admin accounts (invite only, authenticator code), a real email provider, and moving the old `/clinic` and `/admin` screens out of `apps/web`.

### Progress: sign-up, the services panel and the application form (2026-11-09)

- **Done (step 1).** Sign-up is plain (name, phone or email, password, one confirmation code) and creates the account and its organization; no service is chosen there. After sign-in the panel (`/services`) shows approved services as cards, applications with their status, and one "+" card, "Apply for a service". That opens the one application form (`/apply`): the person ticks the services they run (clinic or doctor, lab, pharmacy) and a section appears for each, built from `UNIT_FORMS` in `packages/shared` (the API checks the same list). Submitting sends every section together (`POST /console/applications`); each service becomes a `pending` unit with an owner membership, and Doqto reviews each on its own. Once a service is approved (`verified`), sign-in goes straight to its dashboard when it is the only approved one, and to the panel when there are several. Only an approved service opens a dashboard. Settings > "Add more services" opens the same form (and shows every service with its status). A service sent back for changes is fixed on the same form with the earlier answers filled in. One unit per kind per organization. Accounts created before this (one `accountType`) are migrated by `0010-accounts-to-organizations` (their unit starts as `draft`).
- **Stand-in for admin review.** `pnpm --filter @doqto/api unit:review <phone-or-email> <kind> [status]` (demo mode and demo databases only) until the admin app can approve, send back or reject.
- **Fields are a starting list.** Licence and registration rules differ by state; have the lists in `unit-forms.ts` confirmed (and supporting document uploads added) before launch.
- **Next (step 2).** The admin review queue and approval screens in `apps/admin` (approve, request changes with a note, reject), admin accounts (invite only, authenticator code), publishing an approved clinic to doctor search and an approved lab or pharmacy to its list, document uploads on the form, then staff memberships with permissions.

### Progress: the admin area and application review (2026-11-09)

- **Done.** The Doqto team signs in at the console's one login page (an account with the `admin` role lands on `/admin`; the API checks the role on every `/platform/*` request, so removing it stops access at once). `/admin` shows the registration requests (list with tabs and counts by status; detail page with the submitted details, the applicant, the business's other services, and Approve / Request changes / Reject). A reason (5+ characters) is required to send back or reject and is shown to the applicant. Only a `pending` application can be decided, and each decision goes to the audit log. The admin login comes from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` in `.env` (applied at every API start) or from `admin:create`. Tested in `test/platform.e2e-spec.ts`, `test/admin-env.e2e-spec.ts` and in a real browser.
- **Merged.** A separate `apps/admin` (port 3020) was built first and merged into `apps/console` the same day, because the request was patients separate and everyone else in one app. Its separate sign-in routes (`/platform/auth/*`) and cookies were removed; there is one session system.
- **Not done.** An authenticator code for the team at sign-in, document uploads and a review checklist, notifying the applicant of a decision, the provider lists and "view as" pages, and publishing an approved clinic to doctor search and an approved lab or pharmacy to its list. `pnpm --filter @doqto/api unit:review` still exists for demo databases.

### Progress: approved clinics appear on the patient site (2026-11-09)

- **Done.** Approving a clinic or doctor application publishes it: a `doctors` record (what patient search lists, with a slug, specialty, qualifications, registration, fees, city) and a `clinics` record (name and address), both linked back to the application (`unitId`) and the provider account, so a later approval updates the same listing instead of duplicating it. Sending back or rejecting an approved one takes the doctor off the site. The doctor and clinic schemas no longer require a patient-side user (a unique index on `userId` became partial, migration `0011`). The clinic form gained the registration year, state and PIN code. An application missing them is not approved (it stays pending; the team asks for changes). Tested in `test/platform.e2e-spec.ts` and in a real browser (admin approves, the doctor shows in the patient search and has a profile page).
- **Defaults to confirm.** The booking fee is the platform minimum (₹10) until you decide how it is set; there is no map pin for the clinic yet, so "near me" search does not find it (city search does); no schedule exists, so patients cannot book slots until the doctor sets one (the schedule screen is not built); registration scans are not uploaded on the form yet, so the team reviews the typed details.
- **Not done.** A schedule screen for the doctor, geocoding the clinic address, lab and pharmacy lists on the patient site, notifying the applicant of a decision.
- **Fix (same day).** Clinics approved before the form had the registration year, state and PIN code were approved but could not be listed. Migration `0012` sends them back for changes with a note; the provider fills the three fields, the team approves, and the doctor is listed. The services panel and the form now show the reviewer's note to the applicant (it was only visible to the team before).

### Progress: doctor schedule from the console (2026-11-09)

- **Done.** A listed doctor had no schedule, so patients saw no available days ("No slots are free on this day"). The clinic or doctor now sets weekly hours in the console (`/clinic/schedule`, `GET/PUT /console/workspaces/:id/schedule`), and the clinic dashboard reminds them until it is saved. Saving opens booking: the patient calendar then shows the days as available. Tested end to end (approve, set hours, patient slots go from none to 17 for a day) and in a real browser.
- **Not done.** Leave days and holidays, the walk-in share, and several clinics per doctor on the schedule screen; confirming or running appointments from the new console (the appointments and queue screens are still placeholders), so a booking made with a new doctor has no screen to be confirmed on yet.

### Progress: bookings in the console (2026-11-09)

- **Done.** A booking made with a newly listed doctor did not show in the doctor's console. The Appointments screen now lists the paid bookings waiting to be accepted (any date) and one day at a time, and **Confirm** accepts a booking (creates the visit code and notifies the patient). The dashboard reminds the doctor of waiting bookings. It reuses the existing clinic services; the owner account of an approved clinic is treated as its manager. Tested end to end (patient books and pays, the doctor sees and confirms it, the patient sees it confirmed; a stranger, a patient and a signed-out visitor are refused) and in a real browser.
- **Not done.** The queue screen (check-in with visit code or OTP, next patient, no-show, running late, live status) and walk-in and phone bookings from the console, declining or rescheduling a booking, and a push or WhatsApp alert to the doctor when a booking is paid.
- **Rule change (same day).** When a patient moves a confirmed booking it now goes back to "waiting for the doctor" (the paid fee stays, the old visit code is dropped, a new one comes when the doctor confirms), so a visit can never change time without the doctor knowing. The doctor sees it in the waiting list marked as moved. Cancelling is unchanged (it frees the slot and refunds by the existing rules).
- **Open question.** What happens if the doctor never confirms a moved or new booking (reminders, automatic cancel with refund after some hours)? Not decided; there is no timeout job for a booking waiting on the doctor.

### Progress: the queue in the console (2026-11-09)

- **Done.** `/clinic/queue` runs the visit day (check-in with the visit code or a sent OTP, call the next patient, did not come, move to front, the doctor's live status, add a walk-in or phone booking), on the existing queue services and rules. The clinic and doctor always come from the service in the path. Tested end to end (check-in with a wrong and a right code, status, walk-in OTP check-in, two patients called in the right order, a stale tap refused, a stranger and a patient refused) and in a real browser.
- **Not done.** Declining or rescheduling a booking from the console, a receptionist account with its own permissions (staff memberships), pushing a WhatsApp or push alert to the doctor when a booking is paid or moved, and a timeout for bookings the doctor never confirms.

### Progress: chat with the doctor (2026-11-09)

- **Done.** One text conversation per booking (contract 6.14.0). It opens when the doctor accepts the booking and stays writable until 7 days after the visit, then it is read-only; a cancelled or not-yet-accepted booking has no chat. Patient: Messages in the patient app (the old demo, with its scripted replies and local storage, is gone), and a Message the doctor button on the appointment. Doctor: Messages in the console (`/clinic/messages`), list and thread, with a count of new messages. Both screens refresh by themselves (a few seconds). Only the two people of the booking can read or write a thread (anything else is not found); sending is limited to 30 a minute; deleting a patient account deletes their messages. Tested end to end (both directions, unread counts, strangers, the 7-day close, account deletion) and in a real browser, patient and doctor side by side.
- **Not built (decide next):** an alert to the other side when a message arrives (WhatsApp or push; today they see it when they open the app), photos or PDF attachments, the messages in the patient's data export, a profanity or abuse report, and staff replying on behalf of the doctor. Chat carries health questions, so it needs the privacy review (ADR 0007) before a real launch.

### Progress: the doctor's profile and photo (2026-11-09)

- **Done.** `/clinic/profile` lets an approved doctor upload a photo (shrunk in the browser, JPG, PNG or WebP) and edit every detail patients see (the clinic form: name, specialty, qualifications, registration, experience, address, fee, languages, about). Nothing goes live directly: the edit is kept as a pending change (contract 6.15.0), patients keep seeing the approved profile, and the Doqto team reviews it in the admin area under Profile changes (current next to proposed, approve or reject with a reason). Approving updates the doctor and clinic records patients read, the photo, and the service name; rejecting keeps the old profile and shows the doctor the reason, who can edit again or withdraw. Tested end to end and in a real browser, doctor, admin and patient. The patient doctor page is cached for up to a minute, so an approved change can take that long to show there (search shows it at once).
- **Not built:** an alert to the doctor when a change is approved or rejected, a history of past changes, and the map pin for the address.
