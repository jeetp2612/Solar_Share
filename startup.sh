#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT"
# :8081 is QA-only — a revive must never inherit a stale built-output preview.
# Called directly, not via npm: no node_modules needed, so nothing to wait for.
node scripts/preview.mjs stop || true

# A sandbox revive restores the snapshot's node_modules, which was installed on
# another OS: the Vite/Tailwind native binaries for *this* machine are then
# missing and `vite` dies with "Cannot find native binding". Re-add only what is
# missing, best-effort (offline is fine — the check below just skips the install).
if [ "$(uname -s)" = "Linux" ] && [ "$(uname -m)" = "x86_64" ] &&
  ! ls node_modules/@rolldown/binding-linux-x64-gnu/*.node >/dev/null 2>&1; then
  ver() { node -p "require('./node_modules/$1/package.json').version" 2>/dev/null || echo "$2"; }
  timeout 300 npm install --no-save --no-audit --no-fund \
    "@rolldown/binding-linux-x64-gnu@$(ver rolldown 1.2.7)" \
    "@tailwindcss/oxide-linux-x64-gnu@$(ver tailwindcss 4.3.3)" \
    "lightningcss-linux-x64-gnu@$(ver lightningcss 1.33.0)" >/dev/null 2>&1 || true
fi

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
