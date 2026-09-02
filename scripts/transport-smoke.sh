#!/usr/bin/env bash
# pictor transport smoke test: boot the real DSH web host with dsh-pictor
# mounted and exercise the /pictorial RPC channel over real HTTP. Catches the
# exact class of bug where the client can see the tab but every call dies with
# "transport failure ... HTTP 405" (channel never registered).
#
# Complements verify.mjs (offline mock lifecycle): this layer proves the
# connection.rpc.handle registration actually lands on the web server and the
# response envelope (+ error object protocol) is honored end to end.
#
# Usage: bash scripts/transport-smoke.sh   (or: npm run verify:integration)
# NOTE: use ${VAR} everywhere - macOS bash 3.2 mangles $VAR immediately
# followed by a multibyte (CJK) character.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="${DSH_HOME}/profiles/web"
PKG="${PROFILE_DIR}/package.json"
PORT="${PIC_SMOKE_PORT:-43121}"
BASE="http://127.0.0.1:${PORT}"
LOG="$(mktemp -d)/dsh-web.log"
SERVER_PID=""

cleanup() {
  if [ -n "${SERVER_PID}" ]; then kill "${SERVER_PID}" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

echo "== pictor transport smoke (web profile on :${PORT})"

# 1) Mount dsh-pictor into the web profile, idempotently.
if [ ! -f "${PKG}" ]; then
  echo "FAIL: web profile missing (${PKG}); create it via 'dsh --profile web' once"
  exit 1
fi
python3 - "${PKG}" <<PYEOF
import json, sys
p = sys.argv[1]
d = json.load(open(p))
d.setdefault("dependencies", {})["dsh-pictor"] = "link:${ROOT}"
b = d.setdefault("dsh", {}).setdefault("profile", {}).setdefault("bundles", [])
if "dsh-pictor" not in b:
    b.append("dsh-pictor")
    print("-- appended dsh-pictor to bundles:", b)
json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)
open(p, "a").write("\n")
PYEOF
mkdir -p "${PROFILE_DIR}/node_modules"
LINK="${PROFILE_DIR}/node_modules/dsh-pictor"
if [ ! -L "${LINK}" ]; then
  ln -s "${ROOT}" "${LINK}"
  echo "-- linked ${LINK} -> ${ROOT}"
fi

# 2) Boot the web host (background) and wait for the /api carrier.
dsh --profile web --no-open --port "${PORT}" >"${LOG}" 2>&1 &
SERVER_PID=$!
READY=0
for _ in $(seq 1 40); do
  if curl -s -o /dev/null "http://127.0.0.1:${PORT}/api/session.list" --max-time 2; then READY=1; break; fi
  sleep 1
done
if [ ${READY} -ne 1 ]; then
  echo "FAIL: web host did not come up on :${PORT}"
  tail -20 "${LOG}"
  exit 1
fi
echo "-- web host ready (pid ${SERVER_PID})"

# 3) Failure leg: empty task.create must route and return a protocol error object.
RESP="$(curl -s -X POST "${BASE}/pictor/project.create" \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"smoke-1","method":"project.create","payload":{}}' --max-time 10)"
echo "-- project.create(empty) => ${RESP}"
if ! grep -q '"ok":false' <<<"${RESP}" || ! grep -q '"error"' <<<"${RESP}"; then
  echo "FAIL: expected an error-object response for empty task.create"
  echo "${RESP}"
  exit 1
fi

# 4) Success leg: config.get must route and return ok:true with the value payload.
RESP2="$(curl -s -X POST "${BASE}/pictor/config.get" \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"smoke-2","method":"config.get","payload":{}}' --max-time 10)"
echo "-- config.get => ${RESP2}"
if ! grep -q '"ok":true' <<<"${RESP2}" || ! grep -q 'dataRoot' <<<"${RESP2}"; then
  echo "FAIL: expected ok:true with dataRoot for config.get"
  echo "${RESP2}"
  exit 1
fi

# 4b) Asset leg: the empty-state placeholder must be served by the host route.
RESP3="$(curl -s -o /tmp/pictor-asst.png -w '%{http_code}' "${BASE}/pictor/asset/empty-state.png" --max-time 10)"
ASZ="$(stat -f%z /tmp/pictor-asst.png 2>/dev/null || echo 0)"
echo "-- asset empty-state.png => HTTP ${RESP3} (${ASZ} bytes)"
if [ "${RESP3}" != "200" ] || [ "${ASZ}" -lt 1000 ]; then
  echo "FAIL: expected the placeholder image to be served over HTTP"
  exit 1
fi

echo "PASS transport smoke: /pictor channel registered and serving on real HTTP (${BASE})"