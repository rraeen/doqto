# Review: INT-01 Root monorepo workspace and tooling

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved** (no blockers; three should-fix items logged as follow-ups below)

## What was checked

Read `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitignore`, `.npmrc`, `.nvmrc`, `.env.example`, `tooling/eslint-rules/**`, `scripts/ops/workspace.sh`, `scripts/ops/mirror.mjs`.

Ran in a scratch mirror (`DOQTO_WORK=<scratch> bash scripts/ops/workspace.sh ...`, Node 22.22.0, pnpm 10.28.0):

- `pnpm install`: 378 packages, OK.
- `pnpm test:tooling`: **19 pass, 0 fail**.
- `pnpm lint`: **passes**, 0 warnings.
- `pnpm format:check`: fails on 4 files in `packages/shared/src` (BE work in progress, not INT-01; see Requests).
- Probed the boundary rule with five extra cases (results under Should fix).

Checklist sections applied: A, E (secrets in `.env.example`), H (demo variables), I (boundary rule), M. Others n/a for a tooling story.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| `pnpm-workspace.yaml` covers `apps/*` and `packages/*` | Yes | `pnpm-workspace.yaml:1-3` |
| Root `dev`, `build`, `typecheck`, `lint`, `test` scripts across workspaces | Yes | `package.json` scripts; recursive with `--if-present` |
| `tsconfig.base.json` strict | Yes | `strict`, plus `noUncheckedIndexedAccess`, `useUnknownInCatchVariables` |
| Shared ESLint and Prettier config, `.editorconfig`, `.gitignore` (node_modules, dist, .next, .env) | Yes | all present; `.gitignore` covers all four and keeps `.env.example` |
| Boundary rule: reviews/ranking importing payments fails lint, violating fixture proves it | Yes | `tooling/eslint-rules/no-payments-in-trust-code.mjs`; fixture `__fixtures__/reviews-imports-payments.ts`; test "violating fixture" passes with severity 2 |
| `.env.example` lists every Phase 1 variable with a comment each | Mostly | Every Phase 1 area is covered and every section has a comment, but some keys have no comment of their own (see Should fix 3) |

## Findings

### Blockers

None.

### Should fix

1. **Boundary rule does not cover `subscriptions`.** TDD 5.8 says reviews and ranking never import "the `payments` or any future `subscriptions` module". `import '../subscriptions/a'` from `apps/api/src/reviews/x.ts` passes today. Add `subscriptions` to the forbidden segments in `isPaymentsSpecifier` and one test.
2. **Search code outside a `ranking` name is not covered.** `apps/api/src/search/search.service.ts` importing `../payments/a` passes. BE-10 puts ranking in "one pure function" but does not fix its file name. Either add `apps/api/src/search/**` to the rule's `files` list, or BE-10 must keep the function in a `*ranking*` file. RD will check this in the BE-10 review either way.
3. **`.env.example` keys without their own comment:** `MSG91_AUTH_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. One line each is enough (what it is, where to get it, live only).

Known limitation, no change asked now: the rule checks direct imports only. `reviews` importing `appointments`, which imports `payments`, passes. RD covers this by manual check in every reviews/ranking review (checklist I). If it becomes a real risk, `dependency-cruiser` can enforce it transitively in INT-04.

### Nits

1. A tsconfig path alias such as `@payments/x` is not caught (only `payments` as a full path segment is). Fine while no such alias exists; worth a test if one is added.
2. `workspace.sh` copies `.env` into the mirror only when the mirror has none, so a later edit to the shared `.env` never reaches an existing mirror. Consider always copying it, or say so in the script header.
3. `eslint.config.mjs` spreads `tseslint.configs.disableTypeChecked` for JS files, but no type-checked preset is enabled. Harmless; can go.

## Requests to other workstreams

- To BE: `pnpm format:check` fails on `packages/shared/src/{common,contract.spec,doctors,enums}.ts`. Run `pnpm format` before BE-02 goes to review.

## Re-review log

- Round 2, 2026-10-10: should-fix 1 to 3 and nits 1 to 3 closed (`pnpm test:tooling` now 25 pass, 0 fail). TypeScript stays ~6.0.3 across all workspaces (an interim ~5.9 was reverted). New, not part of INT-01: root `pnpm lint` fails on FE's generated `apps/web/public/mockServiceWorker.js` ("Unused eslint-disable directive" from `reportUnusedDisableDirectives: 'error'`). INT added `**/public/mockServiceWorker.js` to the ESLint ignores; root lint is green again.
