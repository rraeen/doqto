# Differences between TDD section 3 and the DB doc

The DB doc (`doqto-database-design.md`) is the schema source of truth (CONTRIBUTING section 2). Code and the API contract follow the **DB doc** column. Items marked **Ask Raunak** need a product decision; until answered, the DB doc stands.

| # | Area | TDD section 3 | DB doc | Follow |
| --- | --- | --- | --- | --- |
| 1 | `users` fraud field | `deviceFingerprints: string[]` | `deviceHashes: string[]` (hashes only) | DB doc |
| 2 | `users` fields | no `consentLog`, `clinicIds`, `pushSubscriptions`; status `active`, `suspended` | adds them; status adds `deleted` | DB doc |
| 3 | `doctors.registration` | `docUrl` (private bucket) | `docKey` (private R2 object key) | DB doc. Store a key, never a URL; signed URLs are made on read |
| 4 | `doctors.ratingSummary` | has `overall` | no `overall`; has `recommendPct`, `updatedAt` | DB doc. There is no single overall score (TDD 5.4 forbids showing one) |
| 5 | `doctors` | no `city`, `bio` | `city` (denormalised), `bio` | DB doc |
| 6 | `doctors` indexes | `{ specialties, isListed }` | `{ isListed, city, specialties }`, unique `userId`, text index | DB doc |
| 7 | `appointments.status` | 8 values | adds `expired` (hold timed out) | DB doc |
| 8 | `appointments.visitCode` | `{ hash, expiresAt, usedAt }` | `{ hash, expiresAt, attempts, lockedUntil }` | DB doc; lockout needs `attempts` and `lockedUntil`. **Ask Raunak** only if "used once" tracking is wanted too (`visitVerifiedAt` already records it) |
| 9 | `appointments` | no `holdExpiresAt`, `effectiveTime`, `reviewUnlockAt` | has them | DB doc |
| 10 | `doctorStatus` | no `tokenCounter` | `tokenCounter` for atomic token `$inc` | DB doc |
| 11 | `reviews.state` | includes `cooling_down` | not stored; creation blocked before `reviewUnlockAt` | DB doc |
| 12 | `reviews` | no `countsInSummary`, `supersededBy`, `editCount`, `submittedAt` | has them | DB doc |
| 13 | `reviews.appeal` | `reason` | `reasonCode` + `text` | DB doc. Reason codes are a fixed enum (TDD 5.7) |
| 14 | `reviews.reply` | `editedAt` | `editableUntil` | DB doc |
| 15 | `payments` | `webhookEvents: [{ type, at, raw }]` (raw bodies inline) | `processedEventIds: string[]`; raw bodies in `webhookLogs` (30-day TTL) | DB doc. Keeps raw gateway payloads out of a long-lived document |
| 16 | `payments.gateway` | `'razorpay'` only | `'razorpay'` only | Both miss `'demo'`, which TDD 13 and INT-02 require. Enum must be `'razorpay' \| 'demo'` |
| 17 | Collections | twelve | sixteen (`reviewClusters`, `refreshTokens`, `jobs`, `webhookLogs`, embedded `pushSubscriptions`) | DB doc |
| 18 | `users.isDemo` | not in either section 3 | not in the DB doc table | TDD 13 rule 5 and BE-03 require it. Add `isDemo: boolean` to `users`, and to any seeded collection the wipe script must find |
| 19 | `notifications.channel` / status | same | same | No difference |
| 20 | Sensitive fields in logs | TDD 11: `phone`, `otp`, `visitCode`, `token` | n/a | BE-01 adds `authorization`; also redact `patientPhone`, `refreshToken`, `accessToken`, `codeHash`, `signature` (see review checklist) |
| 21 | `otps` index | n/a | `{ phone, purpose }` plain index | **Code**: unique (BE-03), one live code per phone and purpose. Accepted by RD |
| 22 | `refreshTokens` | n/a | no family field | **Code**: `familyId` added for reuse detection (BE-03/BE-04). Accepted by RD |
| 23 | `users.consentLog` | n/a | `{ type, version, at }` | **Code**: adds `granted` to record withdrawals (BE-03). Accepted by RD |
| 24 | Demo hostnames (TDD 13 rule 1) | `demo.doqto.in` on Render and Vercel | n/a | **Code/infra**: demo uses default `*.vercel.app` / `*.onrender.com` hosts, host-only cookies and a same-origin `/api/v1` proxy, and never any `doqto.in` host, so production cookies can never reach demo (INT-05 round 2). A future demo domain must be a different registrable domain, e.g. `demo.doqto.care`. Accepted by RD |
| 25 | `clinics.photos` | n/a | `string[]` (R2 keys) | **Code**: `[{ key, url }]` (BE-06/BE-08). The key stays the source; the URL from `putPublic` is cached because `StorageProvider` has no `publicUrl(key)`. If the public bucket domain changes, rebuild the URLs from the keys. Accepted by RD |
| 26 | `doctors` photo | n/a | `photoUrl` | **Code**: `photoKey` + `photoUrl` (BE-06/BE-07), same reason as row 25. Accepted by RD |
| 27 | `doctors.slugLocked` | n/a | not in the table | **Code**: boolean set the first time the doctor is listed; the slug never changes after that, so `/d/<slug>` stays stable (TDD: stable doctor URLs). Accepted by RD |
| 28 | `clinics.staffLog` | n/a | not in the table | **Code**: `[{ userId, addedAt, addedBy }]`, display only; `staffUserIds` stays the access-control source of truth (BE-08). Accepted by RD |
| 29 | `doctors.registration` / `verification` extras | n/a | `{ council, number, year, docKey }`; `{ status, verifiedBy, verifiedAt, notes }` | **Code**: adds `docContentType`, `docSizeBytes`, `docUploadedAt` and `verification.submittedAt` (BE-06/BE-07). Accepted by RD |
| 30 | Demo admin account (TDD 13) | anyone can log in as anyone with `123456` | n/a | **Code**: BE-11 seeds an admin whose phone is in the source, so anyone can be demo admin and open registration scans that real doctors upload during demo onboarding. RD suggests taking the phone from an env var and telling demo doctors to upload a sample. **Ask Raunak** |
| 31 | Seed contents | TDD 13: `scripts/seed-demo.ts`, 3 clinics, 5 doctors with schedules, sample appointments, a few reviews | 7: `scripts/seed.ts`, 3 clinics, 5 doctors, schedules, sample appointments | **Code**: `apps/api/src/scripts/seed-demo.ts` (BE-11) seeds clinics, doctors, staff and an admin now; schedules come with BE-14, and appointments and reviews with the stories that create those collections. One demo seed, no separate `seed.ts`. Accepted by RD |

Rows 16 and 18 are gaps in both documents rather than disagreements; the contract (BE-02) and schemas (BE-03) should include them.
