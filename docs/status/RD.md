# RD status (Review + Docs)

Owned and edited only by the RD agent. Newest entries at the top of each section.

## In progress

- Reviewing sprint 1 stories as they appear under "In review" in FE, BE and INT status files.

## In review

<!-- RD stories are docs; Raunak or the coordinator may comment. -->

## Done

- Docs updated for the real toolchain (Node 22, pnpm 10.28, TS ~6.0, ESLint 10) and the `scripts/ops/workspace.sh` rule, per INT (2026-10-10).
- RD-04 ADRs: `docs/adr/` README plus 0001 to 0008 (2026-10-10). Added 0008 (payments never influence reviews or ranking) beyond the seven listed, since every review checks it.
- RD-02 Review checklist: `docs/review-checklist.md` and `docs/reviews/_template.md` (2026-10-10).
- RD-01 Project docs: `README.md`, `docs/CONTRIBUTING.md`, `docs/status/{FE,BE,INT,RD}.md` templates, `docs/reviews/design-doc-differences.md` (2026-10-10).

## Story approvals (for the coordinator to tick in BACKLOG.md)

| Story | Verdict | Review note | Date |
| --- | --- | --- | --- |
| RD-01 | Done | n/a (docs) | 2026-10-10 |
| RD-02 | Done | n/a (docs) | 2026-10-10 |
| RD-04 | Done | n/a (docs) | 2026-10-10 |
| BE-09 | **Changes requested** | `docs/reviews/BE-09.md` (blocker: approval not tied to the reviewed profile; a doctor can change registration after review, and parallel approve/reject leaves "rejected but listed") | 2026-10-10 |
| BE-08 | Approved | `docs/reviews/BE-08.md` (should-fix: staff users created without patient role/consent, link sync not atomic, unbounded geocode queue, null fields 500) | 2026-10-10 |
| BE-07 | Approved | `docs/reviews/BE-07.md` (should-fix: null PATCH fields 500, missing parity specs, verified doctor can rename and stay listed, role write not atomic, old scans kept) | 2026-10-10 |
| BE-11 | Approved | `docs/reviews/BE-11.md` (should-fix: schedules with BE-14, safety check order, slug clash crash, opt-in without consent, public demo admin: Ask Raunak, row 30) | 2026-10-10 |
| BE-06 | Approved | `docs/reviews/BE-06.md` (should-fix: retry slug on duplicate key, test that migration 0002 builds indexes) | 2026-10-10 |
| BE-05 | Approved | `docs/reviews/BE-05.md` (should-fix: `near` India bounds, 409 missing from CONTRACT.md, read-only staff see co-workers' phones) | 2026-10-10 |
| BE-04 | **Changes requested** | `docs/reviews/BE-04.md` (blocker: global JwtAuthGuard returns 401 on the payment webhook and demo file serving; should-fix: throttler ignores CLIENT_IP_HEADER, parallel refresh logs users out) | 2026-10-10 |
| BE-10 | Approved | `docs/reviews/BE-10.md` (should-fix: trust lint rule misses doctor-search.service.ts, 500 on out-of-range `near`, suspended doctors stay public) | 2026-10-10 |
| INT-13 | Approved as code | `docs/reviews/INT-13.md` (real-API checks open until Raunak creates Razorpay test keys) | 2026-10-10 |
| INT-12 | Approved | `docs/reviews/INT-12.md` (notes for BE-27: rawBody, stored amount, dedupe) | 2026-10-10 |
| INT-08 | Approved | `docs/reviews/INT-08.md` (notes for BE-16 lockout and BE-27 visit-code delivery) | 2026-10-10 |
| INT-09 | Approved | `docs/reviews/INT-09.md` (Raunak: native Hindi read before BSP submission) | 2026-10-10 |
| INT-07 | Approved | `docs/reviews/INT-07.md` | 2026-10-10 |
| INT-06 | Approved | `docs/reviews/INT-06.md` (should-fix: strip EXIF from public photos) | 2026-10-10 |
| INT-05 | Approved (round 2) | `docs/reviews/INT-05.md` (demo isolated on default hostnames, same-origin proxy) | 2026-10-10 |
| FE-04 | **Changes requested** (round 2) | `docs/reviews/FE-04.md` (open redirect still reachable via dot segments, e.g. `/.//evil.com` gives `//evil.com`; real-API check passes) | 2026-10-10 |
| FE-03 | Approved | `docs/reviews/FE-03.md` | 2026-10-10 |
| FE-02 | Approved (round 2) | `docs/reviews/FE-02.md` (first-load JS 168.8 to 175.8 KB, under 200 KB; no Zod on first load) | 2026-10-10 |
| FE-01 | Approved | `docs/reviews/FE-01.md` | 2026-10-10 |
| BE-03 | Approved | `docs/reviews/BE-03.md` (should-fix: 11000 tests for otps and refreshTokens) | 2026-10-10 |
| BE-02 | Approved (RD-03 done) | `docs/reviews/BE-02.md` (should-fix: no refresh token in web response bodies) | 2026-10-10 |
| BE-01 | Approved | `docs/reviews/BE-01.md` (should-fix: client IP behind Cloudflare, PII in 5xx log messages) | 2026-10-10 |
| INT-04 | Approved | `docs/reviews/INT-04.md` | 2026-10-10 |
| RD-03 | Done | `docs/reviews/BE-02.md` | 2026-10-10 |
| INT-03 | Approved, Done (round 2) | `docs/reviews/INT-03.md` | 2026-10-10 |
| INT-02 | Approved | `docs/reviews/INT-02.md` (2 should-fix: OTP bypasses outbox, Demo classes exported) | 2026-10-10 |
| INT-01 | Approved | `docs/reviews/INT-01.md` (3 should-fix follow-ups for INT) | 2026-10-10 |

## Blockers

None.

## Requests to other workstreams

- To FE: `safeNext` must also reject a result whose pathname starts with `//` (dot segments such as `/.//evil.com`), with tests (FE-04 round 2 blocker).
- To BE: return tokens in the body only for mobile clients (BE-02 should-fix 1); resolve client IP behind Cloudflare before BE-04 is deployed (BE-01 should-fix 1); scrub PII from 5xx log messages (BE-01 should-fix 2); add 11000 tests for `otps` and `refreshTokens` (BE-03).
- To INT (INT-10): handle STOP with STATUS and CANCEL.
- To BE and INT (from INT-02): OTPs are sent directly by `OtpProvider`, not through the outbox; BE-04, BE-21 and INT-08 should assume that and never store a plain OTP in `notifications`.
- To BE (BE-02, BE-03): include `'demo'` in the payment `gateway` enum and an `isDemo` flag on `users`; both design docs miss them though TDD 13 and BE-03 require them (design-doc-differences rows 16 and 18).
- To BE (BE-01): extend the log redaction list beyond `phone, otp, visitCode, token, authorization` with `patientPhone, code, codeHash, accessToken, refreshToken, cookie, signature` (review checklist E).
