#!/usr/bin/env bash
# Runs every measurement in order on the current build.
# One thing at a time, so nothing competes for the processor while a frame rate is being measured.
set -u
cd "$(dirname "$0")/.."
R=results
mkdir -p "$R"
step() { echo; echo "=== $1 ($(date -u +%H:%M:%S)) ==="; }

step "build";        (cd .. && pnpm build) 2>&1 | tail -3; pnpm build:app 2>&1 | tail -3
step "environment";  node scripts/env.cjs "$R/environment.json" > /dev/null && echo done
step "elements";     node scripts/count.cjs 290 "$R/elements.json" | tail -1
rm -f "$R/bench.json" "$R/bench-extra.json"
step "main matrix";  node scripts/run.cjs --variants engine,today,naive --sizes 100,300,1000 --repeats 2 --out "$R/bench.json"
step "extras";       node scripts/run.cjs --variants pre,csszoom,naive-nowc,iframes --sizes 100,300 --repeats 2 --out "$R/bench-extra.json"
GPU_ARGS="--use-angle=swiftshader --ignore-gpu-blocklist --enable-gpu-rasterization --enable-unsafe-swiftshader"
rm -f "$R/bench-gpu-path.json"
step "gpu path";     BENCH_CHROME_ARGS="$GPU_ARGS" node scripts/run.cjs --variants engine,today,naive --sizes 100,300 --repeats 2 --out "$R/bench-gpu-path.json"
step "cold start";   node scripts/cold.cjs "$R/cold.json" --sizes 300,1000
step "trace check";  node scripts/presented.cjs "$R/presented.json" --variants engine,today,naive --sizes 300 --paths zoom-sweep,pan-far
step "crispness";    node scripts/crispness.cjs "$R/crispness.json" "$R/screenshots"
step "pictures";     node scripts/snapshot.cjs "$R/snapshot.json" | cut -c1-300
step "precision";    node scripts/precision.cjs "$R/precision.json" | tail -3
step "screenshots";  node scripts/screenshots.cjs "$R/screenshots"
step "compare";      node scripts/compare.cjs "$R/bench.json"
echo; echo "ALL DONE $(date -u +%H:%M:%S)"
