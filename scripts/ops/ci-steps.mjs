// The checks CI runs, in order. Used by `pnpm ci:local` and asserted equal to
// the `run:` steps of .github/workflows/ci.yml by tooling/ci/ci-steps.test.mjs,
// so local and GitHub CI cannot drift apart.
export const CI_STEPS = [
  { name: 'Typecheck', run: 'pnpm typecheck' },
  { name: 'Lint (incl. reviews/ranking/search must not import payments)', run: 'pnpm lint' },
  { name: 'Format', run: 'pnpm format:check' },
  { name: 'Unit tests', run: 'pnpm test' },
  { name: 'e2e tests (in-memory MongoDB)', run: 'pnpm test:e2e' },
  { name: 'Build', run: 'pnpm build' },
];
