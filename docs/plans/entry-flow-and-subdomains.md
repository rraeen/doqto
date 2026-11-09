# Doqto entry flow and subdomain plan

**Status:** Draft for Raunak review  
**Date:** 2026-10-19  
**Related:** [PRD](../PRD.md), [TDD §11 auth](../doqto-technical-design.md), [Stitch designs](../design/stitch/README.md)

---

## 1. Goal

Define how **patients** and **doctors** enter Doqto from the public web, how login behaves, how that maps to **subdomains** long term, and which **Stitch** screens to implement next—without breaking Phase 1 rules (phone-first OTP, no clinical features).

---

## 2. Decisions (recommended)

| Topic | Recommendation | Why |
| --- | --- | --- |
| Navbar link (replaces “For doctors”) | **Doctor console** → `/for-doctors` (marketing) + primary CTA **Log in** on that page | Clear for clinic staff; “For stakeholders” is better as a **footer / partner** section (“Let’s connect”), not the main nav |
| Patient login UX | **Modal (dialog)** on the landing site, not a full-page `/login` for primary CTAs | Matches “popup after visit”; keeps SEO on `/`; deep links still use `/login?next=…` |
| Patient auth method (Phase 1) | **Phone + OTP only** (WhatsApp opt-in) | Already built; matches TDD and Tier-2/3 users |
| Doctor auth (Phase 1) | **Phone + OTP** (same API), role routed to `/clinic` after verify | Reuses BE-04; staff/doctor roles already on `users.roles` |
| Doctor auth (Phase 2+) | **Email magic link or password** + **Google OAuth** on console only | Requires new BE stories, identity linking, and stricter cookie/domain rules |
| Long-term hosts | **`www.doqto.com`** (patient) · **`console.doqto.com`** (doctor/clinic) · **`admin.doqto.com`** or path `/admin` (internal) | Clean mental model; easier cookie isolation than one domain with many roles |
| Design source | Stitch **Unified Healthcare Login** (`a1c9f94af78747b28345a01adb923ac7`) for **visual**; **copy and fields** follow Doqto product rules | Repo already mirrors neumorphic login in `apps/web/src/app/globals.css`; Stitch HTML shows password/Google—we **do not** ship those for patients in Phase 1 |

**Naming note:** Production docs today mention `doqto.in`; this plan uses your stated vision **`doqto.com`**. Pick one registrable domain before cookie and OAuth redirect URIs are fixed.

---

## 3. Current state (codebase)

| Area | Today |
| --- | --- |
| `/` | Public **landing** (`LandingPage`); signed-in users see **patient home dashboard** (`HomeSwitch`) |
| `/login` | Full-page **phone → OTP** flow |
| Landing navbar | Why · How · **For doctors** (`/clinic`) · Login · Find a doctor |
| `/clinic` | **Clinic console** (assumes session; no dedicated doctor marketing/login shell) |
| Auth API | `POST /auth/otp/request`, `POST /auth/otp/verify` only (no Google/email) |
| Design | Neumorphic green login aligned with Stitch; local HTML in `docs/design/stitch/unified-healthcare-login-screen-a1c9f94a/` |

**Gap vs your vision:** Login is a **route**, not a **popup**; “For doctors” jumps into the app instead of a **doctor entry** story; Stitch **password/Google** UI is not product-accurate yet.

---

## 4. Target experience

### 4.1 Patient path (`www.doqto.com`)

```mermaid
flowchart LR
  A[Land on /] --> B{Signed in?}
  B -->|No| C[Landing + navbar]
  C --> D[Login or Find doctor]
  D -->|Login| E[Login modal: phone + OTP]
  D -->|Find doctor| F[/search public or after soft gate]
  E --> G[Patient home /]
  B -->|Yes| G
  G --> H[Bottom nav: Home · Search · Appointments · Profile]
```

**Rules**

- Landing stays **crawlable** (server-rendered hero, no login wall on first paint).
- **Login** and **Find a doctor** open the modal when auth is required for a action; optional: allow browsing search without login until book/review.
- After OTP success: stay on `/` (dashboard) or honor `?next=` (e.g. return to booking).
- Modal uses same `LoginFlow` as `/login` (one component, two shells: `Dialog` vs page).

**Stitch references (patient, post-login home)**

