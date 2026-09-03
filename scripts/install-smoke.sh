#!/usr/bin/env bash
# L5 install smoke: the README install path (`dsh plugin add dsh-pictor`),
# hermetic and repeatable.
#
# Default (CI): pack the CURRENT repo into a tarball — `files` whitelist
# included — install it into a fresh temp profile via `dsh plugin add`, boot a
# real dsh web, and assert the /pictor RPC channel, the client bundle and the
# placeholder asset are served. Tests the code being pushed, not an older
# published build.
#
# Registry mode: POMASA_INSTALL_SPEC=dsh-pictor (or @<version>) installs from
# npm instead — the exact README flow, for release verification after publish.
#
# Never touches a real profile: DSH_HOME/PICTOR_HOME point at a temp dir that
# is removed on exit. dsh/pnpm must be on PATH (exit 2 = "skipped", for hooks).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PIC_INSTALL_PORT:-43995}"
BASE="/tmp/pictor-install-smoke-$$"

command -v dsh >/dev/null 2>&1 \
  || { echo "skip: 'dsh' CLI not found on PATH" >&2; exit 2; }
command -v pnpm >/dev/null 2>&1 \
  || { echo "skip: 'pnpm' not found on PATH — dsh plugin installs via pnpm" >&2; exit 2; }

mkdir -p "$BASE"
trap 'rm -rf "$BASE"' EXIT

export DSH_HOME="$BASE/dsh_home"
export PICTOR_HOME="$BASE/pictor_home"
mkdir -p "$PICTOR_HOME"

# --- pick install source ---------------------------------------------------
SPEC="${POMASA_INSTALL_SPEC:-}"
if [ -n "$SPEC" ]; then
  PKG="$SPEC"
  MODE="registry:${SPEC}"
else
  DEST="$BASE/pkg"
  mkdir -p "$DEST"
  (cd "$ROOT" && npm pack --pack-destination "$DEST" >/dev/null)
  PKG_FILE="$(ls "$DEST"/*.tgz | head -1)"
  [ -n "$PKG_FILE" ] || { echo "FAIL: no tarball produced" >&2; exit 1; }
  # Package integrity: every path the host needs at boot must be in the tarball.
  FAIL=0
  for need in \
    package/lib/index.js \
    package/lib/client.js \
    package/cordis.patch.yml \
    package/agents/10.orchestrator.md \
    package/references/domain/visual-principles.md \
    package/assets/empty-state.png; do
    if ! tar tzf "$PKG_FILE" | grep -qFx "$need"; then
      echo "FAIL: tarball missing $need" >&2
      FAIL=1
    fi
  done
  [ "$FAIL" = "0" ] || { echo "tarball: $(basename "$PKG_FILE")" >&2; exit 1; }
  PKG="$PKG_FILE"
  MODE="local-tarball:$(basename "$PKG_FILE")"
fi

# --- the README flow -------------------------------------------------------
dsh --profile web --help >/dev/null 2>&1
dsh plugin --profile web add "$PKG" >/dev/null 2>&1 \
  || { echo "FAIL: dsh plugin add $PKG" >&2; exit 1; }

PLUGIN_ROOT="$DSH_HOME/profiles/web/node_modules/dsh-pictor"
for f in lib/index.js lib/client.js cordis.patch.yml package.json; do
  [ -f "$PLUGIN_ROOT/$f" ] || { echo "FAIL: installed package missing $f" >&2; exit 1; }
done
grep -q 'dsh-pictor' "$DSH_HOME/profiles/web/package.json" \
  || { echo "FAIL: profile manifest does not list dsh-pictor" >&2; exit 1; }

# --- boot and assert -------------------------------------------------------
dsh --profile web --no-open --port "$PORT" >"$BASE/dsh.log" 2>&1 &
DPID=$!
trap 'kill "$DPID" 2>/dev/null || true; rm -rf "$BASE"' EXIT

ready=0
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:${PORT}/" -o /dev/null 2>/dev/null; then ready=1; break; fi
  sleep 0.5
done
if [ "$ready" != "1" ]; then
  echo "FAIL: dsh web did not become ready" >&2
  tail -30 "$BASE/dsh.log" 2>/dev/null || true
  exit 1
fi

# RPC error leg: empty project.create must route and return a protocol error.
RESP="$(curl -s -X POST "http://127.0.0.1:${PORT}/pictor/project.create" \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"smoke-1","method":"project.create","payload":{}}')"
echo "$RESP" | grep -q '"ok":false' && echo "$RESP" | grep -q '"error"' \
  || { echo "FAIL: project.create(empty) should error — $RESP" >&2; exit 1; }

# RPC success leg: config.get returns the dataRoot.
RESP2="$(curl -s -X POST "http://127.0.0.1:${PORT}/pictor/config.get" \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"smoke-2","method":"config.get","payload":{}}')"
echo "$RESP2" | grep -q '"ok":true' && echo "$RESP2" | grep -q 'dataRoot' \
  || { echo "FAIL: config.get should return dataRoot — $RESP2" >&2; exit 1; }

# Client bundle served.
curl -sf "http://127.0.0.1:${PORT}/plugins/dsh-pictor/client.js" -o /dev/null \
  || { echo "FAIL: client bundle not served" >&2; exit 1; }

# Placeholder asset route.
curl -sf "http://127.0.0.1:${PORT}/pictor/asset/empty-state.png" -o /dev/null \
  || { echo "FAIL: empty-state.png not served" >&2; exit 1; }

echo "install smoke OK (${MODE}, port ${PORT}, /pictor reachable)"