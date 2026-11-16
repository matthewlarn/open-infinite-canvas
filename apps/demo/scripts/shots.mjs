/*
 * Makes the screenshot files the demo's "Screenshot files" provider loads. One PNG for each screen template,
 * device and theme, written to apps/demo/public/shots and to apps/demo/dist/shots.
 *
 * Run it with `pnpm demo:shots`, which builds the demo first. It uses the Chromium the benchmarks use.
 */
import { mkdirSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const demo = join(here, "..");
const require = createRequire(join(demo, "..", "..", "bench", "package.json"));
const { chromium, startServer } = require("./scripts/lib.cjs");

const VARIANTS = 29;
const DEVICES = { phone: [393, 852], tablet: [820, 1180], desktop: [1440, 900] };
const out = join(demo, "public", "shots");
const built = join(demo, "dist", "shots");
mkdirSync(out, { recursive: true });
mkdirSync(built, { recursive: true });

const server = await startServer({ dir: join(demo, "dist") });
const browser = await chromium.launch();
let made = 0;
try {
  for (const theme of ["light", "dark"]) {
    for (const [device, [width, height]] of Object.entries(DEVICES)) {
      const page = await browser.newPage({ viewport: { width, height } });
      for (let v = 0; v < VARIANTS; v++) {
        /* Seed v renders template v. The screen fills the window, so the window is the device. */
        await page.goto(`${server.url}/screen.html?i=${v}&theme=${theme}`);
        await page.waitForLoadState("load");
        await page.waitForTimeout(250);
        const file = `${v}-${device}-${theme}.png`;
        await page.screenshot({ path: join(out, file) });
        copyFileSync(join(out, file), join(built, file));
        made++;
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`Made ${made} screenshots in ${out}`);
