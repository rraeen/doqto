# Doqto UI commercial readiness audit

**Status:** Draft for Raunak review  
**Date:** 2026-10-20  
**Related:** [PRD](../PRD.md), [entry flow plan](./entry-flow-and-subdomains.md), [Stitch designs](../design/stitch/README.md), [ADR 0007 no clinical data](../adr/0007-no-clinical-data-phase-1.md)

---

## 1. Executive summary

The web app is **roughly 60–70%** of the way to a polished, commercial consumer health product **visually**. The neumorphic green system is coherent; the landing page and auth shell are on-brand. What blocks “production-ready” is not mainly aesthetics—it is **unfinished core journeys**, **navigation that oversells Phase 1 scope**, pervasive **“coming soon”** copy, and missing **production UX layers** (loading, errors, trust/legal).

**Verdict:** Narrow surface area, finish the patient golden path, then refine typography and contrast—not more neumorphism on every screen.

---

## 2. What already works

| Area | Evidence |
| --- | --- |
| Design tokens | `apps/web/src/app/globals.css` — brand `#13ec13`, surfaces, `neu-*` utilities |
| Landing | `components/landing/landing-page.tsx` — hero, why/how, CTA, footer |
| Component library | Button, Field, Card, EmptyState, Sheet, OTP/phone inputs |
| i18n | EN/HI via `i18n/messages/*` |
| Auth UX | Phone → OTP (`login-flow`, neumorphic auth layout) |
| Search structure | City, specialty, near-me, doctor cards (`search-page.tsx`) |
| Demo safety | `DemoBanner` when `NEXT_PUBLIC_DEMO_MODE=true` |

---

## 3. Critical gaps (P0 — launch credibility)

### 3.1 Core patient loop feels like a demo

- Search list shows **“Availability coming soon”** (`search.availabilitySoon`).
- Booking / live status strings use **“coming soon”** in `i18n/messages/en.ts`.
- **Fix:** Complete demo path: **search → profile → book (demo pay) → appointment → status**, or hide CTAs until real. Label demo data explicitly; avoid “coming soon” on every card.

### 3.2 Bottom nav vs Phase 1 product

Current patient nav (`components/shell/navs.tsx`):

- Home · Appointments · **Records** · **Consult** · Profile  
- **No Search / Find doctor** in primary nav.

PRD Phase 1: discovery, booking, live status, reviews—not records, chat, or telehealth UI.

**Fix (recommended):** **Home · Search · Appointments · Profile**. Demote or remove **Records** and **Consult** from nav until product and legal sign-off (ADR 0007).

### 3.3 Scope vs trust (Records, Consult, Prescription)

Routes exist under `(patient)/records`, `(patient)/consult`, prescription views—aligned with Stitch explorations, **not** Phase 1 MVP.

**Fix:** Hide from nav for launch, or single “Coming later” in settings—not equal tabs. Avoid implying clinical records/chat before DPDP review.

### 3.4 Clinic console incomplete

`/clinic/queue` and `/clinic/schedule` use `ComingSoon`. Doctors judge the product on the console.

**Fix:** Ship **Today + status + check-in** as MVP; defer full schedule UI or show read-only seeded schedules.

### 3.5 Missing production UX shell

- No app-wide `loading.tsx` / `error.tsx` (only `d/[slug]/not-found.tsx`).
- Inconsistent skeleton usage on slow routes.

**Fix:** Route-level loading and error boundaries; reuse `EmptyState` and i18n error copy.

---

## 4. Visual and brand polish (P1)

