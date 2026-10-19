# Review: INT-06 Storage provider: R2 live adapter and signed URLs

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved**

## What was checked

I read `storage/sigv4.ts`, `live-storage.provider.ts`, `upload-limits.ts`, `demo-storage.controller.ts`, `demo-storage.provider.ts`, `storage.provider.ts` and their specs.

`cd apps/api && npx jest src/integrations` ran with INT-07 included: **9 suites, 93 tests, all pass**. API typecheck is clean, and Prettier is clean on `integrations/`. Root lint fails on one FE file in progress (`apps/web/scripts/first-load-js.mjs`, `no-console`); nothing under `integrations/` fails.

Checklist sections applied: A, C, E, H.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| Live R2 adapter (S3 API) for public photos and private credential scans | Yes | `R2StorageProvider` uses an in-house SigV4 signer that reproduces the AWS presign and header-signing test vectors (`sigv4.spec.ts`). Missing keys throw `ProviderNotConfiguredError` at call time |
| Signed URLs that expire in 5 minutes | Yes | `signedUrl` presigns for `SIGNED_URL_TTL_SECONDS` (default 300, capped at 3600). The demo uses HMAC-signed URLs with the same expiry and a 403 when tampered or expired |
| Image size and type limits | Yes | `upload-limits.ts`: photos are JPEG, PNG or WebP up to 2 MB; credentials are those or PDF up to 5 MB. Magic-byte sniffing rejects a renamed PDF or SVG. Applied before any write in both demo and live |
| Demo adapter keeps working with local files | Yes | `DemoStorageController` serves demo files only when demo storage is bound (404 in live, tested). Private files are `no-store`, and all responses carry `nosniff` |

R2 upload errors report only the HTTP status. Credentials and signatures never reach an error or log. Keys still reject traversal.

## Findings

### Blockers

None.

### Should fix

1. **Strip photo metadata before public upload.** Phone photos usually carry EXIF GPS and device data. A doctor's profile photo taken at home would publish home coordinates in the public bucket.
   - Either `putPublic` re-encodes images (for example with `sharp`, already allowed in `onlyBuiltDependencies`), or FE-05 and FE-06 resize through a canvas before upload, which drops EXIF.
   - Please agree an owner with FE. RD will check it in BE-07 and FE-05.

### Nits

1. Demo private files (credential PDFs) are served inline from the API origin. Adding `Content-Disposition: attachment` for `application/pdf` on the private route is cheap hardening against PDF quirks in older Android viewers.

## Re-review log

- None yet.
