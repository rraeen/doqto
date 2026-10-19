#!/usr/bin/env bash
# Downloads mongod from the official mongo Docker image (no Docker daemon
# needed) for API e2e tests, where fastdl.mongodb.org is blocked.
#
#   bash scripts/ops/fetch-mongod.sh            # -> ~/.cache/doqto-mongod/mongod
#   MONGO_TAG=8.0 bash scripts/ops/fetch-mongod.sh
#
# `pnpm ci:local` picks the binary up automatically when MONGOMS_SYSTEM_BINARY
# is unset. Needs curl and jq; Linux amd64 only (the image's mongod is built for
# Ubuntu, so it runs on Ubuntu/Debian-like hosts).
set -euo pipefail

TAG="${MONGO_TAG:-8.0}"
OUT_DIR="${MONGOD_DIR:-$HOME/.cache/doqto-mongod}"
OUT="$OUT_DIR/mongod"
REPO="library/mongo"
REGISTRY="https://registry-1.docker.io/v2/$REPO"

if [[ -x "$OUT" ]]; then
  echo "[fetch-mongod] already present: $OUT ($("$OUT" --version 2>/dev/null | head -1 || true))" >&2
  echo "$OUT"
  exit 0
fi
mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

TOKEN="$(curl -fsSL "https://auth.docker.io/token?service=registry.docker.io&scope=repository:$REPO:pull" | jq -r .token)"
auth=(-H "Authorization: Bearer $TOKEN")
accept_index='application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json'
accept_manifest='application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'

echo "[fetch-mongod] resolving mongo:$TAG linux/amd64" >&2
DIGEST="$(curl -fsSL "${auth[@]}" -H "Accept: $accept_index" "$REGISTRY/manifests/$TAG" |
  jq -r '.manifests[] | select(.platform.os=="linux" and .platform.architecture=="amd64") | .digest' | head -1)"
[[ -n "$DIGEST" && "$DIGEST" != null ]] || { echo "[fetch-mongod] no linux/amd64 manifest" >&2; exit 1; }

# mongod lives in the image's largest layer.
LAYER="$(curl -fsSL "${auth[@]}" -H "Accept: $accept_manifest" "$REGISTRY/manifests/$DIGEST" |
  jq -r '.layers | max_by(.size) | .digest')"

echo "[fetch-mongod] downloading layer $LAYER" >&2
curl -fsSL "${auth[@]}" -o "$TMP/layer.tgz" "$REGISTRY/blobs/$LAYER"
tar -xzf "$TMP/layer.tgz" -C "$TMP" usr/bin/mongod
mv "$TMP/usr/bin/mongod" "$OUT"
chmod +x "$OUT"
echo "[fetch-mongod] $("$OUT" --version | head -1)" >&2
echo "$OUT"
