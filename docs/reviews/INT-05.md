# Review: INT-05 Local dev environment and staging/demo deploy config

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved in round 2** (round 1: changes requested because demo and production would share auth cookies)

## What was checked

I read `docker-compose.yml`, `infra/render.yaml`, `infra/ENVIRONMENTS.md`, the root `package.json` scripts (`dev`, `db:up`, `db:down`) and the `.env.example` additions.

Nothing could be run against Docker or Render from here: the container has no Docker daemon, and no accounts exist yet. This review is of the configuration only.

Checklist sections applied: A, E (secrets), H (demo isolation), M.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| `docker-compose.yml` runs MongoDB only (replica set); `pnpm dev` starts API and web with hot reload | Yes | `mongo:8.0`, `--replSet rs0`, bound to `127.0.0.1` only. The healthcheck initiates the set. `pnpm dev` runs every workspace's `dev` in parallel |
| `infra/render.yaml` for the demo API service; Vercel notes; env matrix for local, demo and production in `infra/ENVIRONMENTS.md` | Yes, with one wrong value | Secrets are `generateValue` or `sync: false`. `PROVIDER_MODE=demo` with `MONGODB_DB_NAME=doqto_demo` (passes INT-03). `TRUST_PROXY` is documented well. `NEXT_PUBLIC_API_MOCKS=false` in demo and production. The `COOKIE_DOMAIN` value is the problem (Blocker 1) |
| Nothing deployed until Raunak provides accounts | Yes | |

## Findings

### Blockers

1. **Demo and production share auth cookies.** `ENVIRONMENTS.md` line 64 and `render.yaml` set `COOKIE_DOMAIN=.doqto.in` for both demo and production, and both use the same cookie names (`doqto_at`, `doqto_rt`).
   - A browser that has used both sites sends its **production** refresh token to the demo API (`demo-api.doqto.in` matches `.doqto.in` and the `/api/v1/auth` path).
   - The demo API is the deployment where anyone can log in with `123456`, so it is the last place production tokens should reach.
   - Each environment's login also overwrites the other's cookies. This breaks TDD 13 rule 1 (demo fully isolated from production).
   - Changing cookie names alone is not enough. Any cookie scoped to `.doqto.in` is still *sent* to every `*.doqto.in` host, including demo ones. Real isolation needs demo on a different registrable domain, or production cookies that never cover demo hosts.
   - Recommended fix: run demo on its own domain, for example `demo.doqto.care` for the web and `api.demo.doqto.care` for the API with `COOKIE_DOMAIN=.demo.doqto.care`. `doqto.care` is already on Raunak's list of domains to buy. Production keeps `.doqto.in`.
   - Until the domain exists, use the Render and Vercel default hostnames for demo with host-only cookies (`COOKIE_DOMAIN` empty). This needs `SameSite=None; Secure` on the API's cookies because web and API are then cross-site. That is BE-04's call, and RD will check it there.
   - Please update `render.yaml` and `ENVIRONMENTS.md` and say which option INT picked.

### Should fix

1. Demo uploads go to `/tmp/doqto-demo-storage` and vanish on redeploy (noted in the file). Fine for demos, but the seed script (BE-11) should not rely on photos surviving. Add a line to `ENVIRONMENTS.md`.

### Nits

1. `buildCommand` uses `npx --yes pnpm@10.28.0`. Render supports Corepack with `packageManager`, so `corepack enable && pnpm ...` avoids an npx download on each build.

## Requests to other workstreams

- To BE (BE-04): cookie attributes must follow whatever INT settles here (host-only plus `SameSite=None; Secure` on the interim demo hostnames).

## Re-review log

- Round 2, 2026-10-10: **Blocker 1 closed.**
  - Demo no longer runs under `doqto.in`. It uses the default `doqto-web-demo.vercel.app` and `doqto-api-demo.onrender.com` hostnames with `COOKIE_DOMAIN` unset (host-only cookies).
  - Browsers reach the API same-origin through a Next.js rewrite of `/api/v1/*` to `API_PROXY_TARGET`, so `SameSite=Lax` cookies work, including in Safari.
  - `infra/ENVIRONMENTS.md` has a new "Cookie isolation" section and rules out any future demo domain under `doqto.in`.
  - Should-fix 1 is done. Nit 1 was declined with a sound reason (Corepack needs a writable global bin on Render).
  - Recorded as row 24 in `design-doc-differences.md`, because this departs from the TDD 13 hostname `demo.doqto.in`.
  - Follow-ups:
    - FE adds the rewrite in `apps/web/next.config.ts` (INT's request).
    - The demo API sits behind Vercel's proxy as well as Render's, so `TRUST_PROXY=1` may pick Vercel's address as the client IP. Per-IP limits on demo then become per-Vercel-edge. That is acceptable for demo; RD will check it when INT-11 sets production values.
