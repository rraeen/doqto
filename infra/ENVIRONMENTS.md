# Doqto environments

Three environments, one codebase. What differs is configuration only (TDD 10, TDD 13). Every variable is described in the root `.env.example`.

| | Local | Demo (staging) | Production (INT-21) |
| --- | --- | --- | --- |
| Purpose | Development | Doctor and patient demos, staging for every merge | Real patients |
| Web | `pnpm dev` on :3000 | Vercel project `doqto-web-demo`, `doqto-web-demo.vercel.app` (later its own domain, e.g. `demo.doqto.care`) | Vercel project `doqto-web`, `doqto.in` |
| API | `pnpm dev` on :4000 | Render `doqto-api-demo` (free), `doqto-api-demo.onrender.com`, reached by browsers through the web app's `/api/v1` proxy | Render `doqto-api` (Starter), `api.doqto.in` behind Cloudflare |
| Database | Docker Mongo replica set, `doqto_demo_local` | Atlas M0 (Mumbai), `doqto_demo` | Atlas M0 then Flex (Mumbai), `doqto_prod` |
| Providers | `PROVIDER_MODE=demo` | `PROVIDER_MODE=demo` | `PROVIDER_MODE=live` |
| Login OTP | `123456` | `123456` | Real OTP over WhatsApp, SMS fallback |
| Messages | Outbox and Demo inbox only | Outbox and Demo inbox only | WhatsApp BSP, MSG91 |
| Payments | Demo pay button | Demo pay button | Razorpay |
| Files | `.demo-storage/` folder | Instance disk (lost on every redeploy or restart; the demo seed must not rely on uploaded photos surviving) | Cloudflare R2 |

Demo and production never share a database, a database user, a Render service, a Vercel project or a registrable domain (see Cookie isolation below). The API refuses to start in demo mode unless the database name starts with `doqto_demo`, and refuses to start in live mode if any demo provider is bound (INT-03).

## Local

```bash
cp .env.example .env            # defaults are local demo mode
pnpm install                    # on the shared project folder: bash scripts/ops/workspace.sh
pnpm db:up                      # MongoDB 8 replica set in Docker, waits until ready
pnpm dev                        # API :4000 (Swagger /api/docs), web :3000, hot reload
pnpm ci:local                   # everything CI runs
```

Both apps read the one root `.env` (API through `@nestjs/config`, web through `@next/env` in `next.config.ts`). Without Docker, any MongoDB 7+ started as a single-node replica set works: point `MONGODB_URI` at it and keep `replicaSet` in the string. Tests never need Docker: they use an in-memory replica set.

## Tests and the MongoDB binary

API e2e tests start an in-memory MongoDB replica set with `mongodb-memory-server`, which downloads `mongod` from `fastdl.mongodb.org` on first run (cached afterwards; GitHub CI caches it too). Where that host is blocked, as in the agent containers, set `MONGOMS_SYSTEM_BINARY` to a local `mongod` 8.x and the download is skipped:

```bash
# Example: take mongod from the official image (needs Docker once)
docker create --name m mongo:8.0 && docker cp m:/usr/bin/mongod ~/bin/mongod && docker rm m
MONGOMS_SYSTEM_BINARY=~/bin/mongod pnpm test:e2e
```

`MONGOMS_SYSTEM_BINARY` is a test-only variable; it is never set on Render or Vercel.

## TRUST_PROXY

`TRUST_PROXY` is the number of reverse proxies in front of the API. Express uses it to read the real client IP from `X-Forwarded-For`, which the OTP and login rate limits (3 per 10 minutes per IP) and the IP /24 fraud signal depend on. Set it to exactly the number of proxies: `0` locally, `1` on Render, `2` once Cloudflare proxies `api.doqto.in` (INT-11). Too low and every request looks like it comes from the proxy, so one user can rate-limit everyone; too high and clients can spoof their IP with their own `X-Forwarded-For` header.

`CLIENT_IP_HEADER` names a header that carries the client IP instead, such as `cf-connecting-ip` behind Cloudflare; empty falls back to `req.ip` and `TRUST_PROXY`. Like `TRUST_PROXY=2`, it is spoofable while the Render origin (`*.onrender.com`) still accepts direct traffic: an attacker can rotate the header to get past the per-IP OTP limit, which is the SMS-pumping guard. Leave both at their Render values until INT-11 locks the origin to Cloudflare.

## Variable matrix

`—` means not set. `secret` means a generated or provider-issued value entered only in the platform dashboard. Render values for the demo service are in `infra/render.yaml`.

### API (Render)

