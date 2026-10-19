# Review: INT-03 Demo-mode startup safety checks

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved for INT's code. The story is not Done until BE wires it in** (one blocker, which BE owns; see below)

## What was checked

I read `provider-safety.ts`, `provider-safety.spec.ts`, the `BOUND_PROVIDERS` factory in `integrations.module.ts`, `integrations.config.ts` and `index.ts`. I also read BE's `database/database.module.ts`, `app.module.ts` and `config/env.ts` to confirm the check sees the same database name the app connects to.

I ran these in a scratch mirror:

- `cd apps/api && npx jest src/integrations`: **6 suites, 67 tests, all pass**.
- `pnpm lint`: clean.
- `pnpm --filter @doqto/api typecheck`: clean.

Checklist section H applied in full, plus A and E.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| Refuses to start when `PROVIDER_MODE=demo` and the DB name does not start with `doqto_demo` | Yes in the module; **not yet in the running API** | `providerSafetyProblems` checks `MONGODB_DB_NAME` and also the database in the `MONGODB_URI` path. Spec: "IntegrationsModule refuses to start on unsafe config". `AppModule` does not import `IntegrationsModule` yet, so `pnpm dev` would start unchecked (Blocker 1) |
| Refuses when `NODE_ENV=production` with a production DB name in demo mode | Yes (same caveat) | Matches `/prod/i` on either name. `doqto_demo` with `NODE_ENV=production` is still allowed, which the demo deployment needs |
| Refuses when `PROVIDER_MODE=live` and any `Demo*` provider is bound | Yes (same caveat) | The factory injects the five tokens themselves, so an `overrideProvider` with a Demo class is also caught (spec) |
| No header, query flag or endpoint toggles demo behaviour; a test proves a header has no effect | Yes | A supertest probe sends `x-provider-mode`, `x-demo-mode`, `x-demo`, cookies and query flags in both modes, with no effect. A source scan fails on any request-derived demo flag or on `process.env.PROVIDER_MODE` read outside `src/config` |

Other points: `DEMO_DB_PREFIX` is a constant. One `UnsafeProviderConfigError` lists every problem and contains no secrets, only database names. Demo classes are no longer exported from the barrel, which closes INT-02 should-fix 2. The database name check uses the same `MONGODB_DB_NAME` that `DatabaseModule` passes as `dbName`, so the two cannot disagree.

## Findings

### Blockers

1. **The check is not wired into the API yet.** `apps/api/src/app.module.ts` does not import `IntegrationsModule.forRoot()`, so the running API applies none of TDD 13 rule 2. This is BE's file, so this is a request to BE, not a defect in INT's code.
   - Fix: BE adds `IntegrationsModule.forRoot()` to `AppModule` imports, plus one app-level e2e test. That test boots `AppModule` with `MONGODB_DB_NAME=doqto_prod` and `PROVIDER_MODE=demo` and expects startup to fail.
   - RD will tick INT-03 Done once that lands. It can ride with BE-04, which needs the module anyway.

### Should fix

1. **Fail before connecting.** The check runs when Nest instantiates `IntegrationsModule`. Depending on module order, Mongoose may already have opened a connection to the production database by then. No data is touched, because migrations run in lifecycle hooks after instantiation, but failing earlier is cleaner. Suggest BE also calls `providerSafetyProblems` (config-only part) from `validateEnv` in `config/env.ts`, so the API refuses before any connection. Owner: BE, with INT's function.

### Nits

1. `/prod/i` also matches names like `doqto_demo_product_test` under `NODE_ENV=production`. That is erring the safe way; it only needs a comment if someone trips over it.

## Requests to other workstreams

- To BE: import `IntegrationsModule.forRoot()` in `AppModule` and add the boot-refusal e2e test (Blocker 1). Optionally run the config-only safety check in `validateEnv` (Should fix 1).

## Re-review log

- Round 2, 2026-10-10: **Blocker 1 closed.** `AppModule` imports `IntegrationsModule.forRoot()` (`app.module.ts:28`). `test/demo-safety.e2e-spec.ts` boots the real AppModule with `PROVIDER_MODE=demo` and `MONGODB_DB_NAME=doqto_prod` and expects the refusal; the full e2e run is 4 suites, 32 tests, all pass. Should-fix 1 is also done: `validateEnv` runs the safety check, so the API refuses before Mongoose connects. **INT-03 is Done.**