- Login shell: [Unified Healthcare Login Screen](../design/stitch/unified-healthcare-login-screen-a1c9f94a/screen.png) — **layout only**; fields = phone + OTP.
- Home: [Unified Healthcare Home Dashboard](../design/stitch/unified-healthcare-home-dashboard-b8ee5f31/screen.png) — align with existing `HomeDashboard` over time.

### 4.2 Doctor / clinic path (`console.doqto.com` or `/for-doctors`)

Two-layer entry (recommended):

1. **Doctor marketing page** `/for-doctors` on www (or on console root later): value prop, “Log in to console”, “Let’s connect” for onboarding sales.
2. **Console login** on `console.doqto.com/login` (or `/clinic/login` until split): neumorphic card; **Phase 1** = phone + OTP; **Phase 2** = tabs or secondary row for email / Google.

```mermaid
flowchart LR
  W[www.doqto.com] --> FD[/for-doctors]
  FD --> CL[Console login]
  NAV[Navbar: Doctor console] --> FD
  CL --> OTP[Phone + OTP]
  OTP --> R{roles?}
  R -->|doctor or clinic_staff| C[/clinic today]
  R -->|patient only| P[Redirect www + message]
  R -->|admin| A[/admin]
```

**Phase 2 doctor login (design in Stitch, build later)**

- **Google:** OAuth 2.0 → link to existing `users` by verified email (must not create duplicate doctors).
- **Email:** magic link or OTP to email (India: many doctors have email; still keep phone as recovery).
- **Mobile:** keep as default; matches walk-in staff devices.

Do **not** show Google on patient modal in Phase 1—it adds support burden and conflicts with WhatsApp-first positioning unless you explicitly want it for patients later.

### 4.3 “Let’s connect” / stakeholders

Use for **partners, investors, city pilots**, not clinic daily login:

- Footer or `/connect` section: short form or `mailto:` / WhatsApp business link.
- Optional nav: **Partner with us** (desktop) instead of overloading “Doctor console”.

---

## 5. Navbar copy (landing)

| Current | Proposed | Target |
| --- | --- | --- |
| For doctors | **Doctor console** | `href="/for-doctors"` (new page) |
| Login | **Log in** (unchanged) | Opens **patient login modal**; `href="/login"` remains for shareable links |
| Find a doctor | **Find a doctor** (unchanged) | `/search` |

Add later if needed: **Partner with us** → `#connect` or `/connect`.

i18n keys to update: `landing.navDoctors` → e.g. `landing.navConsole`; add `landing.navPartners` if used.

---

## 6. Subdomain architecture (long term)

| Host | Audience | App surface | Auth cookie scope |
| --- | --- | --- | --- |
| `www.doqto.com` | Patients, SEO | Landing, search, doctor profiles, patient app | `COOKIE_DOMAIN=.doqto.com` or host-only + `SameSite` per INT-05/BE-04 |
| `console.doqto.com` | Doctors, clinic staff | `/clinic/*`, onboarding | **Separate** cookie domain or prefix (e.g. `console_at`) so demo/production cannot cross-leak (see ADR/demo safety) |
| `api.doqto.com` | — | NestJS `/api/v1` | CORS: both web origins |
| `admin.doqto.com` or `www…/admin` | Doqto ops | `/admin` | Restrict by role + optional IP allowlist later |

**Phase 1 local:** single origin `localhost:3000` with path groups `(patient)`, `(auth)`, `clinic`, `admin`—same as now. Subdomains are **routing + env** (`WEB_PUBLIC_URL`, `CORS_ORIGINS`, Vercel projects) when you deploy.

**Implementation note:** One Next.js app can serve all path groups today; split to two Vercel projects (www vs console) when traffic, caching, or cookie isolation requires it—shared `packages/shared` contract unchanged.

---

## 7. Stitch project assets

**Project:** Healthcare Management Dashboard - Neumorphic Vision  
**ID:** `11991167442058590509`

**Login screen (canonical for this plan)**

- **Title:** Unified Healthcare Login Screen  
- **Screen ID:** `a1c9f94af78747b28345a01adb923ac7`  
- **Local mirror:** [docs/design/stitch/unified-healthcare-login-screen-a1c9f94a/](../design/stitch/unified-healthcare-login-screen-a1c9f94a/screen.html)  
- **Hosted HTML (refresh from Stitch):** use Stitch MCP `get_screen` → `htmlCode.downloadUrl`  
- **Screenshot:** `get_screen` → `screenshot.downloadUrl`

