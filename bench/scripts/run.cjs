/*
 * The benchmark. For every variant and screen count it loads the production build in a fresh headless Chromium,
 * runs the same four scripted camera paths, and writes what it measured to a JSON file.
 *
 *   node scripts/run.cjs --variants engine,today,naive --sizes 100,300,1000 --out results/bench.json
 *
 * Nothing is typed by hand. `scripts/compare.cjs` reads the JSON and prints it beside the reference run.
 */
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const { chromium, startServer, frameStats, browserMemoryMb, metrics, diff, layers, gc, sleep, pct } = require("./lib.cjs");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const VARIANTS = arg("variants", "engine,today,naive").split(",");
const SIZES = arg("sizes", "100,300,1000").split(",").map(Number);
const PATHS = arg("paths", "zoom-sweep,pan-far,pan-mid,pan-near").split(",");
const REPEATS = Number(arg("repeats", "2"));
const OUT = path.resolve(arg("out", path.join(__dirname, "..", "results", "bench.json")));
const EXTRA = arg("query", "");
const LOAD_TIMEOUT = Number(arg("load-timeout", "600000"));
const DURATION = { "zoom-sweep": 6000, "pan-far": 4000, "pan-mid": 5000, "pan-near": 5000 };
const VIEWPORT = { width: 1440, height: 900 };

/** How many visible screens show nothing but the canvas background. A screen the browser has not drawn yet. */
async function blankCheck(page) {
  const png = PNG.sync.read(await page.screenshot({ type: "png" }));
  const info = await page.evaluate(() => {
    const b = window.__bench;
    const cam = b.getCamera();
    const { w, h } = b.viewport();
    const top = document.querySelector(".stage")?.getBoundingClientRect().top ?? 0;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--ic-canvas").trim();
    const rects = [];
    for (const f of b.frames) {
      const x = f.x * cam.z + cam.x;
      const y = f.y * cam.z + cam.y + top;
      const fw = f.w * cam.z;
      const fh = f.h * cam.z;
      /* Fully inside the viewport and big enough to sample. */
      if (x >= 0 && y >= top && x + fw <= w && y + fh <= h + top && fw >= 8 && fh >= 8) rects.push([x, y, fw, fh]);
    }
    return { rects, bg };
  });
  const m = /^#([0-9a-f]{6})$/i.exec(info.bg);
  const bg = m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [236, 235, 230];
  let blank = 0;
  for (const [x, y, w, h] of info.rects) {
    let same = 0;
    let total = 0;
    for (let i = 1; i <= 5; i++) {
      for (let j = 1; j <= 5; j++) {
        const px = Math.min(png.width - 1, Math.round(x + (w * i) / 6));
        const py = Math.min(png.height - 1, Math.round(y + (h * j) / 6));
        const o = (py * png.width + px) * 4;
        total++;
        if (Math.abs(png.data[o] - bg[0]) <= 3 && Math.abs(png.data[o + 1] - bg[1]) <= 3 && Math.abs(png.data[o + 2] - bg[2]) <= 3) same++;
      }
    }
    if (same === total) blank++;
  }
  return { visible: info.rects.length, blank, blankPct: info.rects.length ? +((blank / info.rects.length) * 100).toFixed(1) : 0 };
}

/* Extra Chromium switches, for example to force the GPU compositing path on a software GL. */
const CHROME_ARGS = (process.env.BENCH_CHROME_ARGS ?? "").split(" ").filter(Boolean);

