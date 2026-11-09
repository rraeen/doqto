// One backend only (ADR 0001, amended 2026-10-26): apps/api is the only server. The Next.js apps
// (web, and the console that serves everyone except patients) are front ends. They may proxy `/api/v1` to the API, nothing more:
// no route handlers, no server actions, no database or server framework in their dependencies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FRONT_ENDS = ['web', 'console'];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.next')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const rel = (p) => path.relative(root, p).replaceAll('\\', '/');

for (const app of FRONT_ENDS) {
  const appDir = path.join(root, 'apps', app);

  test(`apps/${app} has no Next.js route handlers`, () => {
    const handlers = [...walk(path.join(appDir, 'src', 'app'))]
      .filter((f) => /[\\/]route\.(ts|tsx|js|jsx)$/.test(f))
      .map(rel);
    assert.deepEqual(handlers, [], 'Add the endpoint to apps/api instead of a route handler');
  });

  test(`apps/${app} has no server actions`, () => {
    const offenders = [...walk(path.join(appDir, 'src'))]
      .filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))
      .filter((f) => /^\s*['"]use server['"]/m.test(fs.readFileSync(f, 'utf8')))
      .map(rel);
    assert.deepEqual(offenders, [], 'Server actions are backend code; put the logic in apps/api');
  });

  test(`apps/${app} has no backend or database dependencies`, () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const banned = deps.filter((d) =>
      /^(@nestjs\/|mongoose$|mongodb$|express$|fastify$|koa$|hono$|prisma$|@prisma\/|pg$|mysql2?$|redis$|ioredis$|bullmq$)/.test(
        d,
      ),
    );
    assert.deepEqual(banned, []);
  });
}

test('apps/api is the only app that depends on NestJS', () => {
  const owners = fs
    .readdirSync(path.join(root, 'apps'))
    .filter((app) => fs.existsSync(path.join(root, 'apps', app, 'package.json')))
    .filter((app) => {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'apps', app, 'package.json'), 'utf8'));
      return Object.keys({ ...pkg.dependencies }).some((d) => d.startsWith('@nestjs/'));
    });
  assert.deepEqual(owners, ['api']);
});