| Issue | Location / note | Direction |
| --- | --- | --- |
| No brand font | System stack in `globals.css`; Stitch uses **Manrope** | `next/font` — Manrope + Noto Sans Devanagari for HI |
| Theme color mismatch | `layout.tsx` `themeColor: #0f766a` vs brand `#13ec13` | Align PWA/browser chrome with brand |
| Neumorphism everywhere | Lists, dense app screens | Neumorphic **marketing + auth**; **flatter cards** in search/appointments |
| Bright green fills | `#13ec13` on buttons | Accents on `#13ec13`; text/actions on light surfaces use `brand-600/700` (WCAG) |
| Placeholder home blocks | `home-dashboard.tsx` gradients + icons | Real next-visit data or intentional empty illustrations |
| Sample doctors without city | `search-page.tsx` + `SAMPLE_DOCTORS` | First-visit city prompt + clear demo banner |
| Nav inactive state | `bottom-nav.tsx` `opacity-50` | Prefer color/weight over heavy fade (a11y) |
| Copy consistency | Landing “Login” vs “Log in” | Standardize EN strings |

### Stitch alignment

- Local mirrors: `docs/design/stitch/unified-healthcare-login-screen-a1c9f94a/`
- Gaps vs mock: Manrope/Material Symbols; patient auth is **OTP** (correct for TDD)—not password/Google on www until product decides
- Add **trust footer** on landing/auth: privacy, terms, grievance (DPDP expectation)

---

## 5. Information architecture (target)

### Patient (`www.doqto.com` / `/`)

1. Public **landing** (SEO)  
2. **Login modal** (primary); `/login?next=` for deep links  
3. **Home** — next visit, search entry  
4. **Search → doctor profile (`/d/[slug]`) → book**  
5. **Appointments**, **Profile**

### Doctor (`console.doqto.com` or `/clinic`)

1. **`/for-doctors`** marketing + CTA  
2. Console **login** (Stitch neumorphic; Phase 1 phone OTP)  
3. **`/clinic`** today, status, queue (MVP)

See [entry-flow-and-subdomains.md](./entry-flow-and-subdomains.md).

---

## 6. Micro-UX and consistency

- Landing: multiple “Find a doctor” CTAs — OK for marketing; reduce redundancy on small screens if needed.
- Patient layout: **top nav + bottom nav** on search — verify 5-tab pill isn’t cramped on narrow devices.
- Home quick action **Consult / Talk** — promises chat before it is a pillar; remove or gate.
- **Admin**: keep off public nav; polish when ops use daily.

---

## 7. Production checklist (user-visible)

- [ ] Privacy policy, terms, grievance officer links in footer  
- [ ] Open Graph / Twitter cards for landing and doctor profiles  
- [ ] PWA manifest icons matching `Logo`  
- [ ] `prefers-reduced-motion` for animations  
- [ ] Focus trap and keyboard flow on login modal + OTP  
- [ ] `next/image` and LCP on hero/doctor photos  
- [ ] Funnel analytics: landing → login → search → profile → book  

---

## 8. Priority roadmap

### P0 — Launch credibility

1. Nav: **Search** in primary nav; demote Records/Consult  
2. Replace **“coming soon”** on search/booking with complete demo flow or hidden CTAs  
3. Footer + auth: **trust/legal** links  
4. Font + **themeColor** + contrast pass on green  

### P1 — Commercial polish

5. **Dual visual mode:** marketing neumorphic vs app flat  
6. Home: real **next visit** + status widget  
7. Doctor profile: status strip + book CTA (demo OK)  
8. Global **loading/error** boundaries  

### P2 — Differentiation

9. Stitch **post-login home** (`unified-healthcare-home-dashboard-*`)  
10. Clinic console from **neumorphic dashboard** Stitch screens  
11. Login modal + `/for-doctors` per entry-flow plan  

---

## 9. Owners (workstream)

| Work | Owner |
| --- | --- |
| Nav, home, search, profile, modal, fonts, contrast | **FE** (`apps/web/**`) |
| Booking/status API wiring for real UI | **BE** + FE |
| Footer legal URLs, env, PWA, OG defaults | **INT** + RD |
| Scope gate (Records/Consult in Phase 1?) | **Raunak** + RD |

---

## 10. Review log

| Date | Author | Notes |
| --- | --- | --- |
| 2026-10-20 | Agent audit | Based on `localhost:3000` + codebase review |
