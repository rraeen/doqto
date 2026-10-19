#!/usr/bin/env bash
# Runs a command in a local, installable copy of the shared Doqto folder.
#
# The shared folder (/mnt/project-files/doqto) is a network mount without
# symlink support, so pnpm cannot install there and node_modules must never
# live there. This script mirrors the source into a local directory, installs
# dependencies, and runs the given command in that copy.
#
#   scripts/ops/workspace.sh                 # sync + install only
#   scripts/ops/workspace.sh pnpm ci:local   # sync + install + run
#   DOQTO_WORK=~/my-copy scripts/ops/workspace.sh pnpm dev
#
# Edits made in the local copy are NOT copied back; edit files in the shared
# folder (your own workstream's folders) and re-run. The one exception is
# pnpm-lock.yaml: pass --write-lock to copy the refreshed lockfile back.
set -euo pipefail

SRC="${DOQTO_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
WORK="${DOQTO_WORK:-$HOME/.doqto-work}"
WRITE_LOCK=0
if [[ "${1:-}" == "--write-lock" ]]; then WRITE_LOCK=1; shift; fi

mkdir -p "$WORK"
echo "[workspace] syncing $SRC -> $WORK" >&2
# Mirror source, keep local node_modules and build output between runs.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude node_modules --exclude .next --exclude dist --exclude coverage \
    --exclude '*.tsbuildinfo' --exclude .demo-storage --exclude .env \
    "$SRC"/ "$WORK"/
else
  node "$SRC/scripts/ops/mirror.mjs" "$SRC" "$WORK"
fi
# The shared .env (if any) always wins, so edits to it reach the mirror.
if [[ -f "$SRC/.env" ]]; then cp "$SRC/.env" "$WORK/.env"; fi

cd "$WORK"
echo "[workspace] pnpm install" >&2
pnpm install --prefer-offline --reporter=append-only >&2

if [[ $WRITE_LOCK -eq 1 && -f pnpm-lock.yaml ]]; then
  if ! cmp -s pnpm-lock.yaml "$SRC/pnpm-lock.yaml" 2>/dev/null; then
    cp pnpm-lock.yaml "$SRC/pnpm-lock.yaml"
    echo "[workspace] wrote pnpm-lock.yaml back to $SRC" >&2
  fi
fi

if [[ $# -gt 0 ]]; then
  echo "[workspace] running: $*" >&2
  exec "$@"
fi
