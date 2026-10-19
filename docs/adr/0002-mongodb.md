# 0002. MongoDB with rules enforced by indexes

- Status: Accepted, 2026-10-09 (TDD section 3, DB doc)

## Context

Doctor profiles vary a lot (qualifications, languages, clinics), "near me" needs geo queries, and the budget needs a free tier to start. Several business rules (no double booking, one review per visit, idempotent webhooks, one message per alert) must hold even under concurrent requests.

## Decision

- MongoDB Atlas in AWS Mumbai (`ap-south-1`), M0 free tier, then Flex, then M10. Mongoose with `strict: true` and `timestamps: true`.
- The DB doc (`doqto-database-design.md`) is the schema source of truth.
- Business rules are enforced by **unique indexes**, not application code alone: `appointments {doctorId, slotStart}` unique partial on active statuses, `reviews.appointmentId`, `payments.gatewayOrderId`, `payments.gatewayPaymentId`, `notifications.dedupeKey`, `webhookLogs {source, eventId}`, `doctorStatus {doctorId, date}`, `users.phone`, `doctors.slug`, `doctors.userId`, `refreshTokens.tokenHash`.
- Indexes are created by a startup migration with `autoIndex` off in production. These unique indexes are release-blocking and each has a duplicate-insert test.
- Multi-document transactions only in three places: payment confirm, cancel plus refund, review publish.
- Money in integer paise; times in UTC; clinic days as IST `YYYY-MM-DD` strings.

## Consequences

- Local dev and tests need a replica set (docker compose and `mongodb-memory-server` in replica set mode) so transactions work.
- M0 has no backups, so a nightly `mongodump` to R2 is required from day one (INT-17).
- Schema changes go additive first, backfill second, enforce third.

## When to revisit

Storage above 70% of the tier, status endpoint p95 above 100 ms, or a need for reporting joins that aggregation cannot serve.
