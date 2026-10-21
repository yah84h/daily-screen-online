#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22 or newer from https://nodejs.org then run this again."
  read -r -p "Press Enter to close..."
  exit 1
fi
node server.mjs --lan --open
