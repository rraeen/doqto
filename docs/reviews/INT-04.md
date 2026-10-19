# Review: INT-04 CI pipeline

- Owner: INT
- Reviewed: 2026-10-10, by RD
- Round: 1
- **Verdict: Approved**

## What was checked

I read `.github/workflows/ci.yml`, `scripts/ops/ci-steps.mjs`, `scripts/ops/ci-local.mjs`, `tooling/ci/ci-steps.test.mjs` and the root `ci:local` script.

`bash scripts/ops/workspace.sh pnpm ci:local` (with `MONGOMS_SYSTEM_BINARY` set, see BE-01) gave:

- Typecheck: PASS
- Lint: PASS
- Format: **FAIL**
- Unit tests: PASS
- e2e: PASS
- Build: PASS

The format failure is two INT-06 files still in progress (`apps/api/src/integrations/storage/sigv4.ts` and `sigv4.spec.ts`), not INT-04. `ci:local` reported it correctly and kept going, which is the intended behaviour.

Checklist sections applied: A, E (secrets), I, M.

## Acceptance criteria

| Criterion | Holds? | Evidence |
| --- | --- | --- |
| `.github/workflows/ci.yml` runs install (pnpm cache), typecheck, lint with the boundary rule, unit and e2e tests with in-memory Mongo | Yes | It also checks format and runs the build. Uses `--frozen-lockfile`, caches Mongo binaries, `permissions: contents: read`, cancels superseded runs |
| `pnpm ci:local` runs the same steps locally | Yes | A single step list in `ci-steps.mjs`. `ci-steps.test.mjs` fails if the workflow's `run:` lines drift from it |

## Findings

### Blockers

None.

### Should fix

None.

### Nits

1. Actions are pinned by major tag (`actions/checkout@v5`, `pnpm/action-setup@v4`, `actions/setup-node@v5`, `actions/cache@v4`). Pinning to commit SHAs (with a Dependabot or Renovate rule to bump them) protects against a compromised tag. Optional for Phase 1.
2. `docs/CONTRIBUTING.md` already tells owners to run `pnpm ci:local` before In review. From now on RD treats a failing `ci:local` step in the owner's own folders as a blocker.

## Requests to other workstreams

- To INT: run `pnpm format` on `apps/api/src/integrations/storage/sigv4*.ts` before INT-06 goes to review.

## Re-review log

- None yet.
