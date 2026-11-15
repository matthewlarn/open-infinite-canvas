/* The keyboard and focus claims in docs/accessibility.md that the 18 behaviour checks do not already cover. */
import { expect, test } from "@playwright/test";
import { cam, fitAll, idle, open, sleep } from "./helpers";

test.beforeEach(async ({ page }) => {
  await open(page, "v=engine&n=60&warm=0&motion=reduce");
  await fitAll(page);
  await idle(page);
});

const focused = (page: import("@playwright/test").Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.frame ?? null);

test("the viewport is a labelled group described as a canvas, not an application", async ({ page }) => {
  const viewport = page.locator(".ic-viewport");
  await expect(viewport).toHaveAttribute("role", "group");
  await expect(viewport).toHaveAttribute("aria-roledescription", "canvas");
  await expect(viewport).toHaveAttribute("aria-label", "Harbor Street Tool Library, every screen");
  await expect(page.locator(".ic-far")).toHaveAttribute("aria-hidden", "true");
});

test("the list is one tab stop, and Home and End go to the first and last screen", async ({ page }) => {
  expect(await page.locator('.ic-list button[tabindex="0"]').count()).toBe(1);
  await page.locator(".ic-viewport").focus();
  await page.keyboard.press("Tab");
  const first = await focused(page);
  expect(first).toBeTruthy();
  await page.keyboard.press("End");
  const last = await focused(page);
  expect(last).not.toBe(first);
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-posinset"))).toBe("60");
  expect(await page.locator('.ic-list button[tabindex="0"]').count()).toBe(1);
  await page.keyboard.press("Home");
  expect(await focused(page)).toBe(first);
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-posinset"))).toBe("1");
  /* One more Tab leaves the list. It does not walk the other 59 entries. */
  await page.keyboard.press("Tab");
  expect(await focused(page)).toBeNull();
});

test("the list comes before the screens, so Tab reaches it before a live screen's controls", async ({ page }) => {
  await page.evaluate(() => window.__engine.fitFrame("f0", { animate: false }));
  await idle(page);
  expect(await page.locator('.ic-frame[data-mode="live"]').count()).toBeGreaterThan(0);
  await page.locator(".ic-viewport").focus();
  await page.keyboard.press("Tab");
  expect(await focused(page)).toBeTruthy();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest(".ic-frame")?.getAttribute("data-mode"))).toBe("live");
});

test("screens that are not live are inert", async ({ page }) => {
  await page.evaluate(() => window.__engine.fitFrame("f0", { animate: false }));
  await idle(page);
  await fitAll(page);
  await idle(page);
  const hosts = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".ic-frame")].map((el) => ({ mode: el.dataset.mode, inert: el.inert })));
  expect(hosts.length).toBeGreaterThan(0);
  for (const h of hosts) expect(h.inert).toBe(h.mode !== "live");
});

test("minus, 0, 1 and 2 zoom out, go to 100%, fit everything and fit the selection", async ({ page }) => {
  const viewport = page.locator(".ic-viewport");
  await viewport.focus();
  const all = await cam(page);
  await page.keyboard.press("0");
  await sleep(100);
  expect((await cam(page)).z).toBe(1);
  await page.keyboard.press("-");
  await sleep(100);
  expect((await cam(page)).z).toBeCloseTo(0.8, 6);
  await page.keyboard.press("1");
  await sleep(100);
  expect((await cam(page)).z).toBeCloseTo(all.z, 6);
  await page.evaluate(() => window.__engine.select("f7"));
  await page.keyboard.press("2");
  await idle(page);
  await expect(page.locator('.ic-frame[data-ic-frame="f7"]')).toHaveAttribute("data-mode", "live");
});

test("shortcuts do nothing while a control inside a screen has focus", async ({ page }) => {
  await page.evaluate(() => {
    const f = window.__engine.frames.find((x) => x.name.startsWith("Catalogue, default"))!;
    window.__engine.fitFrame(f.id, { animate: false });
  });
  await idle(page);
  const input = page.locator('.ic-frame[data-mode="live"] input[type="search"], .ic-frame[data-mode="live"] input').first();
  await input.focus();
  const c0 = await cam(page);
  await page.keyboard.type("10-2+");
  await page.keyboard.press("ArrowLeft");
  await sleep(200);
  expect(await cam(page)).toEqual(c0);
});

test("the browser's own zoom keys are left alone", async ({ page }) => {
  await page.locator(".ic-viewport").focus();
  const c0 = await cam(page);
  const prevented = await page.evaluate(() => {
    const results: boolean[] = [];
    for (const key of ["+", "-", "0"]) {
      const e = new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true });
      document.querySelector(".ic-viewport")!.dispatchEvent(e);
      results.push(e.defaultPrevented);
    }
    return results;
  });
  expect(prevented).toEqual([false, false, false]);
  expect(await cam(page)).toEqual(c0);
});

test("the canvas follows focus: a scroll of the viewport becomes a camera move", async ({ page }) => {
  const c0 = await cam(page);
  await page.evaluate(() => {
    const vp = document.querySelector<HTMLElement>(".ic-viewport")!;
    /* Something to scroll to, standing in for a control that is partly out of view. */
    const far = document.createElement("div");
    far.style.cssText = "position:absolute;left:0;top:1400px;width:10px;height:10px";
    vp.appendChild(far);
    vp.scrollTop = 120;
  });
  await sleep(200);
  const c1 = await cam(page);
  expect(await page.evaluate(() => document.querySelector(".ic-viewport")!.scrollTop)).toBe(0);
  expect(c1.y - c0.y).toBe(-120);
});
