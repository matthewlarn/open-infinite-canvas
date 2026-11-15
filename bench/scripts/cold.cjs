/*
 * Cold start. What does the engine feel like before it has any pictures?
 *
 * The page is loaded and the camera paths start at once, without waiting for the background work. Screens with
 * no picture yet are drawn as placeholders. No pictures are taken while the camera moves.
 *
 *   node scripts/cold.cjs [out.json] [--sizes 300,1000]
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium, startServer, frameStats, sleep } = require("./lib.cjs");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const OUT = path.resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : path.join(__dirname, "..", "results", "cold.json"));
const SIZES = arg("sizes", "300,1000").split(",").map(Number);
const PATHS = [
  ["pan-far", "Pan, zoomed out", 4000],
  ["zoom-sweep", "Zoom from everything to one screen and back", 6000],
];

(async () => {
  const server = await startServer();
  const runs = [];
  for (const n of SIZES) {
    for (const [id, label, ms] of PATHS) {
      /* A fresh page for each path, so each one really starts cold. */
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const t0 = Date.now();
      await page.goto(`${server.url}/?v=engine&n=${n}&hud=0`);
      await page.waitForFunction(() => window.__bench?.ready);
      const readyMs = Date.now() - t0;
      const res = await page.evaluate(([name, d]) => window.__bench.runPath(name, d), [id, ms]);
      const stats = await page.evaluate(() => window.__bench.stats());
      const s = frameStats(res.deltas, res.durationMs);
      const w0 = Date.now();
      await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 300000 });
      const after = await page.evaluate(() => window.__bench.stats());
      runs.push({
        n,
        path: id,
        label,
        readyMs,
        ...s,
        longTasks: res.longTasks.length,
        longTaskMs: Math.round(res.longTasks.reduce((a, l) => a + l.duration, 0)),
        picturesAtEnd: stats.pictures,
        placeholders: stats.drawn.placeholders,
        visible: stats.drawn.placeholders + stats.drawn.pictures,
        allPicturesMsAfterPath: Date.now() - w0,
        warmMs: after.warmMs,
      });
      process.stdout.write(`${n} ${id}: ready ${readyMs}ms, ${s.fps} fps, p95 ${s.p95Ms}ms, worst ${s.maxMs}ms, long tasks ${res.longTasks.length}, pictures ${stats.pictures}/${n} at the end, all pictures ${Math.round(after.warmMs)}ms after load\n`);
      await browser.close();
      await sleep(500);
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), runs }, null, 1));
  await server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
