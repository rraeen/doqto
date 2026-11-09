# Patient frontend audit

**Date:** 2026-10-20
**Scope:** the patient web app (`apps/web`, PWA) before backend integration. Doctor console and admin are out of scope except where noted.
**Method:** route and code inspection, `typecheck`, `eslint`, `vitest`, and 360px Puppeteer sweeps (overflow, tap targets, text size) run during the UI work. **Not run:** Lighthouse, axe, real-device testing on iOS, screen-reader testing.

---

## 1. Verdict

The patient screens are **visually complete and consistent** (neumorphic green theme, English/Hindi, responsive, installable PWA). They are **not yet a product**: every patient feature that changes or shows personal data (booking, appointments, prescriptions, records, chat) is **demo data in the browser**, and a few Phase 1 journeys are missing entirely (reviews, live queue tracking, cancelling, notification centre).

Frontend is roughly **85% done on UI, ~40% done on being ready for a real backend.**

## 2. Health checks

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Pass |
| ESLint | Pass (two errors fixed during this audit: an unused variable in `appointments-page.tsx`, an unused disable comment in `offline/page.tsx`) |
| Unit tests | 99 of 101 pass. The two failures are the OTP rate-limit tests: `OTP_REQUEST_LIMIT` in `packages/shared/src/auth.ts` was changed to 10 (uncommitted), the tests expect 3. Decide which is right and align them. |
| English / Hindi message keys | 655 / 655, no gaps |
| Horizontal overflow at 360px | None on the pages swept (patient, doctor, signed out) |
| Text under 12px | None found |
| Automated tests for UI | 15 test files, mostly lib logic. No end-to-end, no accessibility tests, no visual tests. |

## 3. What is built (patient)

Landing, For doctors, Get the app, Privacy policy, Login (phone + OTP, modal and page), Home, Search, Doctor profile, Book a visit, Booking confirmation, Appointments, Prescription view and download, Records (with filters), Consult list and chat (attachments, voice-to-text), Profile and Edit profile, Help, Offline page, installable PWA (manifest, service worker, install prompt and guide).

## 4. What is missing or incomplete

### P0 – blocks a real launch

1. **Patient data is not connected to any API.** `lib/api` has clients for auth, doctors, clinics, admin, health and messages only. Bookings (`demo-bookings.ts`), chats (`demo-consults.ts`), appointments, prescriptions and records come from browser storage or sample data. Needed: an appointments API client (list, create, cancel, reschedule), loading / error / retry states on each screen, and removal of the demo stores from production paths.
2. **No real cancel or reschedule.** "Reschedule" only opens the doctor's page. There is no cancel button on an appointment, and no cancel-with-confirmation flow (a `ConfirmSheet` component exists but is unused here).
3. **No reviews.** Reviews are a Phase 1 pillar in the PRD, but a patient cannot rate a doctor after a visit. The doctor page shows a rating summary when data exists, but there is no review submission and no list of reviews.
4. **No live queue tracking for a booked visit.** The doctor page shows a live status line, but a patient with a booking has no "you are next / ~15 min delay" view. The Home "delay alert" card is static text.
5. **No notification centre.** The bell only jumps to the Home reminders section. There is no history, unread count or push.
6. **Legal and data-rights gaps (DPDP Act 2023).** No Terms page (the footer "Terms" link goes to Help). The privacy policy is a draft with no grievance officer or contact details. There is no "delete my account" or "download my data" in Profile.
7. **Scope decision: Records, Consult and Prescriptions.** ADR 0007 forbids clinical data in Phase 1, yet these are first-class tabs and navigation items. Decide before launch whether to hide them in production or keep them as clearly labelled previews. Today they are gated only by `NEXT_PUBLIC_DEMO_MODE` or non-production builds.
8. **Demo data is not labelled.** The "example data" notes on Appointments and Records, and the demo banner, are currently commented out or removed. A deployment with `NEXT_PUBLIC_DEMO_MODE=true` would show invented appointments and chats as if real. Keep a clear label, or make sure demo mode can never be on in production.

