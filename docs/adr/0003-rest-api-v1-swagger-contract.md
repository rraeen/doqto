# 0003. REST under /api/v1, with a shared contract

- Status: Accepted, 2026-10-09 (TDD sections 4 and 9.2)

## Context

The web app ships first; a native Kotlin Android app follows in Phase 2 and must reuse the same API without changes. Four agents build front end and back end in parallel and need one agreed shape.

## Decision

- REST, JSON in and out, every route under `/api/v1`. No GraphQL.
- `packages/shared` holds Zod schemas, inferred TypeScript types and enums for every request and response, plus `CONTRACT.md`. BE owns it. FE and INT import from it and never redefine API types.
- Swagger at `/api/docs` is generated from the NestJS DTOs and is the published contract for non-TypeScript clients (the Kotlin app generates its client with OpenAPI Generator).
- Contract changes land one story ahead of the screens that use them; FE builds against MSW mocks from the shared schemas meanwhile.
- One error envelope with a stable `code`; cursor pagination `?cursor=&limit=`.
- Auth: Bearer JWT for mobile, httpOnly cookies on the shared parent domain for web; the API accepts either.

## Consequences

- Two descriptions of the same shape exist (Zod in `shared`, class-validator DTOs in the API). Review checks they agree; a test or generator that ties them is welcome.
- Breaking changes after the Android app ships need `/api/v2` or additive fields only.

## When to revisit

Only if a second, non-TypeScript team needs the contract before Swagger is complete.
