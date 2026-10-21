#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
node server.mjs --lan
read -r -p "Press Enter to close..."
