# 0001. One NestJS modular monolith

- Status: Accepted, 2026-10-09 (TDD sections 1 and 2)

## Context

One developer, a budget of ₹2,500 to 10,000 a month, and a product that must be usable by pilot clinics within weeks. Three clients (patient app, clinic console, admin panel) and a later native Android app need the same business rules.

## Decision

- One NestJS API process with one module per feature: auth, users, doctors, clinics, schedules, appointments, queue, status, notifications, payments, reviews, admin, jobs.
- One Next.js app serves all three clients through route groups (`/`, `/clinic`, `/admin`).
- Background work runs inside the API process (`@nestjs/schedule` plus a Mongo-backed `jobs` collection with lock claims). No Redis, no broker, no worker fleet.
- External services sit behind provider interfaces in `apps/api/src/integrations` (see ADR 0006).
- One TypeScript pnpm monorepo: `apps/web`, `apps/api`, `packages/shared`.

## Consequences

- One deploy, one log stream, one place to debug.
- Module boundaries are discipline, not network boundaries, so they are enforced with lint where they matter (ADR 0008) and in review.
- Jobs must be safe if a second API instance is ever added: claim with `findOneAndUpdate`, idempotent work.
- All business logic lives in NestJS; Next.js only renders and calls the API, which keeps the Phase 2 Android app cheap.

## When to revisit

API p95 latency above 500 ms that a bigger Render instance does not fix, or one job type starving request handling. First step then is a second instance or a separate worker process from the same codebase, not microservices.
