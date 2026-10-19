// Fallback for scripts/ops/workspace.sh when rsync is missing: mirrors SRC
// into DEST (copy changed files, delete removed ones), skipping dependency
// and build folders. Usage: node mirror.mjs <src> <dest>
import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '.demo-storage',
  '.env',
  '.git',
]);
const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('usage: node mirror.mjs <src> <dest>');
  process.exit(2);
}

// The shared folder is a network mount; a file another agent is writing can
// fail to read (EIO) for a moment. Retry, then skip it with a warning.
function copyIfChanged(a, b) {
  for (let attempt = 1; ; attempt++) {
    try {
      const sa = fs.statSync(a);
      const sb = fs.existsSync(b) ? fs.statSync(b) : null;
      if (!sb || sb.size !== sa.size || sb.mtimeMs !== sa.mtimeMs) {
        fs.copyFileSync(a, b);
        fs.utimesSync(b, sa.atime, sa.mtime);
      }
      return;
    } catch (err) {
      if (attempt >= 4) {
        console.warn(`[mirror] skipped ${a}: ${err.code ?? err.message}`);
        return;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 * attempt);
    }
  }
}

function mirror(from, to) {
  fs.mkdirSync(to, { recursive: true });
  const wanted = new Set();
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.endsWith('.tsbuildinfo')) continue;
    wanted.add(entry.name);
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) {
      mirror(a, b);
    } else if (entry.isFile()) {
      copyIfChanged(a, b);
    }
  }
  for (const name of fs.readdirSync(to)) {
    if (!wanted.has(name) && !SKIP.has(name))
      fs.rmSync(path.join(to, name), { recursive: true, force: true });
  }
}

mirror(path.resolve(src), path.resolve(dest));
