# 0001. One NestJS modular monolith

- Status: Accepted, 2026-10-09 (TDD sections 1 and 2)

## Context

One developer, a budget of ₹2,500 to 10,000 a month, and a product that must be usable by pilot clinics within weeks. Three clients (patient app, clinic console, admin panel) and a later native Android app need the same business rules.

## Decision

- One NestJS API process with one module per feature: auth, users, doctors, clinics, schedules, appointments, queue, status, notifications, payments, reviews, admin, jobs.
- ~~One Next.js app serves all three clients through route groups (`/`, `/clinic`, `/admin`).~~ **Amended 2026-10-26:** two Next.js apps against the one API: `apps/web` (patients) and `apps/console` (everyone else: doctors, clinics, labs, pharmacies, their staff and the Doqto team, each seeing the features for their role). They share code through `packages/ui`, `packages/i18n` and `packages/api-client`, and the contract through `packages/shared`.
- Background work runs inside the API process (`@nestjs/schedule` plus a Mongo-backed `jobs` collection with lock claims). No Redis, no broker, no worker fleet.
- External services sit behind provider interfaces in `apps/api/src/integrations` (see ADR 0006).
- One TypeScript pnpm monorepo: `apps/web`, `apps/console`, `apps/api`, `packages/shared`, `packages/ui`, `packages/i18n`, `packages/api-client`.

## Consequences

- One deploy, one log stream, one place to debug.
- Module boundaries are discipline, not network boundaries, so they are enforced with lint where they matter (ADR 0008) and in review.
- Jobs must be safe if a second API instance is ever added: claim with `findOneAndUpdate`, idempotent work.
- All business logic lives in NestJS; Next.js only renders and calls the API, which keeps the Phase 2 Android app cheap.

## When to revisit

API p95 latency above 500 ms that a bigger Render instance does not fix, or one job type starving request handling. First step then is a second instance or a separate worker process from the same codebase, not microservices.

## Amendment 2026-10-26: a separate console app (amended 2026-11-09: admin lives in it)

- **Why:** patients and the people who run the marketplace are different audiences. The console is one app for doctors, staff, labs, pharmacies and the Doqto team; the features differ by role, and the server decides access, not the screen. (It was briefly split into a separate admin app; that was a misreading of the request and was merged back on 2026-11-09.) See `docs/plans/console-and-partner-platform-plan.md`.
- **Still one API process** and one database; the modular monolith decision is unchanged.
- **One backend only.** `apps/api` is the only server. The Next.js apps are front ends: they may rewrite `/api/v1` to the API and nothing else. No route handlers, no server actions, no database or server framework in their dependencies, and no separate backend or BFF per audience. Console routes (including the admin area) are new modules and route prefixes inside the same Nest API (`/console/...`, `/admin/...`), kept apart by token audience and permission guards, not by separate processes. `tooling/architecture/one-backend.test.mjs` fails the build if this is broken.
- **Shared code is extracted, not copied**, so a fix to a button, a translation or the API client lands once.
