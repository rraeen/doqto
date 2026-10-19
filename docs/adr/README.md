# Architecture decision records

Short records of decisions that are settled for Phase 1. A story does not reopen them; changing one needs a new ADR that supersedes the old one, agreed with Raunak.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-modular-monolith.md) | One NestJS modular monolith, no microservices | Accepted |
| [0002](0002-mongodb.md) | MongoDB Atlas (Mumbai) with Mongoose; rules enforced by indexes | Accepted |
| [0003](0003-rest-api-v1-swagger-contract.md) | REST under `/api/v1`, Swagger plus `packages/shared` as the contract | Accepted |
| [0004](0004-polling-not-websockets.md) | Polling and WhatsApp for live status, no websockets | Accepted |
| [0005](0005-visit-code-verified-visits.md) | A code from the patient's phone proves a visit | Accepted |
| [0006](0006-demo-mode-via-providers.md) | Demo mode through provider implementations chosen at startup | Accepted |
| [0007](0007-no-clinical-data-phase-1.md) | No clinical data in Phase 1 | Accepted |
| [0008](0008-payments-never-influence-reviews-or-ranking.md) | Payments can never influence reviews or ranking | Accepted |

Format: Context, Decision, Consequences, and When to revisit. Keep each under a page.