### P1 – needed for a commercial-quality app

9. **Search is basic.** Missing: filters for fee, language and "open now", sorting, pagination or infinite scroll, recent searches, and saved (favourite) doctors.
10. **Booking for family.** No way to book on behalf of a parent or child, which is common in India. Decide if this is Phase 1.
11. **Payment.** The confirmation screen shows a payment summary but there is no payment step or "pay at clinic" choice in the flow. Define what Phase 1 does.
12. **Accessibility not verified.** No axe or screen-reader pass. Known items: the new filter dropdown has no arrow-key navigation, a few controls are still under 44px ("View all", Copy ID, some text links), muted text on the green gradient needs a contrast check, and focus handling in sheets and the chat needs a test.
13. **Hindi quality.** All 655 keys exist, but the Hindi has not been reviewed by a native speaker, and the privacy policy Hindi is new.
14. **Error and empty states are uneven.** Offline page and route error boundary exist, but not every screen has a retry state, and search and doctor page fall back to sample doctors in dev.
15. **Primary button colour.** The primary button is now dark green with white text (changed in `globals.css`), after the audit's "neon green" concern and the `#87D554` theme request. Confirm the final brand colour and check contrast everywhere it is used.
16. **PWA polish.** Icons still use the old green. Missing: iOS splash images, manifest screenshots and shortcuts, and web push (needs backend). One-tap install needs an HTTPS domain.
17. **Chat limits.** Voice input works in Chrome, Edge and Safari only. Attachments store only name and size. Real attachments need backend storage and a clinical-data decision.

### P2 – hardening and hygiene

18. **Security headers.** No Content-Security-Policy, X-Frame-Options, Referrer-Policy or Permissions-Policy (only the service worker has headers). `public/mockServiceWorker.js` ships in the production build.
19. **SEO and sharing.** Open Graph exists on the root layout, but there is no `sitemap.xml`, `robots.txt`, or per-doctor share image and metadata.
20. **Monitoring.** No analytics (funnel: landing → login → search → profile → book) and no error reporting.
21. **Performance not measured.** Run Lighthouse on landing, search and doctor pages. The chat uses plain `<img>` for previews. Check font loading and bundle size.
22. **Tests.** Add end-to-end tests for the golden path (login → search → book → appointments), and an axe check in CI.
23. **Code hygiene.** Commented-out blocks remain (greeting heading, sample notes). Prettier and line endings are inconsistent (CRLF in some files).
24. **Repository state.** Only the initial import is committed. All frontend work is uncommitted. `.env.example` contains database credentials and must be cleaned before any commit or push.

### Environment (not product)

25. The phone could not load the dev server on the same Wi-Fi. Likely cause: the Windows network is "Public" with no inbound rule for port 3000 (and 4000). Still unresolved.
26. The OTP rate limit blocks repeated test sign-ins during development.

## 5. Design items still open

- Stitch screens not built or not checked: sign-up variants, the booking-success popup variant, some dashboard variants.
- Profile no longer repeats navigation, but there is no settings area (notification preferences, language, delete account).
- Clinic console `Queue` and `Schedule` are "coming soon" (doctor side; mentioned because patients depend on live status).

## 6. Suggested order

1. Decide scope (item 7) and demo labelling (item 8).
2. Agree the appointments, reviews, notifications and queue API contracts with backend; add them to `@doqto/shared`.
3. Build the missing patient journeys: cancel and reschedule, reviews, live queue view, notification centre.
4. Replace demo stores with API hooks, add loading, error and empty states.
5. Legal: Terms page, final privacy policy, delete account and data export.
6. Accessibility pass (axe + keyboard + screen reader), then Lighthouse and performance fixes.
7. Security headers, sitemap and robots, analytics, error reporting.
8. End-to-end tests, then commit and open a PR (after cleaning `.env.example`).

## 7. Review log

| Date | Author | Notes |
| --- | --- | --- |
| 2026-10-20 | Claude (agent) | First patient-frontend audit. Fixed two lint errors found during the audit. |
