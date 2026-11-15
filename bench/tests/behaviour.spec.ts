/*
 * Does the engine behave? Real input events against the packaged build with 300 screens.
 *
 * These are the 18 behaviour checks from the research spike, in the same order. They share one page and run in
 * series, because each builds on the state the one before it left: a screen is opened, typed into, parked,
 * evicted and visited again.
 */
import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { cam, fitAll, idle, open, sleep, stats } from "./helpers";

test.describe.configure({ mode: "serial" });

let page: Page;
/** The screen opened by double click, used by the parking and eviction checks. */
let opened: string;
/** Where keyboard travel arrived, used by the Enter and Escape checks. */
let arrived: { text: string | null; id: string | null };
const clockOf = (id: string) => page.evaluate((fid) => document.querySelector(`.ic-frame[data-ic-frame="${fid}"] .appbar .small`)?.textContent ?? null, id);
const clock: { id: string; a: string | null; b: string | null; parked1: string | null; parked2: string | null; back: string | null } = { id: "", a: null, b: null, parked1: null, parked2: null, back: null };

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await open(page, "v=engine&n=300");
  await page.waitForFunction(() => window.__bench!.idle(), null, { timeout: 120_000 });
});

test.afterAll(async () => {
  await page.close();
});

test("01 zoom to cursor", async () => {
  /* The world point under the pointer must not move while zooming. */
  const px = 517;
  const py = 333;
  await page.mouse.move(px, py);
  const c0 = await cam(page);
  const world = { x: (px - c0.x) / c0.z, y: (py - c0.y) / c0.z };
  await page.keyboard.down("Control");
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, -30);
    await sleep(16);
  }
  await page.keyboard.up("Control");
  await idle(page);
  const c1 = await cam(page);
  const drift = Math.hypot(world.x * c1.z + c1.x - px, world.y * c1.z + c1.y - py);
  test.info().annotations.push({ type: "measured", description: `zoom ${c0.z.toFixed(3)} to ${c1.z.toFixed(3)}, the point under the pointer moved ${drift.toFixed(3)}px` });
  expect(drift).toBeLessThan(1);
  expect(c1.z).toBeGreaterThan(c0.z * 2);
});

test("02 wheel pans", async () => {
  const c0 = await cam(page);
  await page.mouse.wheel(120, 80);
  await idle(page);
  const c1 = await cam(page);
  expect(Math.abs(c1.x - c0.x + 120)).toBeLessThan(1);
  expect(Math.abs(c1.y - c0.y + 80)).toBeLessThan(1);
  expect(c1.z).toBe(c0.z);
});

test("03 drag pans", async () => {
  await fitAll(page);
  await idle(page);
  const c0 = await cam(page);
  await page.mouse.move(40, 40);
  await page.mouse.down();
  await page.mouse.move(140, 100, { steps: 10 });
  await page.mouse.up();
  await sleep(1500);
  const c1 = await cam(page);
  /* A glide after the drag may add to the distance. */
  expect(c1.x - c0.x).toBeGreaterThanOrEqual(99);
  expect(c1.y - c0.y).toBeGreaterThanOrEqual(59);
});

test("04 click selects the picture under the pointer", async () => {
  await fitAll(page);
  await idle(page);
  /* A catalogue screen, because it has a search field to type into for a later check. */
  const target = await page.evaluate(() => {
    const f = window.__engine.frames.find((x) => x.name.startsWith("Catalogue, default") && x.w < 500 && x.index > 60)!;
    const c = window.__bench!.getCamera();
    return { x: (f.x + f.w / 2) * c.z + c.x, y: (f.y + f.h / 2) * c.z + c.y, index: f.index };
  });
  await page.mouse.click(target.x, target.y);
  await sleep(200);
  const selected = await page.evaluate(() => window.__engine.getSelected()?.index ?? -1);
  expect(selected).toBe(target.index);
  /* Left for the next check. */
  await page.mouse.dblclick(target.x, target.y);
});

test("05 double click opens the screen and it comes alive", async () => {
  await sleep(900);
  await idle(page);
  const s = await stats(page);
  opened = (await page.evaluate(() => window.__engine.getSelected()?.id))!;
  expect(s.zoom).toBeGreaterThan(0.6);
  expect(s.live).toBeGreaterThanOrEqual(1);
  await expect(page.locator(`.ic-frame[data-ic-frame="${opened}"]`)).toHaveAttribute("data-mode", "live");
});

