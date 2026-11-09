# Working agreement

How four agents (and Raunak) build Doqto in one shared folder without stepping on each other. This file restates BACKLOG.md sections 1 and 2; if they ever disagree, BACKLOG.md wins and RD fixes this file.

## 1. Who owns what

Only the owner writes inside its folders. Everyone may read everything.

| Code | Workstream | Owns |
| --- | --- | --- |
| **FE** | Frontend: patient PWA, the console (doctors, staff, labs, pharmacies, admin), and the shared front-end packages | `apps/web/**`, `apps/console/**`, `packages/ui/**`, `packages/i18n/**`, `packages/api-client/**` |
| **BE** | Backend (NestJS + MongoDB) and the API contract | `apps/api/**` except `apps/api/src/integrations/**`; `packages/shared/**` |
| **INT** | Integration (providers, webhooks plumbing, hosting, CI, backups) | root config (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, lint config, `.env.example`, `docker-compose.yml`), `apps/api/src/integrations/**`, `infra/**`, `.github/**`, `scripts/ops/**` |
| **RD** | Review + Docs | `docs/**`, root `README.md` |
| Coordinator | Planning | `BACKLOG.md` (no one else edits it) |

Need a change in someone else's folder? Write it under **Requests to other workstreams** in your own status file, naming the file and the change. The owner makes it. RD also lists such requests in review notes.

Boundaries that hold inside the code, not just the folders:

- `packages/shared` is the **API contract**. FE and INT import request and response types from it and never redefine them locally.
- Business code reaches WhatsApp, SMS, payments and storage only through the provider interfaces in `apps/api/src/integrations` (INT owns them; BE injects them).
- Nothing under `apps/api/src/reviews/**` or `apps/api/src/ranking/**` may import `apps/api/src/payments/**`. Lint enforces it; RD checks it in every review.

## 2. Which document wins

1. **ADRs in `docs/adr/`**: settled decisions. Not reopened inside a story.
2. **DB doc** (`doqto-database-design.md`) for collections, field names, enums and indexes. It is newer and more detailed than TDD section 3.
3. **TDD** (`doqto-technical-design.md`) for flows, rules, API routes and everything else.
4. **BACKLOG.md** for scope, acceptance criteria and who does what.

Known places where TDD section 3 and the DB doc differ are listed in `docs/reviews/design-doc-differences.md`; follow the DB doc column unless an ADR says otherwise.

## 3. How a story moves

1. **Ready**: its dependencies are Done.
2. **In progress**: the owner works only in its folders and logs progress in `docs/status/<FE|BE|INT|RD>.md`.
3. **In review**: the owner adds an "In review" entry to its status file with the story id, the changed files, and exact commands to test it. Run `pnpm ci:local` first (once INT-04 lands).
4. **Review**: RD checks the story against its acceptance criteria, the TDD, and `docs/review-checklist.md`, and writes `docs/reviews/<story-id>.md` with a verdict:
   - **Approved**: Done.
   - **Changes requested**: the owner fixes the listed blockers and moves it back to In review with a note of what changed. RD re-reviews only the delta.
5. **Done**: RD approved, every acceptance criterion holds, typecheck, lint and tests pass. RD records it in `docs/status/RD.md`; the coordinator ticks it in BACKLOG.md.

Severity in review notes:

- **Blocker**: an acceptance criterion fails, a checklist "never" item is broken (security, privacy, trust rule, demo safety), or tests fail. Must be fixed before Done.
- **Should fix**: a real defect or gap that does not break a criterion. Fixed in this story or logged as a follow-up with an owner.
- **Nit**: style or naming. Owner's call.

## 4. Definition of Done (every code story)

- TypeScript strict, no `any` in new code (use `unknown` and narrow).
- Unit tests for logic; e2e tests where the story says so.
- No patient data in logs: phone, OTP, visit code, tokens, authorization headers.
- DTOs validated with `whitelist: true` and `forbidNonWhitelisted: true`.
- Swagger updated for any API change, and `packages/shared` updated first.
- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.

## 5. Conventions

- **Money**: integer paise. Never floats, never rupees in the API.
- **Time**: ISO 8601 strings in the API, `Date` (UTC) in Mongo. A clinic day is an IST `YYYY-MM-DD` string. Render in IST.
- **Phones**: E.164 (`+919876543210`).
- **IDs**: Mongo `ObjectId` as a 24-character hex string in the API. Public doctor URLs use the slug, never the id.
- **Errors**: one error envelope from `packages/shared` with a stable machine `code`; clients branch on `code`, never on message text.
- **Lists**: cursor pagination `?cursor=&limit=20`.
- **No clinical data**: no diagnosis, prescription, report or treatment fields anywhere (ADR 0007).
- **Copy**: no precise wait promises; show ranges (TDD 6.3). English and Hindi for anything patients or clinic staff read.

## 6. Shared folder hygiene

- **Run every command through `bash scripts/ops/workspace.sh <cmd>`** (for example `bash scripts/ops/workspace.sh pnpm test`). The shared folder is a FUSE mount with no symlinks and no exec bit, so `pnpm install` cannot run in it. The script mirrors the folder to `~/.doqto-work` (or `$DOQTO_WORK`), installs there and runs the command.
- Edit only in the shared folder. The local copy is overwritten on each run and nothing in it is copied back, except `pnpm-lock.yaml` when you pass `--write-lock` after adding a dependency (INT owns the lockfile; say so in your status file when you do this).
- Each app provides `dev`, `build`, `typecheck` (`tsc --noEmit`), `test` and optionally `test:e2e` scripts; the root runs them across workspaces. Linting is one root ESLint config owned by INT, so apps do not add their own ESLint config; ask INT for rule changes.
- Apps extend `tsconfig.base.json` (`"extends": "../../tsconfig.base.json"`) and set their own module settings.
- There is no git yet. Re-read a shared file just before editing it, keep edits small, and read it back after.
- Never treat `node_modules`, `dist`, `.next` or coverage output as source.
- Never commit or paste secrets into any file under this folder; `.env` stays out (it is gitignored for when the repo is attached).

## 7. Status files

Each workstream keeps `docs/status/<code>.md` from the template already in it: what is in progress, what is in review (with test steps), what is done, blockers, and requests to other workstreams. RD created the files; after that each owner edits only its own.
