/*
 * What does one picture cost?
 *
 * Mounts one of every screen template, then takes a picture of each one five times, one at a time, with nothing
 * else running. Reports wall time, and how much of it kept the main thread busy. Then repeats with extra unused
 * CSS on the page, because the SVG path embeds the whole stylesheet in every picture. Last, tries the HTML in
 * Canvas drawing call behind its flag, to see whether this browser can paint a live element straight to a canvas.
 *
 *   node scripts/snapshot.cjs [out.json]
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium, startServer, pct, sleep } = require("./lib.cjs");

const OUT = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "results", "snapshot.json"));

async function measure(page, cdp, label) {
  const before = (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
  const rows = await page.evaluate(async () => {
    const out = [];
    const roots = [...document.querySelectorAll(".naive-root")];
    for (const root of roots) {
      const frame = root.closest(".naive-frame");
      const w = frame.offsetWidth;
      const h = frame.offsetHeight;
      const name = frame.querySelector(".naive-label").textContent;
      const runs = [];
      for (let i = 0; i < 5; i++) {
        const { picture, timings } = await window.__snapshot.capture(root, w, h, 0.5);
        picture.bitmap.close();
        runs.push(timings);
      }
      runs.sort((a, b) => a.totalMs - b.totalMs);
      out.push({ name, w, h, elements: root.querySelectorAll("*").length, ...runs[2] });
    }
    return out;
  });
  const after = (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
  const totals = rows.map((r) => r.totalMs);
  const cssBytes = await page.evaluate(() => window.__snapshot.pageCss().length);
  return {
    label,
    cssBytes,
    screens: rows.length,
    captures: rows.length * 5,
    medianMs: +pct(totals, 50).toFixed(1),
    p95Ms: +pct(totals, 95).toFixed(1),
    maxMs: +Math.max(...totals).toFixed(1),
    serializeMsMedian: +pct(rows.map((r) => r.serializeMs), 50).toFixed(2),
    decodeMsMedian: +pct(rows.map((r) => r.decodeMs), 50).toFixed(1),
    drawMsMedian: +pct(rows.map((r) => r.drawMs), 50).toFixed(1),
    svgBytesMedian: Math.round(pct(rows.map((r) => r.svgBytes), 50)),
    /* Main thread time for the whole batch, divided by the number of pictures taken. */
    mainThreadMsPerCapture: +(((after - before) * 1000) / (rows.length * 5)).toFixed(1),
    rows,
  };
}

