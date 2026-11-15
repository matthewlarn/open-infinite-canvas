/*
 * Screenshots for the record, in light and dark.
 *
 *   node scripts/screenshots.cjs [screenshots dir]
 *
 * Every picture is of the production build, with the status strip on so the tier counts are visible.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium, startServer, sleep } = require("./lib.cjs");

const DIR = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "results", "screenshots"));

const SHOTS = [
  { file: "engine-300-far", query: "v=engine&n=300", view: "fit" },
  { file: "engine-300-overview", query: "v=engine&n=300", view: 0.16 },
  { file: "engine-300-mid", query: "v=engine&n=300", view: 0.5 },
  { file: "engine-300-near", query: "v=engine&n=300", view: 1 },
  { file: "engine-300-zoomed-in", query: "v=engine&n=300", view: 2 },
  { file: "engine-1000-far", query: "v=engine&n=1000", view: "fit" },
  { file: "engine-300-cold-start", query: "v=engine&n=300", view: "fit", cold: true },
  { file: "today-300-far", query: "v=today&n=300", view: "fit" },
  { file: "today-300-near", query: "v=today&n=300", view: 1 },
];

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const server = await startServer();
  for (const theme of ["light", "dark"]) {
    for (const s of SHOTS) {
      /* The baseline is shown once. It looks the same as the engine when it has finished drawing. */
      if (theme === "dark" && s.file.startsWith("today")) continue;
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${server.url}/?${s.query}&hud=1&theme=${theme}`, { timeout: 600000 });
      await page.waitForFunction(() => window.__bench?.ready, null, { timeout: 600000 });
      if (s.cold) {
        /* Half a second in. Some screens have their picture, the rest are still placeholders. */
        await sleep(500);
      } else {
        await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 600000 });
        if (s.view !== "fit") {
          await page.evaluate((z) => {
            const b = window.__bench;
            const a = b.anchor();
            const { w, h } = b.viewport();
            b.setCamera({ z, x: Math.round(w / 2 - (a.x + a.w / 2) * z), y: Math.round(h * 0.42 - (a.y + a.h * 0.35) * z) });
          }, s.view);
          await sleep(1500);
          await page.waitForFunction(() => window.__bench.idle(), null, { timeout: 120000 }).catch(() => {});
        }
        await sleep(700);
      }
      const out = path.join(DIR, `${s.file}-${theme}.png`);
      await page.screenshot({ path: out });
      process.stdout.write(`${path.basename(out)}\n`);
      await browser.close();
    }
  }
  await server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
