/* A quick look at one variant: does it load, are there errors, what does it draw. Usage: node scripts/smoke.cjs engine 40 [out.png] [zoom] */
const { chromium, startServer, sleep } = require("./lib.cjs");

(async () => {
  const [variant = "engine", n = "40", out = "", zoom = ""] = process.argv.slice(2);
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const t0 = Date.now();
  await page.goto(`${server.url}/?v=${variant}&n=${n}&hud=1`);
  await page.waitForFunction(() => window.__bench?.ready, null, { timeout: 120000 });
  console.log("ready after", Date.now() - t0, "ms");
  const idleStart = Date.now();
  await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 180000 }).catch(() => console.log("did not go idle"));
  console.log("idle after", Date.now() - idleStart, "ms");
  if (zoom) {
    await page.evaluate((z) => {
      const b = window.__bench;
      const a = b.anchor();
      const { w, h } = b.viewport();
      b.setCamera({ z, x: w / 2 - (a.x + a.w / 2) * z, y: h / 2 - (a.y + a.h / 2) * z });
    }, Number(zoom));
    await sleep(1500);
    await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 60000 }).catch(() => console.log("did not go idle after zoom"));
    await sleep(300);
  }
  console.log("stats", JSON.stringify(await page.evaluate(() => window.__bench.stats())));
  console.log("dom nodes", await page.evaluate(() => window.__bench.domNodes()));
  if (out) await page.screenshot({ path: out });
  console.log(errors.length ? `console problems:\n${errors.slice(0, 12).join("\n")}` : "no console errors or warnings");
  await browser.close();
  await server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
