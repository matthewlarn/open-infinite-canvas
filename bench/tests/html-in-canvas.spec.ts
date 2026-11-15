/* The HTML in Canvas provider, in a Chromium started with the flag for the first shape of the proposal. */
import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { idle, open, stats } from "./helpers";

const report = (page: Page) => page.evaluate(() => ({ support: window.__snapshot.hasDrawElement(), errors: window.__snapshot.pictureErrors.slice() }));

async function colours(page: Page) {
  const png = PNG.sync.read(await page.screenshot({ type: "png" }));
  const seen = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4 * 7) seen.add((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2]);
  return seen.size;
}

test.use({ launchOptions: { args: ["--enable-blink-features=CanvasDrawElement"] } });

test.describe("in Chromium with the early HTML in Canvas flag", () => {
  for (const provider of ["html-in-canvas", "auto"]) {
    test(`the ${provider} provider pictures every screen through the browser's own painting`, async ({ page }) => {
      await open(page, `v=engine&n=40&provider=${provider}`);
      await idle(page);
      const r = await report(page);
      const s = await stats(page);
      expect(r.support).not.toBeNull();
      expect(r.errors).toEqual([]);
      expect(s.pictures).toBe(40);
      /* No copy of a screen is left behind in the page. */
      expect(await page.evaluate(() => document.querySelectorAll("canvas[layoutsubtree]").length)).toBe(0);
      expect(await colours(page)).toBeGreaterThan(200);
    });
  }
});
