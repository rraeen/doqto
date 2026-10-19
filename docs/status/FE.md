# FE status (Frontend)

Owned and edited only by the FE agent. Newest entries at the top of each section.

## In progress

- Sprint 2 FE stories (FE-05 to FE-09) are built against contract 2.0.0 and the mocks, and are in review below. Not yet tried against the real API (no local MongoDB here).
- FE-01, FE-02 (round 2) and FE-03 approved by RD. FE-04 round 3 fix is in review (below).
- BE-04 requests done: refresh is single-flight per tab and across tabs (Web Locks plus a `localStorage` mark), and a refresh that lost a race (`REFRESH_INVALID` with `details.raced: true`) retries the original request instead of logging out (`src/lib/api/client.ts`, tests in `client.test.ts`).
- Demo same-origin proxy (INT request): `next.config.ts` rewrites `/api/v1/*` to `API_PROXY_TARGET` when set (must be set at build time on Vercel).
- FE-05/FE-06 photos: the API strips EXIF in `putPublic`, so FE uploads without re-encoding.

## In review

### Sprint 2 (FE-05 to FE-09)

One way to check all five, against the mocks at 360 px:

```sh
bash scripts/ops/workspace.sh sh -c 'pnpm --filter @doqto/web typecheck && pnpm lint && pnpm --filter @doqto/web test'
bash scripts/ops/workspace.sh sh -c 'cd apps/web && NEXT_PUBLIC_API_MOCKS=true NEXT_PUBLIC_DEMO_MODE=true pnpm dev'
# 1. /login?next=/clinic with any new number, code 123456, then "Join as a doctor"
# 2. /clinic/clinics/new, then add a staff number on the clinic page
# 3. Log out, log in as 99999 99999 (mock admin), /admin/doctors, approve
# 4. /search?city=Bareilly, or "Near me", then open the doctor's page
```

Checked 2026-10-10: typecheck, root lint and Prettier clean; 54 Vitest tests pass, including `src/lib/api/sprint2-flow.test.ts` (onboard, clinic, staff add/duplicate/remove, admin approve with `reviewToken`, stale token 409, search, public page; rename re-review rule; near-me ordering). A Playwright run at 360 x 740 went through steps 1 to 4 above with no page errors. Production build, first-load JS by `scripts/first-load-js.mjs` (gzip 9): `/` 170.0, `/clinic` 174.8, `/clinic/onboarding` 179.0, `/clinic/profile` 179.9, `/clinic/clinics` 174.2, `/clinic/clinics/new` 177.3, `/clinic/clinics/<id>` 180.8, `/admin/doctors` 175.1, `/admin/doctors/<id>` 178.6, `/search` 181.9, `/d/<slug>` 180.9 KB. Radix dialogs load only when a confirmation opens.