test("06 typed text survives while the screen is parked", async () => {
  const input = page.locator(`.ic-frame[data-ic-frame="${opened}"] input`).first();
  await input.click();
  await input.fill("needle nose pliers");
  const c = await cam(page);
  await fitAll(page);
  await idle(page);
  const mode = await page.evaluate((id) => document.querySelector<HTMLElement>(`.ic-frame[data-ic-frame="${id}"]`)?.dataset.mode ?? "unmounted", opened);
  await page.evaluate((cc) => window.__bench!.setCamera(cc), c);
  await idle(page);
  expect(mode).toBe("parked");
  expect(await input.inputValue()).toBe("needle nose pliers");
});

test("07 a live screen keeps running", async () => {
  /* The desk activity screen ticks a clock once a second. The next two checks read the same clock. */
  clock.id = await page.evaluate(() => {
    const b = window.__bench!;
    const f = window.__engine.frames.find((x) => x.name.startsWith("Desk activity") && x.w < 500)!;
    const { w } = b.viewport();
    b.setCamera({ z: 1, x: w / 2 - (f.x + f.w / 2), y: 40 - f.y });
    return f.id;
  });
  await idle(page);
  clock.a = await clockOf(clock.id);
  await sleep(2200);
  clock.b = await clockOf(clock.id);
  const near = await cam(page);
  await fitAll(page);
  await idle(page);
  clock.parked1 = await clockOf(clock.id);
  await sleep(3200);
  clock.parked2 = await clockOf(clock.id);
  await page.evaluate((c) => window.__bench!.setCamera(c), near);
  await idle(page);
  clock.back = await clockOf(clock.id);
  expect(clock.a).not.toBeNull();
  expect(clock.a).not.toBe(clock.b);
});

test("08 a parked screen stops running", async () => {
  expect(clock.parked1).not.toBeNull();
  expect(clock.parked1).toBe(clock.parked2);
});

test("09 a parked screen resumes from where it stopped", async () => {
  expect(clock.back).not.toBeNull();
  expect(clock.back! >= clock.parked2!).toBe(true);
});

test("10 mounted screens stay inside the budget", async () => {
  /* Type again and mark the screen's DOM node, so a remount can be told from a screen that never left. */
  await page.evaluate((id) => window.__engine.fitFrame(id, { animate: false }), opened);
  await idle(page);
  await page.locator(`.ic-frame[data-ic-frame="${opened}"] input`).first().fill("spirit level");
  await page.evaluate((id) => {
    (document.querySelector(`.ic-frame[data-ic-frame="${id}"]`) as unknown as { __marked: boolean }).__marked = true;
  }, opened);
  const before = await stats(page);
  /* Visit enough other screens that the first one is unmounted. */
  for (let i = 0; i < 10; i++) {
    await page.evaluate((step) => {
      const b = window.__bench!;
      const { w, h } = b.viewport();
      const f = b.frames[(step * 23 + 150) % 240];
      b.setCamera({ z: 0.6, x: w / 2 - (f.x + f.w / 2) * 0.6, y: h / 2 - (f.y + f.h / 2) * 0.6 });
    }, i);
    await idle(page);
  }
  const after = await stats(page);
  expect(after.live).toBeLessThanOrEqual(24);
  expect(after.parked).toBeLessThanOrEqual(24);
  expect(after.evictions - before.evictions).toBeGreaterThan(0);
});

test("11 an evicted screen starts again from its declared state", async () => {
  await page.evaluate((id) => window.__engine.fitFrame(id, { animate: false }), opened);
  await idle(page);
  const sameNode = await page.evaluate((id) => !!(document.querySelector(`.ic-frame[data-ic-frame="${id}"]`) as unknown as { __marked?: boolean })?.__marked, opened);
  const value = await page.locator(`.ic-frame[data-ic-frame="${opened}"] input`).first().inputValue();
  expect(sameNode).toBe(false);
  expect(value).toBe("");
});

test("12 tab then arrow keys move between screens", async () => {
  await fitAll(page);
  await idle(page);
  await page.evaluate(() => document.querySelector<HTMLElement>(".ic-viewport")!.focus());
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement?.textContent);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await sleep(600);
  arrived = await page.evaluate(() => ({ text: document.activeElement?.textContent ?? null, id: (document.activeElement as HTMLElement | null)?.dataset?.frame ?? null }));
  const selected = await page.evaluate(() => window.__engine.getSelected()?.id);
  expect(first).toBeTruthy();
  expect(arrived.id).toBeTruthy();
  expect(arrived.text).not.toBe(first);
  expect(selected).toBe(arrived.id);
});

