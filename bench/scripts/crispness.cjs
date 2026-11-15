/*
 * Text crispness at several zoom levels.
 *
 * For each way of drawing the same text-heavy screen, the camera is put at 100% and then moved to the zoom
 * under test. Once the page is still, the same 600 by 400 pixel area of the viewport is captured and scored.
 *
 * The score is the variance of the Laplacian of the image's brightness. Sharp edges give a high score, a
 * stretched bitmap gives a low one. Each score is divided by the score of the reference, which is the browser
 * drawing the page fresh at that scale with no layer hint. 1.0 means as sharp as the browser can draw it.
 *
 *   node scripts/crispness.cjs [out.json] [screenshots dir]
 */
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");
const { chromium, startServer, sleep } = require("./lib.cjs");

const OUT = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "results", "crispness.json"));
const SHOTS = path.resolve(process.argv[3] ?? path.join(__dirname, "..", "results", "screenshots"));
const ZOOMS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const CLIP = { x: 420, y: 250, width: 600, height: 400 };

const PIPELINES = [
  { id: "reference", label: "Browser redraws at every scale (no will-change)", query: "v=naive-nowc" },
  { id: "today", label: "Today: will-change always on the parent", query: "v=today" },
  { id: "engine", label: "Engine, view settled", query: "v=engine" },
  { id: "engine-moving", label: "Engine, as drawn during a gesture (will-change held)", query: "v=engine&wc=always" },
  { id: "engine-pictures", label: "Engine, pictures only (no live screens)", query: "v=engine&maxLive=0" },
];

function sharpness(buffer) {
  const png = PNG.sync.read(buffer);
  const { width: w, height: h, data } = png;
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) luma[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - w] - luma[i + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await startServer();
  const results = { measuredAt: new Date().toISOString(), zooms: ZOOMS, clip: CLIP, pipelines: [] };
  for (const p of PIPELINES) {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    /* Six screens. The sixth is the long article, the most text on one screen. */
    await page.goto(`${server.url}/?${p.query}&n=6&hud=0`);
    await page.waitForFunction(() => window.__bench?.ready);
    await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 60000 });
    const scores = {};
    for (const z of ZOOMS) {
      const set = (zoom) =>
        page.evaluate((zz) => {
          const b = window.__bench;
          const f = b.frames[5];
          const { w, h } = b.viewport();
          /* A point in the middle of the article's body text. */
          const wx = f.x + f.w / 2;
          const wy = f.y + 520;
          b.setCamera({ z: zz, x: Math.round(w / 2 - wx * zz), y: Math.round(h / 2 - wy * zz) });
        }, zoom);
      await set(1);
      await sleep(900);
      await set(z);
      await sleep(1300);
      await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 30000 }).catch(() => {});
      await sleep(300);
      const shot = await page.screenshot({ type: "png", clip: CLIP });
      scores[z] = sharpness(shot);
      if (z === 2 || z === 4 || z === 0.25) fs.writeFileSync(path.join(SHOTS, `crisp-${p.id}-z${String(z).replace(".", "_")}.png`), shot);
    }
    results.pipelines.push({ ...p, scores });
    await browser.close();
    process.stdout.write(`${p.id.padEnd(16)} ${ZOOMS.map((z) => `${z}:${scores[z].toFixed(0)}`).join("  ")}\n`);
  }
  const ref = results.pipelines.find((p) => p.id === "reference").scores;
  for (const p of results.pipelines) p.ratio = Object.fromEntries(ZOOMS.map((z) => [z, +(p.scores[z] / ref[z]).toFixed(2)]));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  process.stdout.write("\nRatio to reference\n");
  for (const p of results.pipelines) process.stdout.write(`${p.id.padEnd(16)} ${ZOOMS.map((z) => `${z}:${p.ratio[z]}`).join("  ")}\n`);
  await server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
