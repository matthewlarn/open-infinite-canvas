/* Shared helpers for the benchmark scripts. CommonJS, because `require("playwright")` resolves from the machine's global tools. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const DIST = path.join(__dirname, "..", process.env.BENCH_DIST ?? path.join("app", "dist"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

/**
 * Serves a production build on a free port, or on `port` if given. `dir` defaults to the benchmark page's build.
 */
function startServer(options = {}) {
  const dir = path.resolve(options.dir ?? DIST);
  if (!fs.existsSync(path.join(dir, "index.html"))) throw new Error(`No build found in ${dir}. Run \`pnpm bench\` or \`pnpm --filter open-infinite-canvas-bench build:app\` first.`);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let file = path.join(dir, decodeURIComponent(url.pathname));
    if (!file.startsWith(dir)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, "index.html");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

/** Percentile of an unsorted list. */
function pct(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

/** Frame statistics from the milliseconds between animation frames. */
function frameStats(deltas, durationMs) {
  const n = deltas.length;
  const sum = deltas.reduce((a, b) => a + b, 0);
  return {
    frames: n,
    fps: n ? +(n / (durationMs / 1000)).toFixed(1) : 0,
    meanMs: n ? +(sum / n).toFixed(2) : 0,
    p50Ms: +pct(deltas, 50).toFixed(2),
    p95Ms: +pct(deltas, 95).toFixed(2),
    p99Ms: +pct(deltas, 99).toFixed(2),
    maxMs: n ? +Math.max(...deltas).toFixed(2) : 0,
    /* A frame that took longer than one and a half refresh intervals missed at least one refresh. */
    over25: deltas.filter((d) => d > 25).length,
    over50: deltas.filter((d) => d > 50).length,
    over100: deltas.filter((d) => d > 100).length,
    pctOver25: n ? +((deltas.filter((d) => d > 25).length / n) * 100).toFixed(1) : 0,
  };
}

/**
 * Memory of every process the browser runs, in megabytes: the browser itself, the renderer, the GPU process and
 * helpers. Proportional set size, so memory shared between processes is counted once.
 */
async function browserMemoryMb(browser) {
  try {
    const cdp = await browser.newBrowserCDPSession();
    const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
    await cdp.detach().catch(() => {});
    let kb = 0;
    const byType = {};
    for (const p of processInfo) {
      let one = 0;
      try {
        const m = fs.readFileSync(`/proc/${p.id}/smaps_rollup`, "utf8").match(/^Pss:\s+(\d+) kB/m);
        if (m) one = Number(m[1]);
      } catch {
        try {
          const m = fs.readFileSync(`/proc/${p.id}/status`, "utf8").match(/^VmRSS:\s+(\d+) kB/m);
          if (m) one = Number(m[1]);
        } catch {
          /* The process ended between the listing and the read. */
        }
      }
      kb += one;
      byType[p.type] = (byType[p.type] ?? 0) + Math.round(one / 1024);
    }
    return { totalMb: Math.round(kb / 1024), byType };
  } catch {
    return null;
  }
}

/** Chrome's own counters: script, style and layout time, heap and node counts. */
async function metrics(cdp) {
  const { metrics: list } = await cdp.send("Performance.getMetrics");
  const m = Object.fromEntries(list.map((x) => [x.name, x.value]));
  return {
    nodes: m.Nodes,
    documents: m.Documents,
    listeners: m.JSEventListeners,
    heapUsedMb: +(m.JSHeapUsedSize / 1048576).toFixed(1),
    layoutCount: m.LayoutCount,
    recalcStyleCount: m.RecalcStyleCount,
    layoutMs: +(m.LayoutDuration * 1000).toFixed(1),
    recalcStyleMs: +(m.RecalcStyleDuration * 1000).toFixed(1),
    scriptMs: +(m.ScriptDuration * 1000).toFixed(1),
    taskMs: +(m.TaskDuration * 1000).toFixed(1),
  };
}

const diff = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, +(b[k] - a[k]).toFixed(1)]));

/** Compositor layers as Chrome reports them: how many, how many draw, and the pixels they would hold at full size. */
async function layers(cdp) {
  let latest = null;
  let fired = false;
  const on = (e) => {
    fired = true;
    latest = e.layers ?? latest;
  };
  cdp.on("LayerTree.layerTreeDidChange", on);
  await cdp.send("LayerTree.enable");
  const until = Date.now() + 1500;
  while (!latest && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 200));
  await cdp.send("LayerTree.disable");
  cdp.off("LayerTree.layerTreeDidChange", on);
  /* Chrome sends the event with no list when the page has no composited layers of its own. */
  if (!latest) return { layers: 0, drawing: 0, megapixels: 0, largest: 0, compositing: fired };
  const drawing = latest.filter((l) => l.drawsContent);
  const megapixels = drawing.reduce((s, l) => s + (l.width * l.height) / 1e6, 0);
  return { layers: latest.length, drawing: drawing.length, megapixels: +megapixels.toFixed(1), largest: drawing.reduce((m, l) => Math.max(m, l.width * l.height), 0) };
}

async function gc(cdp) {
  try {
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.collectGarbage");
  } catch {
    /* Not fatal. The heap number is then an upper bound. */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { chromium, startServer, pct, frameStats, browserMemoryMb, metrics, diff, layers, gc, sleep, DIST };
