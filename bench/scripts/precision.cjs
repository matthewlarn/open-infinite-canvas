/*
 * Coordinate precision far from the origin.
 *
 * The whole world is moved a long way from zero, then one screen is put at an exact place on the screen at
 * several zoom levels. Two errors are measured:
 *
 * - `domError`: where the browser says the screen's box is, against where the camera maths says it should be.
 * - `pixelError`: where the screen's left edge actually lands in a screenshot, against the same expectation.
 * - `shows`: whether the live screen is drawn there, or only the far canvas's picture of it, or nothing.
 *
 * Three ways of placing live screens are compared: one transformed parent with the origin at world zero (what
 * ships today), the engine with a fixed origin, and the engine with an origin that follows the view.
 *
 *   node scripts/precision.cjs [out.json]
 */
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const { chromium, startServer, sleep } = require("./lib.cjs");

const OUT = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "results", "precision.json"));
const OFFSETS = [0, 1e6, 1e7, 3e7];
const ZOOMS = [1, 4, 16, 64];
const CASES = [
  { id: "today", label: "One transformed parent, origin at world zero", query: "v=today", host: ".naive-frame" },
  { id: "engine-fixed", label: "Engine, origin fixed at world zero", query: "v=engine&origin=fixed&warm=0", host: '.ic-frame[data-mode="live"]' },
  { id: "engine-floating", label: "Engine, origin follows the view", query: "v=engine&origin=floating&warm=0", host: '.ic-frame[data-mode="live"]' },
];

(async () => {
  const server = await startServer();
  const result = { measuredAt: new Date().toISOString(), offsets: OFFSETS, zooms: ZOOMS, cases: [] };
  for (const c of CASES) {
    const rows = [];
    for (const far of OFFSETS) {
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${server.url}/?${c.query}&n=6&hud=0&far=${far}`);
      await page.waitForFunction(() => window.__bench?.ready);
      await sleep(500);
      for (const z of ZOOMS) {
        /* Put the top left corner of the first screen at exactly (300, 200) on screen. */
        const expected = await page.evaluate((zoom) => {
          const b = window.__bench;
          const f = b.frames[0];
          b.setCamera({ z: zoom, x: 300 - f.x * zoom, y: 200 - f.y * zoom });
          return { x: 300, y: 200, w: f.w * zoom, h: f.h * zoom };
        }, z);
        await sleep(1200);
        await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 30000 }).catch(() => {});
        await sleep(400);
        const dom = await page.evaluate((sel) => {
          const hosts = [...document.querySelectorAll(sel)];
          /* The host nearest the expected corner. */
          let best = null;
          let bestD = Infinity;
          for (const h of hosts) {
            const r = h.getBoundingClientRect();
            const d = Math.hypot(r.left - 300, r.top - 200);
            if (d < bestD) {
              bestD = d;
              best = { x: r.left, y: r.top, w: r.width, h: r.height };
            }
          }
          return best;
        }, c.host);
        /* Two screenshots. The first has the far canvas hidden, so only live DOM can be in it. The second is the
           page as a person sees it. In each, find the first column on a row through the screen that is not
           canvas background, and check that content follows it. */
        const look = async (hideFar) => {
          if (hideFar) await page.evaluate(() => document.querySelector(".ic-far")?.style.setProperty("visibility", "hidden"));
          const png = PNG.sync.read(await page.screenshot({ type: "png" }));
          if (hideFar) await page.evaluate(() => document.querySelector(".ic-far")?.style.removeProperty("visibility"));
          const bg = [png.data[0], png.data[1], png.data[2]];
          const row = Math.min(png.height - 2, 400);
          const differs = (x) => {
            const o = (row * png.width + x) * 4;
            return Math.abs(png.data[o] - bg[0]) + Math.abs(png.data[o + 1] - bg[1]) + Math.abs(png.data[o + 2] - bg[2]) > 12;
          };
          for (let x = 0; x < png.width; x++) {
            if (!differs(x)) continue;
            for (let k = x + 2; k < x + 12; k++) if (!differs(k)) return null;
            return x;
          }
          return null;
        };
        const liveEdge = await look(true);
        const anyEdge = await look(false);
        const edge = liveEdge;
        const shows = liveEdge !== null ? "live" : anyEdge !== null ? "picture" : "nothing";
        rows.push({
          far,
          z,
          domError: dom ? +Math.max(Math.abs(dom.x - expected.x), Math.abs(dom.y - expected.y)).toFixed(3) : null,
          sizeError: dom ? +Math.abs(dom.w - expected.w).toFixed(3) : null,
          /* The outline is one pixel outside the box, so an edge at 299 or 300 is exact. */
          pixelError: edge === null ? null : Math.max(0, Math.abs(edge - 299.5) - 0.5),
          edge,
          shows,
        });
      }
      await browser.close();
    }
    result.cases.push({ ...c, rows });
    process.stdout.write(`${c.id}\n${rows.map((r) => `  far ${String(r.far).padEnd(9)} z ${String(r.z).padEnd(3)} dom ${r.domError} size ${r.sizeError} pixel ${r.pixelError} (edge ${r.edge}) shows ${r.shows}`).join("\n")}\n`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  await server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