async function runOne(server, variant, n) {
  const browser = await chromium.launch({ args: CHROME_ARGS });
  const result = { variant, n, ok: false };
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const problems = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`);
    });
    page.on("crash", () => problems.push("page crashed"));

    const t0 = Date.now();
    await page.goto(`${server.url}/?v=${variant}&n=${n}&hud=0${EXTRA ? `&${EXTRA}` : ""}`, { timeout: LOAD_TIMEOUT });
    await page.waitForFunction(() => window.__bench?.ready, null, { timeout: LOAD_TIMEOUT });
    result.loadMs = Date.now() - t0;
    result.loadLongTasks = await page.evaluate(() => {
      const l = window.__bench.longTasks();
      return { count: l.length, totalMs: Math.round(l.reduce((s, x) => s + x.duration, 0)), maxMs: Math.round(Math.max(0, ...l.map((x) => x.duration))) };
    });
    result.blankAtLoad = await blankCheck(page);

    /* Background work, for variants that have any. The engine takes a picture of every screen. */
    const w0 = Date.now();
    await page.waitForFunction(() => window.__bench.idle(), null, { timeout: LOAD_TIMEOUT });
    result.backgroundMs = Date.now() - w0;
    await sleep(1500);

    await gc(cdp);
    result.atRest = { ...(await metrics(cdp)), browserMemory: await browserMemoryMb(browser), domElements: await page.evaluate(() => window.__bench.domNodes()), stats: await page.evaluate(() => window.__bench.stats()) };
    result.layersFar = await layers(cdp);
    result.blankAtRest = await blankCheck(page);

    result.paths = {};
    for (const p of PATHS) {
      const runs = [];
      for (let r = 0; r < REPEATS; r++) {
        const before = await metrics(cdp);
        const res = await page.evaluate(([name, ms]) => window.__bench.runPath(name, ms), [p, DURATION[p]]);
        const blank = await blankCheck(page);
        const after = await metrics(cdp);
        const d = diff(before, after);
        runs.push({
          ...frameStats(res.deltas, res.durationMs),
          longTasks: res.longTasks.length,
          longTaskMs: Math.round(res.longTasks.reduce((s, l) => s + l.duration, 0)),
          longTaskMaxMs: Math.round(Math.max(0, ...res.longTasks.map((l) => l.duration))),
          styleMs: d.recalcStyleMs,
          layoutMs: d.layoutMs,
          scriptMs: d.scriptMs,
          taskMs: d.taskMs,
          styleCount: d.recalcStyleCount,
          layoutCount: d.layoutCount,
          blankAtEnd: blank,
          stats: await page.evaluate(() => window.__bench.stats()),
        });
        /* Let the view settle and any background work finish before the next run. */
        await sleep(600);
        const s0 = Date.now();
        await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 120000 }).catch(() => {});
        runs[runs.length - 1].settleMs = Date.now() - s0 + 600;
        await sleep(400);
      }
      const best = [...runs].sort((a, b) => a.fps - b.fps)[Math.floor(runs.length / 2)];
      result.paths[p] = { median: best, runs };
      process.stdout.write(`    ${p.padEnd(11)} ${runs.map((r) => `${r.fps} fps p95 ${r.p95Ms}ms max ${r.maxMs}ms long ${r.longTasks}`).join("  |  ")}\n`);
    }

    /* Layers and memory with one screen at 100%, then with about twenty at 50%. */
    for (const [key, z] of [["near", 1], ["mid", 0.5]]) {
      await page.evaluate((zoom) => {
        const b = window.__bench;
        const a = b.anchor();
        const { w, h } = b.viewport();
        b.setCamera({ z: zoom, x: w / 2 - (a.x + a.w / 2) * zoom, y: h / 2 - (a.y + a.h / 2) * zoom });
      }, z);
      await sleep(1200);
      await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 120000 }).catch(() => {});
      await sleep(500);
      result[`layers${key[0].toUpperCase()}${key.slice(1)}`] = await layers(cdp);
      result[`at${key[0].toUpperCase()}${key.slice(1)}`] = { domElements: await page.evaluate(() => window.__bench.domNodes()), stats: await page.evaluate(() => window.__bench.stats()), blank: await blankCheck(page) };
    }

    await gc(cdp);
    result.atEnd = { ...(await metrics(cdp)), browserMemory: await browserMemoryMb(browser), domElements: await page.evaluate(() => window.__bench.domNodes()) };
    result.problems = problems.slice(0, 10);
    result.ok = true;
  } catch (e) {
    result.error = String(e.message).split("\n")[0];
  } finally {
    await browser.close().catch(() => {});
  }
  return result;
}

(async () => {
  const server = await startServer();
  const all = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { runs: [] };
  all.viewport = VIEWPORT;
  all.chromeArgs = CHROME_ARGS;
  all.durationsMs = DURATION;
  all.repeats = REPEATS;
  for (const n of SIZES) {
    for (const v of VARIANTS) {
      process.stdout.write(`\n${v} × ${n}\n`);
      const started = Date.now();
      const r = await runOne(server, v, n);
      r.measuredAt = new Date().toISOString();
      r.wallMs = Date.now() - started;
      r.query = EXTRA;
      all.runs = all.runs.filter((x) => !(x.variant === v && x.n === n && (x.query ?? "") === EXTRA));
      all.runs.push(r);
      /* Written after every run, so a restart loses one run at most. */
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
      if (r.ok) {
        process.stdout.write(`  load ${r.loadMs}ms, background ${r.backgroundMs}ms, heap ${r.atRest.heapUsedMb}MB, browser ${r.atRest.browserMemory?.totalMb}MB, elements ${r.atRest.domElements}, layers ${r.layersFar?.layers}\n`);
      } else {
        process.stdout.write(`  FAILED: ${r.error}\n`);
      }
    }
  }
  await server.close();
  void pct;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
