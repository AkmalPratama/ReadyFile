#!/usr/bin/env bash
# Rebuild 05_demo/vendor: plain-ESM copies of zod and the two engine packages,
# so the browser can run the real engine with an import map and no bundler.
# Run from anywhere:  bash 05_demo/rebuild-vendor.sh
set -euo pipefail
cd "$(dirname "$0")"

ZOD=../02_source/node_modules/zod
[ -d "$ZOD" ] || { echo "run npm install in 02_source first" >&2; exit 1; }

rm -rf vendor/core vendor/rules-engine vendor/zod
mkdir -p vendor/zod
(cd "$ZOD" && { echo index.js; echo LICENSE; find v4 -name '*.js'; } | tar cf - -T -) | tar xf - -C vendor/zod

(cd ../02_source && npx tsc -p ../05_demo/tsconfig.vendor.json)
echo "vendor rebuilt: $(find vendor -name '*.js' | wc -l | tr -d ' ') js files"