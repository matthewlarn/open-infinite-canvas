/* The three ways a picture is made, and the fallback between them. */
import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { fitAll, idle, open, stats } from "./helpers";

const report = (page: Page) => page.evaluate(() => ({ support: window.__snapshot.hasDrawElement(), errors: window.__snapshot.pictureErrors.slice() }));

/** How many different colours a screenshot holds. Placeholders alone give a handful. Real pictures give hundreds. */
async function colours(page: Page) {
  const png = PNG.sync.read(await page.screenshot({ type: "png" }));
  const seen = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4 * 7) seen.add((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2]);
  return seen.size;
}

test.describe("in a browser with no HTML in Canvas (the default Chromium, and Safari and Firefox today)", () => {
  test("the default provider falls back to SVG and pictures every screen", async ({ page }) => {
    await open(page, "v=engine&n=40");
    await idle(page);
    const r = await report(page);
    const s = await stats(page);
    expect(r.support).toBeNull();
    expect(r.errors).toEqual([]);
    expect(s.pictures).toBe(40);
    expect(s.placeholders).toBe(0);
    expect(await colours(page)).toBeGreaterThan(200);
  });

  test("the HTML in Canvas provider on its own reports an error and leaves placeholders", async ({ page }) => {
    await open(page, "v=engine&n=12&provider=html-in-canvas");
    await idle(page);
    const r = await report(page);
    const s = await stats(page);
    expect(r.errors.length).toBe(12);
    expect(s.pictures).toBe(0);
    expect(s.placeholders).toBe(12);
  });

  test("the screenshot provider pictures every screen without mounting one", async ({ page }) => {
    await open(page, "v=engine&n=40&provider=screenshot");
    let mounted = 0;
    for (let i = 0; i < 20; i++) {
      mounted = Math.max(mounted, await page.evaluate(() => document.querySelectorAll(".ic-frame").length));
      await page.waitForTimeout(25);
    }
    await idle(page);
    const s = await stats(page);
    expect(mounted).toBe(0);
    expect(s.pictures).toBe(40);
    expect((await report(page)).errors).toEqual([]);
    /* The stand-in screenshot is a green card with a peach disc. The middle of a frame must be peach. */
    await fitAll(page);
    await idle(page);
    const at = await page.evaluate(() => {
      const f = window.__bench!.frames[0];
      const c = window.__bench!.getCamera();
      const top = document.querySelector(".ic-viewport")!.getBoundingClientRect().top;
      return { x: Math.round((f.x + f.w / 2) * c.z + c.x), y: Math.round((f.y + f.h / 2) * c.z + c.y + top) };
    });
    const png = PNG.sync.read(await page.screenshot({ type: "png" }));
    const o = (at.y * png.width + at.x) * 4;
    expect([png.data[o], png.data[o + 1], png.data[o + 2]]).toEqual([0xf0, 0xa6, 0x85]);
  });

  test("a frame with its own picture uses the file, and the rest use the provider", async ({ page }) => {
    await open(page, "v=engine&n=12&shot=3");
    await idle(page);
    const s = await stats(page);
    expect(s.pictures).toBe(12);
    expect((await report(page)).errors).toEqual([]);
    const at = await page.evaluate(() => {
      const c = window.__bench!.getCamera();
      const top = document.querySelector(".ic-viewport")!.getBoundingClientRect().top;
      return [0, 5].map((i) => {
        const f = window.__engine.frames.find((x) => x.id === `f${i}`)!;
        return { x: Math.round((f.x + f.w / 2) * c.z + c.x), y: Math.round((f.y + f.h / 2) * c.z + c.y + top) };
      });
    });
    const png = PNG.sync.read(await page.screenshot({ type: "png" }));
    const px = (p: { x: number; y: number }) => [0, 1, 2].map((k) => png.data[(p.y * png.width + p.x) * 4 + k]);
    expect(px(at[0])).toEqual([0xf0, 0xa6, 0x85]);
    expect(px(at[1])).not.toEqual([0xf0, 0xa6, 0x85]);
  });

  test("once a screen with its own picture has been used, the screen itself is pictured", async ({ page }) => {
    await open(page, "v=engine&n=12&shot=3");
    await idle(page);
    const centre = () =>
      page.evaluate(() => {
        const c = window.__bench!.getCamera();
        const top = document.querySelector(".ic-viewport")!.getBoundingClientRect().top;
        const f = window.__engine.frames.find((x) => x.id === "f1")!;
        return { x: Math.round((f.x + f.w / 2) * c.z + c.x), y: Math.round((f.y + f.h / 2) * c.z + c.y + top) };
      });
    const pixel = async () => {
      const at = await centre();
      const png = PNG.sync.read(await page.screenshot({ type: "png" }));
      return [0, 1, 2].map((k) => png.data[(at.y * png.width + at.x) * 4 + k]);
    };
    expect(await pixel()).toEqual([0xf0, 0xa6, 0x85]);
    await page.evaluate(() => window.__engine.fitFrame("f1", { animate: false }));
    await idle(page);
    await page.locator('.ic-frame[data-ic-frame="f1"]').click({ position: { x: 20, y: 400 } });
    /* Zoom far enough out that the screen is parked and its picture is what shows. */
    await page.evaluate(() => {
      const f = window.__engine.frames.find((x) => x.id === "f1")!;
      const { w, h } = window.__bench!.viewport();
      window.__bench!.setCamera({ z: 0.2, x: w / 2 - (f.x + f.w / 2) * 0.2, y: h / 2 - (f.y + f.h / 2) * 0.2 });
    });
    await idle(page);
    await expect(page.locator('.ic-frame[data-ic-frame="f1"]')).toHaveAttribute("data-mode", "parked");
    expect(await pixel()).not.toEqual([0xf0, 0xa6, 0x85]);
    expect((await report(page)).errors).toEqual([]);
  });
});
