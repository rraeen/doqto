// Keeps `pnpm ci:local` and GitHub CI identical (INT-04).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CI_STEPS } from '../../scripts/ops/ci-steps.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('ci.yml runs exactly the ci:local steps, in order, after install', () => {
  const yml = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  const runs = [...yml.matchAll(/^\s+run: (.+)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(runs, ['pnpm install --frozen-lockfile', ...CI_STEPS.map((s) => s.run)]);
  const names = [...yml.matchAll(/^\s+- name: (.+)$/gm)].map((m) => m[1].trim());
  for (const step of CI_STEPS)
    assert.ok(names.includes(step.name), `missing step name: ${step.name}`);
});

test('root package.json exposes ci:local and every script the steps call', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['ci:local'], 'node scripts/ops/ci-local.mjs');
  for (const step of CI_STEPS) {
    const script = step.run.replace(/^pnpm /, '');
    assert.ok(pkg.scripts[script], `package.json has no "${script}" script`);
  }
});
