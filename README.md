# Doqto

Doqto helps patients in Tier-2 and Tier-3 Indian cities find a verified doctor, book a slot, see live "is the doctor in, how long is the wait" status, and leave a review that only a real, verified visit can produce.

Phase 1 is one NestJS API on MongoDB serving one Next.js app that installs as a PWA. The same app has three faces:

- **Patient app** (`/`): search, doctor profile, book, pay, live status, review.
- **Clinic console** (`/clinic`): schedule, day sheet, check-in, queue, status buttons. Built for a cheap Android phone at the front desk.
- **Admin panel** (`/admin`): verify doctors, moderate reviews, handle appeals and refunds.

## Repository layout

```
apps/
  web/          Next.js App Router, Tailwind, shadcn/ui, TanStack Query (FE)
  api/          NestJS REST API, /api/v1, Swagger at /api/docs (BE)
    src/integrations/   provider interfaces + Demo and live adapters (INT)
packages/
  shared/       API contract: Zod schemas, types, enums, CONTRACT.md (BE)
infra/          Render, Vercel and environment notes (INT)
scripts/        seed and ops scripts
docs/           working agreement, ADRs, reviews, guides (RD)
BACKLOG.md      sprint plan and stories
```

Design sources, in the project's shared folder one level up:

- `doqto-technical-design.md` (the TDD): architecture, rules, flows.
- `doqto-database-design.md` (the DB doc): every collection, field and index.

## Run it locally

Toolchain: Node 22 (`.nvmrc`), pnpm 10.28 (pinned in `package.json`), TypeScript ~6.0, ESLint 10 (flat config), Prettier 3. Docker is needed only for MongoDB.

**The shared project folder cannot run installs.** It is a network (FUSE) mount with no symlinks and no exec bit, so `node_modules` can never live in it. Every command goes through the workspace script, which mirrors the folder to a local copy (`~/.doqto-work` by default), installs there, and runs the command:

```bash
bash scripts/ops/workspace.sh                      # sync and install only
bash scripts/ops/workspace.sh pnpm test            # sync, install, run
DOQTO_WORK=~/my-copy bash scripts/ops/workspace.sh pnpm dev
```

Edit files in the shared folder, never in the local copy: the copy is overwritten on the next run. Once the code moves to a GitHub repository, a normal clone runs the commands below directly.

First run:

```bash
cp .env.example .env                               # defaults are set for demo mode
docker compose up -d                               # MongoDB, single-node replica set (INT-05)
bash scripts/ops/workspace.sh pnpm dev             # API on :4000, web on :3000
```

Commands (prefix each with `bash scripts/ops/workspace.sh`):

| Command | What it does |
| --- | --- |
| `pnpm dev` | API and web with hot reload |
| `pnpm build` | Build every workspace |
| `pnpm typecheck` | `tsc --noEmit` everywhere |
| `pnpm lint` | One root ESLint run, including the reviews/ranking must-not-import-payments rule |
| `pnpm format:check` | Prettier check (`pnpm format` to fix) |
| `pnpm test` | Tooling tests, then unit tests in every workspace |
| `pnpm test:e2e` | e2e tests (in-memory MongoDB) |
| `pnpm ci:local` | The same steps CI runs; run before marking a story In review (INT-04) |

Swagger UI is at `http://localhost:4000/api/docs` and health at `http://localhost:4000/api/v1/health`.

## Demo mode

Until the WhatsApp BSP, MSG91 DLT and Razorpay KYC paperwork is done, Doqto runs in demo mode:

- `PROVIDER_MODE=demo` picks `Demo*` providers at startup. There is no header, query flag or endpoint that turns it on or off.
- Login OTP and walk-in OTP are always `123456`. Attempt limits and rate limits still apply.
- WhatsApp and SMS are not sent. They are written to the notifications outbox and shown in the in-app **Demo inbox**.
- Payment is a "Pay ₹15 (demo)" button that drives the same confirmation path as the Razorpay webhook.
- Every screen shows: "Demo: no real messages or payments. Do not enter real patient details."
- The API refuses to start in demo mode unless the database name starts with `doqto_demo`.

Because a fixed OTP lets anyone log in as anyone, demo mode only ever runs on its own deployment and its own database. See `docs/adr/0006-demo-mode-via-providers.md`.

## Working on Doqto

Four workstreams (Frontend, Backend, Integration, Review + Docs) build in parallel, each writing only to the folders it owns. Read `docs/CONTRIBUTING.md` before changing anything. Decisions that are settled are in `docs/adr/`; please do not reopen them inside a story.
