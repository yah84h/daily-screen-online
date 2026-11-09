#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22 or newer, then reopen this file."
  read -r -p "Press Enter to close..."
  exit 1
fi
if [ -f adapter.ts ] && [ -f ../scripts/start-mac.mjs ] && [ -f ../package.json ]; then
  node ../scripts/start-mac.mjs
else
  node server.mjs --lan --open
fi
result=$?
if [ "$result" -ne 0 ]; then read -r -p "Press Enter to close..."; fi
exit "$result"
