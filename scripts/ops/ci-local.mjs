// `pnpm ci:local`: runs every CI step locally, keeps going after a failure,
// and prints a summary. Exit code is non-zero if any step failed.
// On the shared folder run it through the mirror:
//   bash scripts/ops/workspace.sh pnpm ci:local
// Flags: --only=<name substring>  --skip=<name substring>  (repeatable)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CI_STEPS } from './ci-steps.mjs';

const args = process.argv.slice(2);
const only = args.filter((a) => a.startsWith('--only=')).map((a) => a.slice(7).toLowerCase());
const skip = args.filter((a) => a.startsWith('--skip=')).map((a) => a.slice(7).toLowerCase());

const steps = CI_STEPS.filter((s) => {
  const n = s.name.toLowerCase();
  if (only.length && !only.some((o) => n.includes(o))) return false;
  return !skip.some((k) => n.includes(k));
});

const env = { ...process.env, CI: 'true', NEXT_TELEMETRY_DISABLED: '1' };
// Use the mongod from scripts/ops/fetch-mongod.sh when fastdl.mongodb.org is blocked.
const fetchedMongod = path.join(os.homedir(), '.cache/doqto-mongod/mongod');
if (!env.MONGOMS_SYSTEM_BINARY && existsSync(fetchedMongod)) {
  env.MONGOMS_SYSTEM_BINARY = fetchedMongod;
  console.log(`Using mongod at ${fetchedMongod} for e2e tests`);
}
const results = [];
for (const step of steps) {
  console.log(`\n=== ${step.name}: ${step.run}`);
  const started = Date.now();
  const r = spawnSync(step.run, { shell: true, stdio: 'inherit', env });
  results.push({
    ...step,
    ok: r.status === 0,
    seconds: ((Date.now() - started) / 1000).toFixed(1),
  });
}

console.log('\n=== ci:local summary');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} (${r.seconds}s)`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} step(s) failed.` : '\nAll steps passed.');
if (failed.some((r) => r.run === 'pnpm test:e2e') && !env.MONGOMS_SYSTEM_BINARY) {
  console.log(
    '\nHint: e2e tests download mongod from fastdl.mongodb.org. If that host is blocked, run\n' +
      '`bash scripts/ops/fetch-mongod.sh` once (takes mongod from the official Docker image)\n' +
      'and re-run; ci:local then uses it automatically.',
  );
}
process.exit(failed.length ? 1 : 0);
