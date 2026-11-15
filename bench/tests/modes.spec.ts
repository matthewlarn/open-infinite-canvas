/* Iframe mode, reduced motion, React 18, the plain DOM binding and the demo. */
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { PORTS } from "../playwright.config";
import { cam, fitAll, idle, open, sleep, stats } from "./helpers";

test("iframe mode: a screen with src runs in its own document, comes alive and gets a picture", async ({ page }) => {
  await open(page, "v=engine&n=12&isolate=2");
  await idle(page);
  const s = await stats(page);
  expect(s.pictures).toBe(12);
  expect(await page.evaluate(() => window.__snapshot.pictureErrors)).toEqual([]);
  /* The picture of the iframe screen fills its frame. The right half and the lower half are not empty. */
  const box = await page.evaluate(() => {
    const f = window.__engine.frames.find((x) => x.id === "f0")!;
    const c = window.__bench!.getCamera();
    const top = document.querySelector(".ic-viewport")!.getBoundingClientRect().top;
    return { x: f.x * c.z + c.x, y: f.y * c.z + c.y + top, w: f.w * c.z, h: f.h * c.z };
  });
  const png = PNG.sync.read(await page.screenshot({ type: "png" }));
  const distinct = (x0: number, y0: number, x1: number, y1: number) => {
    const seen = new Set<number>();
    for (let y = Math.ceil(y0); y < y1; y++) for (let x = Math.ceil(x0); x < x1; x++) seen.add((png.data[(y * png.width + x) * 4] << 16) | (png.data[(y * png.width + x) * 4 + 1] << 8) | png.data[(y * png.width + x) * 4 + 2]);
    return seen.size;
  };
  expect(distinct(box.x + box.w * 0.55, box.y + box.h * 0.05, box.x + box.w * 0.95, box.y + box.h * 0.45)).toBeGreaterThan(8);
  expect(distinct(box.x + box.w * 0.05, box.y + box.h * 0.55, box.x + box.w * 0.95, box.y + box.h * 0.95)).toBeGreaterThan(8);

  await page.evaluate(() => window.__engine.fitFrame("f0", { animate: false }));
  await idle(page);
  const host = page.locator('.ic-frame[data-ic-frame="f0"]');
  await expect(host).toHaveAttribute("data-mode", "live");
  const inner = page.frameLocator('.ic-frame[data-ic-frame="f0"] iframe');
  await expect(inner.locator(".screen, [class]").first()).toBeVisible();
  /* The screen is not in the page's own document. */
  expect(await host.locator(":scope > iframe").count()).toBe(1);
  expect(await host.locator(":scope > :not(iframe)").count()).toBe(0);
  /* A screen without src is in the page's own document. */
  await page.evaluate(() => window.__engine.fitFrame("f5", { animate: false }));
  await idle(page);
  expect(await page.locator('.ic-frame[data-ic-frame="f5"] iframe').count()).toBe(0);
});

test.describe("reduced motion", () => {
  const target = async (page: import("@playwright/test").Page) => {
    await fitAll(page);
    await idle(page);
    const before = await cam(page);
    await page.evaluate(() => window.__engine.fitFrame("f20"));
    /* Two frames later a tween is part way there and a jump has arrived. */
    const after = await page.evaluate(() => new Promise<{ x: number; y: number; z: number }>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__engine.getCamera())))));
    await sleep(600);
    return { before, after, end: await cam(page) };
  };

  test("with the system setting off, the camera glides", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page, "v=engine&n=40&warm=0");
    const { before, after, end } = await target(page);
    expect(await page.evaluate(() => window.__engine.reducedMotion)).toBe(false);
    expect(end.z).toBeGreaterThan(before.z * 2);
    expect(after.z).toBeLessThan(end.z * 0.9);
  });

  test("with the system setting on, the camera jumps and a drag does not glide", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "v=engine&n=40&warm=0");
    const { after, end } = await target(page);
    expect(await page.evaluate(() => window.__engine.reducedMotion)).toBe(true);
    expect(after.z).toBeCloseTo(end.z, 6);
    await fitAll(page);
    await idle(page);
    const c0 = await cam(page);
    await page.mouse.move(40, 40);
    await page.mouse.down();
    await page.mouse.move(240, 160, { steps: 4 });
    await page.mouse.up();
    await sleep(800);
    const c1 = await cam(page);
    expect(c1.x - c0.x).toBeCloseTo(200, 0);
    expect(c1.y - c0.y).toBeCloseTo(120, 0);
  });

  test("the setting is followed when it changes while the page is open", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page, "v=engine&n=12&warm=0");
    expect(await page.evaluate(() => window.__engine.reducedMotion)).toBe(false);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => page.evaluate(() => window.__engine.reducedMotion)).toBe(true);
  });
});