(async () => {
  const server = await startServer();
  const result = { measuredAt: new Date().toISOString(), runs: [] };

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  /* 29 screens is one of every template in every state. */
  await page.goto(`${server.url}/?v=naive-nowc&n=29&hud=0`);
  await page.waitForFunction(() => window.__bench?.ready);
  await sleep(1000);
  result.runs.push(await measure(page, cdp, "The demo's own stylesheet"));
  process.stdout.write(`own css: ${JSON.stringify({ ...result.runs[0], rows: undefined })}\n`);

  /* Several screens in one SVG image. The fixed cost of an image is then paid once for the group. */
  result.batches = [];
  for (const size of [1, 4, 8]) {
    const before = (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
    const r = await page.evaluate(async (group) => {
      const roots = [...document.querySelectorAll(".naive-root")].filter((el) => el.closest(".naive-frame").offsetWidth < 500);
      const items = roots.map((el) => ({ el, w: el.closest(".naive-frame").offsetWidth, h: el.closest(".naive-frame").offsetHeight }));
      const t0 = performance.now();
      let pictures = 0;
      const rounds = 3;
      for (let round = 0; round < rounds; round++) {
        for (let i = 0; i < items.length; i += group) {
          const res = await window.__snapshot.captureBatch(items.slice(i, i + group), 0.5);
          pictures += res.pictures.length;
          res.pictures.forEach((p) => p.bitmap.close());
        }
      }
      return { pictures, wallMs: performance.now() - t0 };
    }, size);
    const after = (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
    const row = { group: size, pictures: r.pictures, wallMsPerPicture: +(r.wallMs / r.pictures).toFixed(1), mainThreadMsPerPicture: +(((after - before) * 1000) / r.pictures).toFixed(1) };
    result.batches.push(row);
    process.stdout.write(`batch of ${size}: ${JSON.stringify(row)}\n`);
  }

  /* A design system's stylesheet is far larger than this demo's. Pad the page to see what that costs. */
  for (const kb of [150, 400]) {
    await page.evaluate((target) => {
      document.getElementById("pad")?.remove();
      const style = document.createElement("style");
      style.id = "pad";
      const rules = [];
      let size = 0;
      for (let i = 0; size < target * 1024; i++) {
        const rule = `.pad-${i}:where(.never-used-${i % 97}) > .child-${i} { margin-inline: ${i % 13}px; color: oklch(0.${50 + (i % 40)} 0.1 ${i % 360}); border-radius: ${i % 9}px; }`;
        rules.push(rule);
        size += rule.length + 1;
      }
      style.textContent = rules.join("\n");
      document.head.appendChild(style);
      window.__snapshot.invalidateCss();
    }, kb);
    await sleep(500);
    const run = await measure(page, cdp, `Plus ${kb} KB of unused CSS`);
    /* The same padded page, eight screens to an image. */
    const b0 = (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
    const batched = await page.evaluate(async () => {
      const roots = [...document.querySelectorAll(".naive-root")].filter((el) => el.closest(".naive-frame").offsetWidth < 500);
      const items = roots.map((el) => ({ el, w: el.closest(".naive-frame").offsetWidth, h: el.closest(".naive-frame").offsetHeight }));
      const t0 = performance.now();
      let pictures = 0;
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < items.length; i += 8) {
          const res = await window.__snapshot.captureBatch(items.slice(i, i + 8), 0.5);
          pictures += res.pictures.length;
          res.pictures.forEach((p) => p.bitmap.close());
        }
      }
      return { pictures, wallMs: performance.now() - t0 };
    });
    const b1 = (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
    run.batchOf8 = { wallMsPerPicture: +(batched.wallMs / batched.pictures).toFixed(1), mainThreadMsPerPicture: +(((b1 - b0) * 1000) / batched.pictures).toFixed(1) };
    result.runs.push(run);
    process.stdout.write(`+${kb}KB: ${JSON.stringify({ ...run, rows: undefined })}\n`);
  }
  await browser.close();

  /* HTML in Canvas. Chromium 141 has the first shape of the API behind a flag: a `layoutsubtree` canvas and `drawElement`. */
  const flagged = await chromium.launch({ args: ["--enable-blink-features=CanvasDrawElement"] });
  const p2 = await flagged.newPage({ viewport: { width: 1440, height: 900 } });
  await p2.goto(`${server.url}/?v=naive-nowc&n=29&hud=0`);
  await p2.waitForFunction(() => window.__bench?.ready);
  await sleep(1000);
  result.htmlInCanvas = await p2.evaluate(async () => {
    const kind = window.__snapshot.hasDrawElement();
    if (!kind) return { available: false };
    const out = { available: true, api: kind, rows: [], errors: [] };
    const roots = [...document.querySelectorAll(".naive-root")];
    const next = () => new Promise((r) => requestAnimationFrame(r));
    for (const root of roots.slice(0, 29)) {
      const frame = root.closest(".naive-frame");
      const w = frame.offsetWidth;
      const h = frame.offsetHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.setAttribute("layoutsubtree", "");
      canvas.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;z-index:9999`;
      /* The element to draw must be a child of the canvas, so the screen is moved in and moved back. */
      const parent = root.parentElement;
      canvas.appendChild(root);
      document.body.appendChild(canvas);
      await next();
      await next();
      const ctx = canvas.getContext("2d");
      try {
        const times = [];
        for (let i = 0; i < 5; i++) {
          const t0 = performance.now();
          ctx.clearRect(0, 0, w, h);
          ctx[kind](root, 0, 0);
          /* Making a half size bitmap forces the drawing to happen, and is what the engine would keep. */
          const bmp = await createImageBitmap(canvas, { resizeWidth: Math.round(w / 2), resizeHeight: Math.round(h / 2) });
          times.push(performance.now() - t0);
          bmp.close();
        }
        times.sort((a, b) => a - b);
        let tainted = false;
        try {
          ctx.getImageData(0, 0, 1, 1);
        } catch {
          tainted = true;
        }
        out.rows.push({ name: frame.querySelector(".naive-label").textContent, ms: times[2], tainted });
        /* Leave the first few on screen for a moment so a screenshot can show whether anything was drawn. */
        if (out.rows.length <= 3) {
          canvas.style.left = `${(out.rows.length - 1) * 410}px`;
          canvas.dataset.keep = "1";
        }
      } catch (e) {
        out.errors.push(String(e.message).slice(0, 160));
      }
      if (canvas.dataset.keep) {
        /* The screen has to stay a child of the canvas for the drawing to stay valid in this build. */
        out.kept = (out.kept ?? 0) + 1;
      } else {
        parent.appendChild(root);
        canvas.remove();
      }
    }
    const ms = out.rows.map((r) => r.ms).sort((a, b) => a - b);
    out.medianMs = ms.length ? +ms[Math.floor(ms.length / 2)].toFixed(2) : null;
    out.maxMs = ms.length ? +ms[ms.length - 1].toFixed(2) : null;
    out.tainted = out.rows.filter((r) => r.tainted).length;
    return out;
  });
  /* The canvases cover the page, so a screenshot shows what `drawElement` painted. The live screens are their children and are not painted themselves. */
  const { PNG } = require("pngjs");
  const shot = await p2.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1230, height: 852 } });
  fs.mkdirSync(path.join(__dirname, "..", "results", "screenshots"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "results", "screenshots", "html-in-canvas-flagged.png"), shot);
  const png = PNG.sync.read(shot);
  const seen = new Set();
  for (let i = 0; i < png.data.length; i += 4 * 53) seen.add((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2]);
  result.htmlInCanvas.screenshotColours = seen.size;
  result.htmlInCanvas.browser = flagged.version();
  result.htmlInCanvas.flag = "--enable-blink-features=CanvasDrawElement";
  await flagged.close();
  process.stdout.write(`html in canvas: ${JSON.stringify({ ...result.htmlInCanvas, rows: undefined })}\n`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  await server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
