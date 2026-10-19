// Measures first-load JS the way RD reviews it (FE-02, TDD 9.1): every <script src> in the served
// HTML except the `noModule` polyfills modern browsers skip, each gzipped at level 9, summed.
// Usage: node scripts/first-load-js.mjs [baseUrl] [path ...]   (against `next build && next start`)
import { gzipSync } from 'node:zlib';

const [base = 'http://localhost:3000', ...rest] = process.argv.slice(2);
const paths = rest.length ? rest : ['/', '/login', '/profile', '/clinic', '/admin'];
const BUDGET_KB = 200;
let over = false;

for (const path of paths) {
  const html = await (await fetch(base + path)).text();
  const srcs = [...html.matchAll(/<script\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => !/\bnomodule\b/i.test(tag))
    .map((tag) => /\bsrc="([^"]+)"/.exec(tag)?.[1])
    .filter(Boolean);
  let bytes = 0;
  for (const src of new Set(srcs)) {
    const body = Buffer.from(await (await fetch(new URL(src, base))).arrayBuffer());
    bytes += gzipSync(body, { level: 9 }).length;
  }
  const kb = bytes / 1024;
  if (kb > BUDGET_KB) over = true;
  process.stdout.write(
    `${path.padEnd(12)} ${String(srcs.length).padStart(3)} scripts  ${kb.toFixed(1)} KB gzip\n`,
  );
}
if (over) {
  console.error(`Over the ${BUDGET_KB} KB first-load budget.`);
  process.exitCode = 1;
}