test("13 enter opens the screen and moves focus inside it", async () => {
  await page.keyboard.press("Enter");
  await sleep(1200);
  await idle(page);
  await sleep(600);
  const inside = await page.evaluate(() => {
    const host = document.activeElement?.closest<HTMLElement>(".ic-frame");
    return { inFrame: host?.dataset.icFrame ?? null, mode: host?.dataset.mode ?? null };
  });
  expect(inside.inFrame).toBe(arrived.id);
  expect(inside.mode).toBe("live");
});

test("14 escape returns to that screen's entry in the list", async () => {
  await page.keyboard.press("Escape");
  await sleep(200);
  const backTo = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.frame ?? null);
  expect(backTo).toBe(arrived.id);
});

test("15 every screen is in the accessibility tree, mounted or not", async () => {
  /* The list by its accessible role and name, and its entries by theirs. */
  const list = page.getByRole("list", { name: /every screen: 300 screens$/ });
  await expect(list).toHaveCount(1);
  await expect(list.getByRole("button")).toHaveCount(300);
  await expect(page.getByRole("group", { name: "Harbor Street Tool Library, every screen" })).toHaveCount(1);
  const mounted = await page.evaluate(() => document.querySelectorAll(".ic-frame").length);
  expect(mounted).toBeLessThan(300);
});

test("16 selection is announced", async () => {
  const live = await page.evaluate(() => document.querySelector(".ic-sr")?.textContent ?? "");
  expect(/Screen \d+ of 300/.test(live) || /Opening/.test(live)).toBe(true);
  await expect(page.locator(".ic-sr")).toHaveAttribute("aria-live", "polite");
});

test("17 arrow keys and plus work on the focused canvas", async () => {
  await page.evaluate(() => document.querySelector<HTMLElement>(".ic-viewport")!.focus());
  const c0 = await cam(page);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("+");
  await idle(page);
  const c1 = await cam(page);
  expect(c1.z).toBeGreaterThan(c0.z);
  expect(c1.x).not.toBe(c0.x);
});

test("18 a far layer moved by the compositor lines up with a fresh drawing", async ({ browser }) => {
  const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  /* A settle time of ten minutes, so the engine never redraws on its own during the check. */
  await open(p2, "v=engine&n=300&warm=0&settleMs=600000");
  const farDraws = () => p2.evaluate(() => new Promise<number>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r((window.__bench!.stats() as { farDraws: number }).farDraws)))));
  await p2.evaluate(() => {
    const b = window.__bench!;
    const c = b.fitAll();
    b.setCamera({ x: c.x, y: c.y, z: c.z * 2.5 });
  });
  const before = await farDraws();
  /* Pan by an odd amount and zoom a little: inside what the engine allows without drawing again. */
  await p2.evaluate(() => {
    const b = window.__bench!;
    const c = b.getCamera();
    const k = 1.07;
    b.setCamera({ z: c.z * k, x: 720 - (720 - c.x) * k + 37, y: 450 - (450 - c.y) * k - 23 });
  });
  const afterMove = await farDraws();
  const moved = PNG.sync.read(await p2.screenshot({ type: "png" }));
  await p2.evaluate(() => window.__engine.select(null));
  const afterRedraw = await farDraws();
  const fresh = PNG.sync.read(await p2.screenshot({ type: "png" }));
  /* Mean difference in brightness, and the same with the fresh drawing shifted three pixels, to show the measure can tell. */
  const diff = (shift: number) => {
    let sum = 0;
    let n = 0;
    for (let y = 0; y < moved.height; y += 2) {
      for (let x = 8; x < moved.width - 8; x += 2) {
        const a = (y * moved.width + x) * 4;
        const b = (y * fresh.width + x + shift) * 4;
        sum += Math.abs(moved.data[a] + moved.data[a + 1] + moved.data[a + 2] - fresh.data[b] - fresh.data[b + 1] - fresh.data[b + 2]) / 3;
        n++;
      }
    }
    return sum / n;
  };
  const aligned = diff(0);
  const shifted = diff(3);
  await p2.close();
  expect(afterMove).toBe(before);
  expect(afterRedraw).toBe(before + 1);
  expect(aligned).toBeLessThan(shifted * 0.5);
});
