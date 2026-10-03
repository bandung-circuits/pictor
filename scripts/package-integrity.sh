#!/usr/bin/env bash
# Package integrity: the npm tarball governed by package.json "files" must
# carry every path the host needs at boot (lib bundle, agents, pattern
# references, assets). Catches packaging regressions. Fast, no dsh, no network.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="/tmp/pictor-pack-check-$$"
mkdir -p "$BASE"
trap 'rm -rf "$BASE"' EXIT

(cd "$ROOT" && npm pack --pack-destination "$BASE" >/dev/null)
PKG_FILE="$(ls "$BASE"/*.tgz | head -1)"
[ -n "$PKG_FILE" ] || { echo "FAIL: no tarball produced" >&2; exit 1; }

# 注意：不要写 `tar tzf ... | grep -qFx` —— pipefail 下 grep -q 提前退出会让
# tar 收到 SIGPIPE，把命中误判成缺失（CI 上大 tarball 必现）。先落盘清单再查。
LIST="$BASE/contents.txt"
tar tzf "$PKG_FILE" > "$LIST"

FAIL=0
for need in \
  package/lib/index.js \
  package/lib/client.js \
  package/cordis.patch.yml \
  package/agents/10.orchestrator.md \
  package/references/domain/visual-principles.md \
  package/assets/empty-state.png \
  package/README.md; do
  if ! grep -qFx "$need" "$LIST"; then
    echo "FAIL: tarball missing $need" >&2
    FAIL=1
  fi
done

if [ "$FAIL" = "0" ]; then
  echo "package integrity OK ($(basename "$PKG_FILE"), $(wc -l < "$LIST" | tr -d ' ') entries)"
  exit 0
fi
awk -F/ '{print NF-1, $0}' "$LIST" | sort -n | head -40
exit 1