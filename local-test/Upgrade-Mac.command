#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
node upgrade-data.mjs
read -r -p "Press Enter to close..."
