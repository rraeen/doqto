# INT status (Integration)

Owned and edited only by the INT agent. Newest entries at the top of each section.

## In progress

- Nothing in progress. Remaining INT stories wait on dependencies: INT-10 (needs BE-21), INT-11 (BE-23), INT-14 (BE-27), INT-15 (BE-04).

## In review

- Nothing in review.

## Done

- BE-04 review follow-ups for INT (docs/reviews/BE-04.md): `PaymentWebhooksController` and `DemoStorageController` are marked `@Public()`, so the global `JwtAuthGuard` no longer answers 401 to gateways and file links (`integrations/public-routes.spec.ts`). They import `Public` from `auth/decorators` for now and switch to `common/http/public` once Backend's file lands. Backend can make `webhooks/*` and `demo-storage/*` strict in its public-routes e2e. `CLIENT_IP_HEADER` is now in `.env.example` and `infra/ENVIRONMENTS.md` (matrix row and prose), and it and `TRUST_PROXY=2` carry the spoofing caveat: they are only safe once INT-11 locks the origin to Cloudflare. Full `pnpm ci:local` green.
- INT-13 Razorpay live adapter (approved as code in docs/reviews/INT-13.md). **Unverified against the real API until test keys exist**: the five checks in `infra/ENVIRONMENTS.md` ("Razorpay test mode") stay open. Nit done: `payment.captured` and `refund.processed` without a positive integer amount are refused as `ProviderInputError`. Also fixed a flaky visit-code test (a random hash could contain the 4 digits by chance). Full `pnpm ci:local` green, 163 integration tests.
- INT-12 Demo payment flow end to end (approved). BE requests for BE-27 stand: `rawBody: true` in `NestFactory.create`, register a `PaymentEventHandler` via `PAYMENT_WEBHOOKS`, and `POST /payments/:id/demo-pay` calling `DEMO_PAY`.
- INT-09 WhatsApp templates and BSP submission pack (approved in docs/reviews/INT-09.md). For Raunak: a native Hindi read before submitting `infra/whatsapp/TEMPLATES-SUBMISSION.md`. BE nits noted there: pass doctor names without "Dr", amounts as rupees, and send `booking_confirmed` by SMS to patients who replied STOP.
- INT-08 Walk-in OTP and visit codes (approved in docs/reviews/INT-08.md). Nit done: the visit-code pattern is a module constant.
- INT-05 Local dev and deploy config (approved in round 2, docs/reviews/INT-05.md). The demo runs on default Vercel and Render hostnames, with host-only cookies and a same-origin `/api/v1` proxy (`API_PROXY_TARGET`); this departs from TDD 13 rule 1. The demo-uploads note is in ENVIRONMENTS.md.

- INT-07 Maps (approved in docs/reviews/INT-07.md). Nit done: comment that the geocoder rate gate and cache are per process.
- INT-06 Storage provider (approved in docs/reviews/INT-06.md). Should-fix done in INT: `putPublic` (demo and R2) now strips EXIF, XMP, IPTC, comments and PNG/WebP text chunks from photos without re-encoding, keeping only the JPEG orientation (`storage/strip-metadata.ts`; verified on a Pillow-made JPEG with GPS tags: GPS, maker and comment gone, orientation 6 kept, image decodes). FE does not need to resize for privacy. Nit done: demo private PDFs are served `Content-Disposition: attachment`. 143 integration tests pass.
- INT-03 Demo-mode startup safety checks: BE has wired `IntegrationsModule.forRoot()` into AppModule and BE's `test/demo-safety.e2e-spec.ts` passes (2026-10-10), which was RD's only blocker.

- INT-04 CI pipeline (approved in docs/reviews/INT-04.md, 2026-10-10). Follow-ups landed: `MONGOMS_SYSTEM_BINARY` and `TRUST_PROXY` documented in `infra/ENVIRONMENTS.md` (and a commented `MONGOMS_SYSTEM_BINARY` line in `.env.example`); `sigv4*.ts` formatted.

- INT-02 Provider interfaces and demo implementations (approved in docs/reviews/INT-02.md, 2026-10-10). Review follow-up done in INT-03: the barrel no longer exports `DemoPaymentProvider` or `DemoStorageProvider`. Noted for INT-08: OTPs never go through the notifications outbox; the OTP provider sends directly and no plain OTP is stored in `notifications`.

- INT-01 Root monorepo workspace and tooling (approved in docs/reviews/INT-01.md, 2026-10-10). Follow-ups landed 2026-10-10: rule now also forbids `subscriptions` and `@payments`-style aliases and covers `apps/api/src/search/**` (25 tests); the nine `.env.example` keys have their own comments; `workspace.sh` always copies the shared `.env`; unused `disableTypeChecked` removed; mirror retries files that are mid-write on the shared mount instead of crashing. Usage notes for everyone: run anything with `bash scripts/ops/workspace.sh <cmd>` (no symlinks or exec on the shared mount); Node 22, pnpm 10.28, TypeScript ~6.0, ESLint 10 flat config from the root only.

<!-- - STORY-ID short title (approved in docs/reviews/STORY-ID.md, date) -->

## Blockers

- None. (The mongod download blocker is solved: `bash scripts/ops/fetch-mongod.sh` takes mongod from the official Docker image, and `pnpm ci:local` uses it automatically. Full `ci:local` passed on 2026-10-10, e2e included.)

<!-- - What is blocked, on whom, since when -->

## Requests to other workstreams

- To FE (2026-10-10, for the demo deployment): add the `/api/v1` rewrite to `apps/web/next.config.ts` when `API_PROXY_TARGET` is set (snippet in `infra/ENVIRONMENTS.md`, Cookie isolation), and resolve a relative `NEXT_PUBLIC_API_URL=/api/v1`. No canvas resize is needed for photo privacy; the API strips metadata.
- To BE (2026-10-10): auth cookies stay host-only when `COOKIE_DOMAIN` is unset and `SameSite=Lax` (the demo is same-origin through the proxy). For BE-08/BE-10 return `mapsUrl` built with `googleMapsLink()` from `src/integrations` (INT-07 review nit 1).


<!-- - To BE: change X in packages/shared/... because ... -->