#### FE-05 Doctor onboarding
- Changed files: `src/components/doctor/**`, `src/app/clinic/{page,onboarding/page,profile/page}.tsx`, `src/components/shell/signed-in.tsx`, `src/lib/{doctor,contract-data,money}.ts`, `src/lib/api/{doctor,lazy}.ts`, `src/components/ui/{chip,file-button}.tsx`, Textarea in `ui/input.tsx`
- Notes: five steps (about, qualifications, specialties, registration, fees); steps 1 to 4 kept as a draft in `localStorage` (`doqto_doctor_draft`) until the profile is created. Registration step calls `POST /doctor/onboarding`, then `POST /auth/refresh` so the token carries `doctor`, then uploads the certificate. `/clinic` shows the status card (pending, verified, rejected with the admin's note), whether the page is live, and the `missing` checklist with links. The profile editor sends only changed fields. A verified doctor sees a warning before a real rename (same "Dr", case and spacing rule as the API), a registration change, or a new certificate, because each sends the profile back to review (BE request, contract 2.0.0).

#### FE-06 Clinic setup
- Changed files: `src/components/clinics/**`, `src/app/clinic/clinics/**`, `src/app/clinic/more/page.tsx`, `src/components/ui/confirm-sheet.tsx`, `src/lib/api/clinics.ts`
- Notes: address form, PIN check, pin from "Use my current location" or `GET /geo/geocode` suggestions (approximate ones are labelled), OpenStreetMap preview and "Open in Google Maps" link, no paid map SDK. Photos up to 6 with delete confirm. Staff added by phone (409 shows "already staff"), removed after a confirm. Read-only view for staff (`canManage: false`). PATCH sends only changed fields; `location: null` clears the pin. `/clinic/more` links to profile, clinics, the public page and the patient profile; the patient profile links to the clinic console.

#### FE-07 Admin verification
- Changed files: `src/components/admin/**`, `src/app/admin/{page,doctors/page,doctors/[id]/page}.tsx`, `src/lib/api/admin.ts`, `src/components/shell/navs.tsx` (admin Home tab removed; `/admin` redirects to the queue)
- Notes: status tabs in the URL, oldest first, "Load more" with the cursor. Detail is fetched once (no refetch on focus, since each view is audit-logged and mints a link). Certificate previews inline when it is an image, else "Open in new tab"; when the 5-minute link expires the page offers "Get a new link". Decisions send `reviewToken`; a 409 reloads the detail and says the profile changed. Reject needs a note of 5 or more characters. Approve is disabled without a certificate. Non-admins get a clear "admins only" state. The page sets `referrer: no-referrer`.

#### FE-08 Public doctor profile
- Changed files: `src/app/(patient)/d/[slug]/{page,not-found}.tsx`, `src/components/doctor-page/**`, `src/lib/api/server.ts`, `src/lib/env.ts` (`NEXT_PUBLIC_SITE_URL`), `src/app/layout.tsx` (`metadataBase`), `next.config.ts` (`images.remotePatterns` from `R2_PUBLIC_BASE_URL`)
- Notes: server-rendered with no client component of its own (only `next/image`); title "Name, Specialty in City", description, canonical and Open Graph; JSON-LD `Physician` with address, geo, phone and price, `<` escaped (test). Shows qualifications, clinics with directions and call, consultation fee, booking fee, "New on Doqto" until there are reviews, placeholders for live status and booking. Unknown slugs get a 404 page. Photos are optimised only from the public R2 host; other hosts (demo storage) load unoptimised. In mock mode only, a slug the server cannot see (created in this browser) is looked up through MSW before showing "not found".

#### FE-09 Search
- Changed files: `src/components/search/search-page.tsx`, `src/app/(patient)/search/page.tsx`, `src/lib/api/doctors.ts`
- Notes: city, specialty and name filters live in the URL; the last city is remembered on the phone. "Near me" asks for location; on denial, no support, timeout or a point outside India it says so and falls back to the city. Coordinates never go in the URL (`near=1` asks again). Cards show distance, fee, "New on Doqto" and "Availability coming soon". Infinite scroll with the cursor (IntersectionObserver, with a button fallback).

### Sprint 1 (FE-01 to FE-04)

All four stories live in `apps/web`. One way to check all of them:

```sh
bash scripts/ops/workspace.sh sh -c 'pnpm --filter @doqto/web typecheck && pnpm lint && pnpm --filter @doqto/web test'
# Run against the MSW mocks (no API needed), in a 360 px wide window:
bash scripts/ops/workspace.sh sh -c 'cd apps/web && NEXT_PUBLIC_API_MOCKS=true NEXT_PUBLIC_DEMO_MODE=true pnpm dev'
# then open http://localhost:3000/login, any Indian mobile, code 123456
```

Checked 2026-10-10 (round 2): typecheck, root lint and Prettier clean; 35 Vitest tests pass; a Playwright run at 360 x 740 against the mocks went through phone, wrong code ("4 attempts left"), `123456`, welcome and name, Hindi switch (survives reload), clinic page and logout with no unexpected errors.

### FE-04 Login and profile screens
- Changed files: `src/app/(auth)/**`, `src/app/(patient)/profile/page.tsx`, `src/components/auth/**`, `src/components/profile/profile-view.tsx`, `src/lib/session.ts`, `src/lib/api/messages.ts`, `src/lib/install-id.ts`, `src/lib/demo.ts`
- How to test: `bash scripts/ops/workspace.sh pnpm --filter @doqto/web exec vitest run login-flow` (invalid number, demo hint, attempts left, lockout after 5, rate limit on the 4th request, safe `next` redirect), then the manual run above.
- Notes for the reviewer:
  - The `123456` hint shows only when `otp/request` returns `channel: 'demo'`, i.e. when the API itself is in demo mode, so a live API never shows it even if the web flag is wrong.
  - WhatsApp consent checkbox is on by default with clear text; it is sent as `whatsappOptIn` on verify and the API applies it only when the account is created (contract v0).
  - New users go to `/profile?welcome=1` to add a name, then on to `next` or `/`.
  - **Round 3 (RD blocker, dot segments):** `safeNext` also rejects a result whose pathname starts with `//`, so `/.//evil.com`, `/..//evil.com`, `/%2e//evil.com` and `/a/..//evil.com` are dropped, while `/clinic/./profile` becomes `/clinic/profile` (`login-flow.test.tsx`).
  - **Round 2 (RD blocker, open redirect):** `safeNext` now resolves `next` with `new URL(next, location.origin)` and keeps it only if the origin is unchanged, returning path, query and hash. Tests cover `/\evil.com`, `/\/evil.com`, `//evil.com`, `https://evil.com`, `javascript:`, relative and empty values (`login-flow.test.tsx`). Checked in a browser too: `/login?next=/%5C%5Cevil.com` lands on `/profile?welcome=1` with no `next`.
  - Resend unlocks after 30 s; locked or expired codes disable Verify and show Resend straight away. Error copy branches on contract error codes only.
  - Language: a new user keeps the language picked before signup (`PATCH /me`); a returning user's saved language is applied on login. The header switch also saves to `/me` when signed in.
  - Logout clears the cached user even if the network call fails (the access cookie expires in 15 minutes).
  - Should work against the real API once BE-04 lands: it uses only `@doqto/shared` schemas and `ENDPOINTS`, plus cookies with `credentials: 'include'`. Not yet tried against the real API.

### FE-03 Mock API layer
- Changed files: `src/mocks/**`, `public/mockServiceWorker.js` (generated by `msw init`), `src/lib/api/auth.ts`, `src/lib/api/health.ts`, `src/lib/api/auth.test.ts`
- How to test: `bash scripts/ops/workspace.sh pnpm --filter @doqto/web exec vitest run auth.test`
- Notes for the reviewer:
  - Hand-written MSW handlers for every v0 endpoint. They validate request bodies with the shared request schemas (400 `VALIDATION_FAILED` with `details.issues`) and parse every response with the shared response schema before sending, so a mock cannot drift from the contract.
  - Mocks behave like demo mode: fixed `123456`, 5 attempts then `OTP_LOCKED`, 3 requests per 10 minutes then `RATE_LIMITED` with `retryAfterSeconds`, used codes cannot be replayed. State is kept in `localStorage` (`doqto_mock_db`) so a reload keeps you signed in.
  - Switched on only by `NEXT_PUBLIC_API_MOCKS=true`; MSW is loaded with a dynamic import, so it is not in the normal bundle. `msw/browser` has no server build, so `next.config.ts` aliases it to a stub for the SSR pass only.
  - Typed client functions parse responses with the shared Zod schemas and throw `ContractError` on mismatch; non-2xx bodies are parsed with `ApiErrorSchema` into `ApiError { status, code, details }`.
  - `vitest 5` warns about an unmet peer `msw@^2` (from `@vitest/mocker`). That integration is only used by Vitest browser-mode module mocking, which we do not use; MSW 3 works in our Node tests and in the browser.

### FE-02 Design system and app shell
- Changed files: `src/app/globals.css` (Tailwind v4 `@theme` tokens), `src/components/ui/**`, `src/components/shell/**`, `src/i18n/**`
- How to test: `bash scripts/ops/workspace.sh pnpm --filter @doqto/web exec vitest run translate` (Hindi has every English key and the same placeholders), then look at `/`, `/clinic`, `/admin` at 360 px.
- Notes for the reviewer:
  - Components: Button (`lg` is 56 px tall and full width, for front-desk actions), Input and Field (label, hint, error wired with `aria-describedby`), PhoneInput (+91, outputs E.164), OtpInput (6 boxes, paste and SMS autofill), Card, Badge, Sheet (bottom sheet on phones), Toast (sonner), EmptyState, Skeleton, Switch, Checkbox. shadcn/ui style (cva and tailwind-merge) written in place; Radix only for the dialog.
  - Bottom nav for patient and clinic; admin gets a tab bar. Nav targets whose stories have not landed show a "Coming soon" page so nothing 404s.
  - i18n: `src/i18n/messages/{en,hi}.ts`, typed keys, `{param}` interpolation. Language lives in the `doqto_lang` cookie so server components render the right language with no flash, and in `/me` for signed-in users.
  - System font stack (Android ships Noto Sans Devanagari); a subset web font is FE-32.
  - **Round 2 (RD blocker, budget):** RD's measurement was right; my earlier 167 KB figure undercounted. Zod and the shared schemas are now off the first load: client components call the API through `src/lib/api/lazy.ts`, which dynamic-imports the client on the first call, and contract constants (`OTP_LENGTH`, `NAME_MAX`) are passed as props from server pages. With RD's method, now scripted as `apps/web/scripts/first-load-js.mjs` (every `<script src>` except `noModule`, gzip level 9, exits 1 over 200 KB), a production build measures **168.8 KB** on `/`, `/clinic`, `/admin`, **172.5 KB** on `/login` and **175.8 KB** on `/profile`. No first-load chunk contains Zod.
  - To measure: `bash scripts/ops/workspace.sh sh -c 'cd apps/web && NEXT_PUBLIC_DEMO_MODE=true pnpm build && (pnpm start &) && sleep 5 && node scripts/first-load-js.mjs'`

### FE-01 Next.js app skeleton
- Changed files: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.mts`, `vitest.setup.ts`, `src/app/layout.tsx`, `src/app/providers.tsx`, `src/app/(patient)/**`, `src/app/clinic/**`, `src/app/admin/**`, `src/components/demo-banner.tsx`, `src/lib/env.ts`, `src/lib/api/client.ts`, `src/lib/api/errors.ts`
- How to test: `bash scripts/ops/workspace.sh sh -c 'cd apps/web && pnpm build && pnpm start'`, then open `/`, `/clinic`, `/admin`.
- Notes for the reviewer:
  - Next.js 16.4 App Router (Turbopack), Tailwind 4, TanStack Query 5, React 19. Route groups: `(patient)` at `/`, `(auth)` for `/login`, plus `/clinic` and `/admin`.
  - No server actions or route handlers (TDD 9.2). The API client reads `NEXT_PUBLIC_API_URL`, sends cookies (`credentials: 'include'`), and on 401 calls `/auth/refresh` once (shared by concurrent calls) and retries.
  - Demo banner with the exact TDD 13 text on every screen when `NEXT_PUBLIC_DEMO_MODE=true`, in English or Hindi.
  - `next.config.ts` loads the repo-root `.env`, so the web app uses the same env file as the API. No app-level ESLint config; the root config covers `apps/web`.
  - `@doqto/shared` is consumed as TypeScript source through a tsconfig path alias (also set in Vitest), so FE does not need `packages/shared` built first.

## Done

<!-- - STORY-ID short title (approved in docs/reviews/STORY-ID.md, date) -->
- FE-01 Next.js app skeleton (approved in docs/reviews/FE-01.md, 2026-10-10)
- FE-02 Design system and app shell (approved round 2 in docs/reviews/FE-02.md, 2026-10-10)
- FE-03 Mock API layer (approved in docs/reviews/FE-03.md, 2026-10-10)

## Blockers

- None.

## Requests to other workstreams

- To BE (for BE-04): please allow credentialed CORS from `http://localhost:3000` (and the demo web origin later); the web client relies on the `doqto_at` and `doqto_rt` cookies.
- To BE (FYI): mocks now mirror contract 2.0.0 (`reviewToken`, rename and new-certificate re-review, onboarding once per user). FE still uses the tsconfig path alias for `@doqto/shared`; switching to the new `source` export is a later cleanup.
- To BE (FYI, no change needed): FE reads `@doqto/shared` from `src/` through a path alias because the package `exports` point only at `dist/`. A `"source"` export condition would let FE drop the alias, if you prefer.
- To INT (FYI): `apps/web` added dependencies through `workspace.sh --write-lock`; `jsdom` is pinned to `^27` because `jsdom@30` needs Node 22.22.2+ and `engine-strict` is on.