| Variable | Local | Demo | Production |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | `production` | `production` |
| `PORT` | `4000` | set by Render | set by Render |
| `LOG_LEVEL` | `debug` | `info` | `info` |
| `APP_VERSION` | `dev` | git sha (start command) | git sha (start command) |
| `APP_TIMEZONE` | `Asia/Kolkata` | `Asia/Kolkata` | `Asia/Kolkata` |
| `PROVIDER_MODE` | `demo` | `demo` | `live` |
| `API_PUBLIC_URL` | `http://localhost:4000` | `https://doqto-api-demo.onrender.com` | `https://api.doqto.in` |
| `WEB_PUBLIC_URL` | `http://localhost:3000` | `https://doqto-web-demo.vercel.app` | `https://doqto.in` |
| `CORS_ORIGINS` | `http://localhost:3000` | `https://doqto-web-demo.vercel.app` | `https://doqto.in,https://www.doqto.in` |
| `COOKIE_DOMAIN` | — | — (host-only, never a doqto.in domain) | `.doqto.in` |
| `TRUST_PROXY` | `0` | `1` (Render) | `2` (Cloudflare + Render) |
| `CLIENT_IP_HEADER` | empty | empty | `cf-connecting-ip` (only after INT-11 locks the origin) |
| `MONGODB_URI` | Docker, see `.env.example` | secret (demo cluster user) | secret (prod cluster user) |
| `MONGODB_DB_NAME` | `doqto_demo_local` | `doqto_demo` | `doqto_prod` |
| `JWT_ACCESS_SECRET` | dev value | secret (generated) | secret (generated) |
| `JWT_ACCESS_TTL` | `15m` | `15m` | `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | `30` | `30` |
| `HASH_PEPPER` | dev value | secret (generated) | secret (generated, never rotated casually: it invalidates OTPs, visit codes and sessions) |
| `THROTTLE_LIMIT` / `THROTTLE_TTL_SECONDS` | `100` / `60` | `100` / `60` | `100` / `60` |
| `BOOKING_FEE_PAISE` | `1500` | `1500` | per launch decision (`1000` or `2000`) |
| `WHATSAPP_*` | — | — | secret (BSP, INT-20) |
| `MSG91_*` | — | — | secret (DLT, INT-20) |
| `RAZORPAY_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET` | — | — (or test keys, TDD 13) | secret (live keys, INT-13/14) |
| `DEMO_STORAGE_DIR` | `.demo-storage` | `/tmp/doqto-demo-storage` | — |
| `R2_*` | — | — | secret (INT-06) |
| `R2_BACKUP_BUCKET` | — | — | `doqto-backups` (INT-17) |
| `SIGNED_URL_TTL_SECONDS` | `300` | `300` | `300` |
| `GEOCODER_USER_AGENT` | default | default | default |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | — | optional | secret (INT-16) |
| `SENTRY_DSN` | — | secret (optional) | secret (INT-18) |

### Web (Vercel)

| Variable | Local | Demo | Production |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | `/api/v1` (same-origin, proxied) | `https://api.doqto.in/api/v1` |
| `API_PROXY_TARGET` (server-side, for the rewrite) | — | `https://doqto-api-demo.onrender.com` | — |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | `true` | `false` |
| `NEXT_PUBLIC_API_MOCKS` | `false` (or `true` for FE work) | `false` | `false` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://doqto-web-demo.vercel.app` | `https://doqto.in` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | — | — | live key id (never the secret) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | — | optional | same as `VAPID_PUBLIC_KEY` |
| `NEXT_PUBLIC_SENTRY_DSN` | — | optional | secret (INT-18) |

## Cookie isolation between demo and production

Demo accepts OTP `123456` for any phone, so demo must never see a production session. Browsers send cookies by domain, not by deployment: if demo ran on `demo.doqto.in` with `COOKIE_DOMAIN=.doqto.in`, a patient's production refresh token would be sent to the demo API, and each environment's login would overwrite the other's cookies. Renaming cookies does not fix this. So:

- Demo never runs under `doqto.in`. Until a separate demo domain exists (for example `demo.doqto.care` with `api.demo.doqto.care`), it uses the default `doqto-web-demo.vercel.app` and `doqto-api-demo.onrender.com` hostnames.
- Demo cookies are host-only (`COOKIE_DOMAIN` unset).
- Browsers reach the demo API **same-origin**: the web app rewrites `/api/v1/*` to `API_PROXY_TARGET` and `NEXT_PUBLIC_API_URL=/api/v1`. Cookies are then first-party on the Vercel host, `SameSite=Lax` works, and Safari's block on third-party cookies does not break demo login (calling `onrender.com` directly from `vercel.app` would need `SameSite=None; Secure` cookies, which Safari drops). The rewrite lives in `apps/web/next.config.ts` (FE): `rewrites: async () => process.env.API_PROXY_TARGET ? [{ source: '/api/v1/:path*', destination: `${process.env.API_PROXY_TARGET}/api/v1/:path*` }] : []`.
- With the proxy, the API sees Vercel as an extra hop: keep `TRUST_PROXY` at `1` only if Vercel forwards the client IP in `X-Forwarded-For` as its first entry; INT checks this once the demo is deployed.
- Production keeps `doqto.in` and `api.doqto.in` with `COOKIE_DOMAIN=.doqto.in` (same site, so `SameSite=Lax` is fine).

## Render (API)

The demo service is defined in `infra/render.yaml` (Blueprint). Build: `pnpm install --frozen-lockfile`, then `pnpm --filter "@doqto/api..." run build` (builds `packages/shared` first). Start: `node apps/api/dist/main.js`. Health check: `/api/v1/health`. Region Singapore. It auto-deploys from `main` when API, contract or dependency files change.

To apply once Raunak has a Render account: New > Blueprint > choose the repo > Blueprint path `infra/render.yaml` > enter `MONGODB_URI` (and `SENTRY_DSN` if wanted) when prompted. `JWT_ACCESS_SECRET` and `HASH_PEPPER` are generated by Render.

Free instances sleep after idle time and cold-start in roughly a minute; acceptable for demos, not for production webhooks and OTPs (TDD 10).

## Vercel (web)

Vercel has no repo-level config file that INT owns (`apps/web/vercel.json` would be FE's), so the project is set up in the dashboard:

1. Add New > Project > import the repo. Project name `doqto-web-demo`.
2. Root Directory: `apps/web`. Framework preset: Next.js. Leave "Include files outside the root directory" on (the app reads `packages/shared` and the root config).
3. Install command: leave default (Vercel detects pnpm from `pnpm-lock.yaml` and the root `packageManager`). Build command: default `next build`. Node.js version: 22.x.
4. Environment variables: the Demo column of the web table above, for Production and Preview.
5. Domains: keep the default `doqto-web-demo.vercel.app`. A custom demo domain must be a different registrable domain from production (for example `demo.doqto.care`), never a subdomain of `doqto.in`.
6. Hobby plan is fine for the demo; production moves to Pro before taking payments (TDD 10, Hobby excludes commercial use).

Preview deployments get their own URLs per pull request and, through the same proxy, call the demo API same-origin, so login works on previews without CORS changes.

## MongoDB Atlas

- One project per environment (`doqto-demo`, `doqto-prod`), region AWS Mumbai (`ap-south-1`), separate database users with access to their own database only.
- Network access: demo can allow `0.0.0.0/0` while on the free Render instance; production is limited to Render's outbound IPs (TDD 11).
- Indexes are created by the API's startup migrations (BE-03), never by hand.
- M0 has no backups; the nightly `mongodump` to R2 lands in INT-17.

## Razorpay test mode

The live Razorpay adapter (`apps/api/src/integrations/payment/live-payment.provider.ts`, INT-13) was built from Razorpay's API docs and is tested only against fakes. It is **unverified against the real API until test keys exist**. Test-mode keys need no KYC: Razorpay Dashboard, switch to Test Mode, Account & Settings, API Keys, Generate Test Key. Put them in a local `.env` with `PROVIDER_MODE=live` (never in the demo service), plus a webhook secret of your choice.

Once keys exist, check each of these against the real API and tick it in `docs/status/INT.md`:

1. Create an order for 1500 paise; the response `id` starts with `order_` and `created_at` is unix seconds.
2. Pay it in Checkout with a test card; `verifyPayment` accepts the returned `razorpay_signature` and rejects it with a different payment id.
3. Add a webhook in the Dashboard (Test Mode) pointing at `https://<tunnel>/api/v1/webhooks/razorpay` with events `payment.captured`, `payment.failed` and `refund.processed`; each arrives with `x-razorpay-signature` and `x-razorpay-event-id` and passes `verifyWebhook`.
4. Refund the payment with an idempotency key as receipt; the status is `processed` or `pending`, and a retry with the same key does not refund twice.
5. A wrong key secret gives `HTTP 401 BAD_REQUEST_ERROR` in the error, with no secret in the message or logs.

## What is not deployed yet

Nothing is deployed until Raunak creates the Render, Vercel and Atlas accounts (backlog section 6). Cloudflare DNS and caching (INT-11), monitoring (INT-18), backups (INT-17) and the production services (INT-21) come in later stories.