test("React 18: no Activity, and the fallback still parks a screen with its state", async ({ page }) => {
  const base = `http://127.0.0.1:${PORTS.react18}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await open(page, "v=engine&n=60", base);
  await idle(page);
  expect(await page.evaluate(() => window.__snapshot.hasActivity)).toBe(false);
  expect((await stats(page)).pictures).toBe(60);
  const id = await page.evaluate(() => {
    const f = window.__engine.frames.find((x) => x.name.startsWith("Catalogue, default") && x.w < 500)!;
    window.__engine.fitFrame(f.id, { animate: false });
    return f.id;
  });
  await idle(page);
  const host = page.locator(`.ic-frame[data-ic-frame="${id}"]`);
  await expect(host).toHaveAttribute("data-mode", "live");
  expect(await host.evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  const input = host.locator("input").first();
  await input.fill("mitre saw");
  const near = await cam(page);
  await fitAll(page);
  await idle(page);
  await expect(host).toHaveAttribute("data-mode", "parked");
  expect(await host.evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  expect(await host.evaluate((el) => getComputedStyle(el).display)).toBe("none");
  await page.evaluate((c) => window.__bench!.setCamera(c), near);
  await idle(page);
  await expect(host).toHaveAttribute("data-mode", "live");
  expect(await input.inputValue()).toBe("mitre saw");
  const s = await stats(page);
  expect(s.live).toBeLessThanOrEqual(24);
  expect(errors).toEqual([]);
});

test("React 19: Activity is used", async ({ page }) => {
  await open(page, "v=engine&n=12&warm=0");
  expect(await page.evaluate(() => window.__snapshot.hasActivity)).toBe(true);
});

test("the plain DOM binding works with no framework", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORTS.demo}/vanilla.html`);
  await page.waitForFunction(() => "__canvas" in window);
  const total = await page.locator(".ic-list button").count();
  expect(total).toBeGreaterThan(30);
  await page.evaluate(() => (window as unknown as { __canvas: { engine: { fitFrame(id: string, o: object): void } } }).__canvas.engine.fitFrame("tool-0", { animate: false }));
  const host = page.locator('.ic-frame[data-ic-frame="tool-0"]');
  await expect(host).toHaveAttribute("data-mode", "live");
  const button = host.getByRole("button");
  const before = await button.textContent();
  await button.click();
  expect(await button.textContent()).not.toBe(before);
  /* Keyboard: Tab reaches the list, an arrow moves, Enter goes inside, Escape comes back. */
  await page.locator(".ic-viewport").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowRight");
  const entry = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.frame);
  expect(entry).toBeTruthy();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest<HTMLElement>(".ic-frame")?.dataset.icFrame ?? null)).toBe(entry);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.frame)).toBe(entry);
  expect(errors).toEqual([]);
});

test("the demo holds at least 300 varied screens with real copy and no filler", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`http://127.0.0.1:${PORTS.demo}/`);
  await expect(page.locator(".ic-list button")).toHaveCount(300);
  const names = await page.locator(".ic-list button").allTextContents();
  /* 29 screen and state combinations repeat with different content. */
  expect(new Set(names.map((n) => n.replace(/ \d+( \(iframe\))?$/, ""))).size).toBeGreaterThanOrEqual(29);
  expect(names.filter((n) => n.endsWith("(iframe)")).length).toBe(4);
  /* Wait for every picture, then open a few screens and read what they say. */
  await expect.poll(() => page.locator(".hud").textContent(), { timeout: 120_000 }).toMatch(/300 pictures/);
  await page.getByRole("button", { name: "Fit every screen" }).click();
  await page.locator(".ic-viewport").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator('.ic-frame[data-mode="live"]').first()).toBeVisible();
  await expect.poll(() => page.locator('.ic-frame[data-mode="live"]').count()).toBeGreaterThan(2);
  const text = (await page.locator('.ic-frame[data-mode="live"]').allTextContents()).join(" ");
  expect(text.length).toBeGreaterThan(500);
  expect(text).not.toMatch(/lorem ipsum|acme|jane doe|john doe|example\.com/i);
  expect(errors).toEqual([]);
});
