/*
 * A second opinion on frame rate.
 *
 * The main benchmark counts animation frame callbacks, which is what the page's own code sees. A page can run
 * its callbacks on time while the compositor falls behind. This script records a browser trace during the same
 * paths and counts the frames the compositor actually drew, and the ones Chrome itself marked as dropped.
 *
 *   node scripts/presented.cjs [out.json] [--variants engine,today] [--sizes 300]
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium, startServer, frameStats, sleep } = require("./lib.cjs");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const OUT = path.resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : path.join(__dirname, "..", "results", "presented.json"));
const VARIANTS = arg("variants", "engine,today,naive").split(",");
const SIZES = arg("sizes", "300").split(",").map(Number);
const PATHS = arg("paths", "zoom-sweep,pan-far").split(",");
const DURATION = { "zoom-sweep": 6000, "pan-far": 4000, "pan-mid": 5000, "pan-near": 5000 };

(async () => {
  const server = await startServer();
  const rows = [];
  for (const n of SIZES) {
    for (const v of VARIANTS) {
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${server.url}/?v=${v}&n=${n}&hud=0`, { timeout: 600000 });
      await page.waitForFunction(() => window.__bench?.ready, null, { timeout: 600000 });
      await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 600000 });
      await sleep(1000);
      for (const p of PATHS) {
        await browser.startTracing(page, { categories: ["benchmark", "cc", "viz", "blink.user_timing", "disabled-by-default-devtools.timeline.frame"] });
        const res = await page.evaluate(([name, ms]) => window.__bench.runPath(name, ms), [p, DURATION[p]]);
        const trace = JSON.parse((await browser.stopTracing()).toString());
        const events = trace.traceEvents ?? trace;
        const mark = (name) => events.find((e) => e.name === name && /user_timing/.test(e.cat ?? ""))?.ts;
        const t0 = mark("path-start");
        const t1 = mark("path-end");
        const inWindow = (e) => t0 !== undefined && t1 !== undefined && e.ts >= t0 && e.ts <= t1;
        const count = (name) => events.filter((e) => e.name === name && inWindow(e) && (e.ph === "I" || e.ph === "i" || e.ph === "X" || e.ph === "B" || e.ph === "b")).length;
        /* Chrome's own verdict on each frame it tried to produce. */
        const states = {};
        for (const e of events) {
          if (e.name !== "PipelineReporter" || !inWindow(e)) continue;
          const state = e.args?.chrome_frame_reporter?.state ?? e.args?.frame_reporter?.state;
          if (state) states[state] = (states[state] ?? 0) + 1;
        }
        const seconds = t0 !== undefined && t1 !== undefined ? (t1 - t0) / 1e6 : res.durationMs / 1000;
        const row = {
          variant: v,
          n,
          path: p,
          callbacks: frameStats(res.deltas, res.durationMs),
          traceSeconds: +seconds.toFixed(2),
          drawFrame: count("DrawFrame"),
          drawFramePerSecond: +(count("DrawFrame") / seconds).toFixed(1),
          droppedFrame: count("DroppedFrame"),
          beginMainThreadFrame: count("BeginMainThreadFrame"),
          pipelineStates: states,
          traceEvents: events.length,
        };
        rows.push(row);
        process.stdout.write(`${v} ${n} ${p}: callbacks ${row.callbacks.fps} fps, compositor drew ${row.drawFramePerSecond} a second (${row.drawFrame} frames, ${row.droppedFrame} dropped events), states ${JSON.stringify(states)}\n`);
        await sleep(1500);
      }
      await browser.close();
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 1));
  await server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
