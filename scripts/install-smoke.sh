#!/usr/bin/env bash
# L5 install smoke: README 安装路径（`dsh plugin add dsh-pictor`），封闭可重复。
#
# pictor 依赖 dsh-app-dock（成员应用入伙方式）：本地目录模式下先
# `dsh plugin add <dock-root>` 再装 pictor（目录安装时 pnpm 按
# package.json 的 `link:`/`^0.1.2` 依赖解析）。发布后
# PIC_INSTALL_SPEC=dsh-pictor 走 npm registry。tarball 完整性由
# package-integrity.sh 单独保证。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCK_ROOT="$(cd "$ROOT" && pwd)/../dsh-app-dock"
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

SPEC="${PIC_INSTALL_SPEC:-}"
if [ -n "$SPEC" ]; then
  MODE="registry:${SPEC}"
else
  [ -d "$DOCK_ROOT" ] || { echo "FAIL: dock 仓库不存在 $DOCK_ROOT" >&2; exit 1; }
  MODE="local-dirs(dock+pictor)"
fi

# --- the README flow -------------------------------------------------------
dsh --profile web --help >/dev/null 2>&1
if [ -n "$SPEC" ]; then
  dsh plugin --profile web add "$SPEC" >/dev/null 2>&1 || { echo "FAIL: dsh plugin add $SPEC" >&2; exit 1; }
else
  dsh plugin --profile web add "$DOCK_ROOT" >/dev/null 2>&1 || { echo "FAIL: dsh plugin add $DOCK_ROOT" >&2; exit 1; }
  dsh plugin --profile web add "$ROOT" >/dev/null 2>&1 || { echo "FAIL: dsh plugin add $ROOT" >&2; exit 1; }
fi

PLUGIN_ROOT="$DSH_HOME/profiles/web/node_modules/dsh-pictor"
for f in lib/index.js lib/client.js cordis.patch.yml package.json; do
  [ -f "$PLUGIN_ROOT/$f" ] || { echo "FAIL: installed package missing $f" >&2; exit 1; }
done
grep -q 'dsh-pictor' "$DSH_HOME/profiles/web/package.json" \
  || { echo "FAIL: profile manifest does not list dsh-pictor" >&2; exit 1; }
grep -q 'dsh-app-dock' "$DSH_HOME/profiles/web/package.json" \
  || { echo "FAIL: profile manifest does not list dsh-app-dock" >&2; exit 1; }

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

# Client bundles served.
curl -sf "http://127.0.0.1:${PORT}/plugins/dsh-pictor/client.js" -o /dev/null \
  || { echo "FAIL: pictor client bundle not served" >&2; exit 1; }
curl -sf "http://127.0.0.1:${PORT}/plugins/dsh-app-dock/client.js" -o /dev/null \
  || { echo "FAIL: dock client bundle not served" >&2; exit 1; }

echo "install smoke OK (${MODE}, port ${PORT}, /pictor reachable)"