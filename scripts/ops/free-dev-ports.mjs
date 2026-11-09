// Frees the dev ports (3000 web, 3010 console, 4000 API) and stops leftover dev watchers of this
// repo, so `pnpm run dev` can start cleanly. Use it when you see "EADDRINUSE" or the console
// reports "ECONNREFUSED 127.0.0.1:4000": that means an old API or watcher from an earlier run is
// still alive (on Windows, closing a terminal or killing one process can leave children behind).
//   pnpm run dev:free
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORTS = [3000, 3010, 4000];
const killed = new Set();

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function kill(pid, why) {
  if (!pid || pid === process.pid || killed.has(pid)) return;
  killed.add(pid);
  if (process.platform === 'win32') run('taskkill', ['/PID', String(pid), '/T', '/F']);
  else run('kill', ['-9', String(pid)]);
  console.log(`stopped ${pid} (${why})`);
}

if (process.platform === 'win32') {
  // Listeners on the dev ports.
  for (const line of run('netstat', ['-ano', '-p', 'tcp']).split(/\r?\n/)) {
    const m = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/);
    if (m && PORTS.includes(Number(m[1]))) kill(Number(m[2]), `port ${m[1]}`);
  }
  // Dev watchers of this repo that are not on a port: the API watcher, the shared package's tsc
  // watch, and test runners left behind. Matched by the repo path in their command line.
  const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${repo.replace(/'/g, "''")}*' -and $_.CommandLine -match 'nest|tsc|next|jest|vitest' } | ForEach-Object { $_.ProcessId }`;
  for (const pid of run('powershell', ['-NoProfile', '-Command', ps]).split(/\s+/).filter(Boolean)) {
    kill(Number(pid), 'dev watcher');
  }
} else {
  for (const port of PORTS) {
    for (const pid of run('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']).split(/\s+/).filter(Boolean)) {
      kill(Number(pid), `port ${port}`);
    }
  }
}

console.log(killed.size ? 'Done. Now run: pnpm run dev' : 'Nothing to stop. The dev ports are free.');