**Other useful screens**

| Use | Stitch folder |
| --- | --- |
| Patient landing polish | `healthcare-system-premium-landing-page-*` |
| Post-login patient home | `unified-healthcare-home-dashboard-*` |
| Clinic/day sheet (console) | `healsoft-appointment-management-page-*`, `healthcare-management-dashboard-neumorphic-vision-*` |

**Out of scope for Phase 1 (ADR 0007):** prescriptions, health records, video/chat Stitch screens—reference only.

---

## 8. Phased delivery

### Phase A — UX routing (FE, no new auth providers)

- [ ] Add **`/for-doctors`** marketing page (Stitch landing patterns + CTA “Log in to console”).
- [ ] Change navbar **For doctors** → **Doctor console** → `/for-doctors`.
- [ ] **`LoginModal`** wrapping existing `LoginFlow`; wire landing **Log in** + optional intercept on book/review.
- [ ] Keep **`/login`** as modal duplicate for accessibility and `?next=` deep links.
- [ ] **`/for-doctors`** CTA → `/clinic/login` or `/login?audience=clinic` (see Phase B routing).
- [ ] After OTP, **role-based redirect:** patient → `/`; doctor/staff → `/clinic`; admin → `/admin`.
- [ ] EN/HI strings + basic Vitest for redirect helper.

**Owner:** FE (`apps/web/**`). **Depends on:** existing auth API only.

### Phase B — Console login shell (FE + small BE)

- [ ] Dedicated route group `(console-auth)` with Stitch neumorphic layout (reuse `neu-*` utilities).
- [ ] Query param or subdomain flag `audience=clinic` to tune copy (“Sign in to clinic console”).
- [ ] Guard `/clinic/*`: unauthenticated → console login with `next=/clinic/...`.
- [ ] Reject or redirect users with only `patient` role away from `/clinic`.

**Owner:** FE + BE (guard rules in `apps/api` if server-side enforcement needed).

### Phase C — Subdomains (INT)

- [ ] Vercel: `doqto-web` (www), `doqto-web-console` (console)—or one project + middleware host rewrite.
- [ ] Env matrix in `infra/ENVIRONMENTS.md`: `WEB_PUBLIC_URL`, `CORS_ORIGINS`, cookie domain per host.
- [ ] Document OAuth redirect URIs placeholder for Phase D.

**Owner:** INT.

### Phase D — Doctor email + Google (BE + FE, new backlog)

- [ ] ADR: identity linking (phone remains canonical; email/Google as additional `authProviders`).
- [ ] Google OAuth (console only); email magic link or OTP.
- [ ] Stitch login **visual** row “Continue with Google” on console login only.
- [ ] Security review: no account takeover via unverified email; demo mode rules unchanged.

**Owner:** BE + INT + FE. **Not Phase 1 MVP** unless Raunak reprioritizes PRD.

---

## 9. Open questions for Raunak

1. **Primary domain:** `doqto.com` vs `doqto.in` (affects cookies, OAuth, marketing).
2. **Search without login:** Can patients browse doctor profiles anonymously until booking?
3. **Doctor console host for MVP:** stay on `www…/clinic` until launch, or ship `console.` immediately with DNS?
4. **“Let’s connect”:** form product (CRM), WhatsApp link, or email only?
5. **Google for doctors:** required for launch or acceptable as Phase D?

---

## 10. Success criteria

- First-time visitor sees **landing** first; **Log in** opens **patient OTP modal**; after verify, **patient home** on `/`.
- **Doctor console** is discoverable from nav without dumping users into an authenticated clinic screen.
- Clinic staff can log in with **phone OTP** and land on **`/clinic`**.
- Design stays **neumorphic / Stitch-aligned**; patient login does not advertise password/Google until product supports them.
- Plan documented for **`www` vs `console`** split before production cookie and OAuth setup.

---

## 11. Next step after approval

Turn **Phase A** into a FE implementation plan (tasks in `apps/web`: modal, `/for-doctors`, navbar i18n, post-login redirect). No backend change required for Phase A beyond optional role redirect logic already partially in `LoginFlow`.
