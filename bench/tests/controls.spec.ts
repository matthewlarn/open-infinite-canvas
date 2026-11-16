/* The demo's control panel. Each group is changed through the panel, and the engine is asked what it now runs with. */
import { expect, test, type Page } from "@playwright/test";
import { PORTS } from "../playwright.config";

type Opts = {
  lod: Record<string, number>;
  input: Record<string, string | number | boolean>;
  provider: string;
  minZoom: number;
  maxZoom: number;
  warmup: boolean;
  reducedMotion: boolean;
  followsSystemMotion: boolean;
  maxPixelRatio: number;
  farLayer: boolean;
  contentVisibility: boolean;
  pictureSmoothing: string;
};
type Demo = {
  engine(): {
    getOptions(): Opts;
    getCamera(): { x: number; y: number; z: number };
    getSelected(): { id: string } | null;
    frames: { id: string; w: number; name: string; src?: string }[];
    stats(): Record<string, number>;
  };
  lastBenchmark: { fps: number; frames: number } | null;
};

const demo = `http://127.0.0.1:${PORTS.demo}/`;
const opts = (page: Page) => page.evaluate(() => (window as unknown as { __demo: Demo }).__demo.engine().getOptions());
/** Runs `fn` in the page with the demo's hooks. It is sent as source, so it must not close over anything. */
const engineEval = <T,>(page: Page, fn: (d: Demo) => T) => page.evaluate(`(${fn.toString()})(window.__demo)`) as Promise<T>;

async function openPanel(page: Page, query = "") {
  await page.goto(`${demo}${query}`);
  await page.waitForFunction(() => !!(window as unknown as { __demo?: Demo }).__demo?.engine());
  const toggle = page.getByRole("button", { name: "Controls" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByRole("complementary", { name: "Canvas controls" });
  await expect(panel).toBeVisible();
  return panel;
}

async function section(page: Page, title: string) {
  const s = page.locator("details.section", { has: page.locator(".section-title", { hasText: new RegExp(`^${title}$`) }) });
  if (!(await s.evaluate((d) => (d as HTMLDetailsElement).open))) await s.locator("summary").click();
  return s;
}

test("the control panel changes every group of settings in the running engine", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const panel = await openPanel(page);

  /* Every control in the panel is at least 44 pixels tall. */
  const small = await panel.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("button, select, input, summary")]
      .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().height < 44 && !(el instanceof HTMLInputElement && el.type === "checkbox"))
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(small).toEqual([]);

  /* Screens. */
  await section(page, "Screens");
  await panel.getByRole("button", { name: "100", exact: true }).click();
  await expect(page.locator(".ic-list button")).toHaveCount(100);
  await panel.getByLabel("Screens in iframe mode").fill("0");
  await panel.getByLabel("Screen size").selectOption("phone");
  await panel.getByLabel("Columns").fill("10");
  await expect.poll(() => engineEval(page, (d) => d.engine().frames.every((f) => f.w === 393 && !f.src))).toBe(true);
  expect(await engineEval(page, (d) => d.engine().frames.length)).toBe(100);
  /* Ten columns: the eleventh screen starts the second row. */
  expect(await page.evaluate(() => {
    const f = (window as unknown as { __demo: Demo }).__demo.engine().frames as unknown as { x: number; y: number }[];
    return [f[10].x, f[10].y > f[0].y];
  })).toEqual([0, true]);

  /* Camera. */
  await section(page, "Camera");
  await panel.getByLabel("Smallest zoom").fill("0.1");
  await panel.getByLabel("Largest zoom").fill("8");
  await panel.getByLabel("Zoom speed").fill("0.02");
  await panel.getByLabel("Plain scroll").selectOption("zoom");
  await panel.getByLabel("Glide after a drag").uncheck();
  await panel.getByLabel("Glide friction").fill("0.2");
  await expect.poll(() => opts(page)).toMatchObject({ minZoom: 0.1, maxZoom: 8, input: { wheel: "zoom", zoomSpeed: 0.02, inertia: false, friction: 0.2 } });
  /* With a plain scroll set to zoom, the wheel zooms. Every screen is a picture at this zoom, so none takes the scroll. */
  const z0 = await engineEval(page, (d) => d.engine().getCamera().z);
  const box = (await page.locator(".ic-viewport").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -100);
  await expect.poll(() => engineEval(page, (d) => d.engine().getCamera().z)).toBeGreaterThan(z0 * 1.5);
  await panel.getByRole("button", { name: "Zoom to 100%" }).click();
  await expect.poll(() => engineEval(page, (d) => d.engine().getCamera().z)).toBeCloseTo(1, 5);
  await panel.getByLabel("Go to screen").fill("5");
  await panel.getByRole("button", { name: "Go", exact: true }).click();
  expect(await engineEval(page, (d) => d.engine().getSelected()?.id)).toBe(await engineEval(page, (d) => d.engine().frames[4].id));
  await panel.getByRole("button", { name: "Fit all" }).click();

  /* Level of detail. */
  await section(page, "Level of detail");
  await panel.getByLabel("Live screens, at most").fill("6");
  await panel.getByLabel("Parked screens, at most").fill("3");
  await panel.getByLabel("Screens come alive from zoom").fill("0.5");
  await panel.getByLabel("Hysteresis").fill("0.2");
  await panel.getByLabel("Mounts while still").fill("3");
  await panel.getByLabel("Staged at once, at most").fill("4");
  await expect.poll(() => opts(page).then((o) => o.lod)).toMatchObject({ maxLive: 6, maxParked: 3, liveInScale: 0.5, liveOutScale: 0.3, mountsStill: 3, stagingMax: 4 });
  /* The new live budget holds when a screen is opened. */
  await panel.getByRole("button", { name: "Zoom to 100%" }).click();
  await page.waitForTimeout(1500);
  expect(await engineEval(page, (d) => d.engine().stats().live)).toBeLessThanOrEqual(6);

  /* Pictures. */
  await section(page, "Pictures");
  await panel.getByLabel("Provider").selectOption("svg");
  await panel.getByLabel("Smoothing when scaled").selectOption("high");
  await panel.getByLabel("Resolution of the sharp picture").fill("0.25");
  await panel.getByLabel("Take pictures in the background").uncheck();
  await panel.getByLabel("Pictures in progress, at most").fill("3");
  await expect.poll(() => opts(page)).toMatchObject({ provider: "svg", pictureSmoothing: "high", warmup: false, lod: { previewScale: 0.25, captureConcurrency: 3 } });

  /* Rendering. */
  await section(page, "Rendering");
  await panel.getByLabel("Far canvas", { exact: true }).uncheck();
  await panel.getByLabel("Pixel ratio cap").selectOption("1");
  await panel.getByLabel("Staging uses content-visibility").uncheck();
  await panel.getByLabel("Reduced motion").selectOption("reduce");
  await expect.poll(() => opts(page)).toMatchObject({ farLayer: false, maxPixelRatio: 1, contentVisibility: false, reducedMotion: true, followsSystemMotion: false });
  expect(await page.locator(".ic-far").evaluate((c) => (c as HTMLElement).style.visibility)).toBe("hidden");
  expect(await page.locator(".ic-viewport").getAttribute("data-ic-no-cv")).toBe("");
  await panel.getByLabel("Far canvas", { exact: true }).check();
  await panel.getByLabel("Reduced motion").selectOption("system");
  await expect.poll(() => opts(page)).toMatchObject({ farLayer: true, followsSystemMotion: true });

  /* Input. */
  await section(page, "Input");
  await panel.getByLabel("Mouse button that pans anywhere").selectOption("right");
  await panel.getByLabel("Hold Space and drag to pan").uncheck();
  await panel.getByLabel("Arrow key step").fill("128");
  await expect.poll(() => opts(page).then((o) => o.input)).toMatchObject({ panButton: "right", spaceDrag: false, keyStep: 128 });
  await page.locator(".ic-viewport").focus();
  const x0 = await engineEval(page, (d) => d.engine().getCamera().x);
  await page.keyboard.press("ArrowLeft");
  /* The camera snaps to whole device pixels when it settles, so allow a pixel either way. */
  await expect.poll(async () => Math.abs((await engineEval(page, (d) => d.engine().getCamera().x)) - (x0 + 128))).toBeLessThan(1.01);

  /* Debug. */
  await section(page, "Debug");
  await panel.getByLabel("Colour every screen by tier").check();
  await panel.getByLabel("Outline mounted screens").check();
  await panel.getByLabel("Hit test boxes").check();
  await panel.getByLabel("Spatial index cells").check();
  await panel.getByLabel("Full stats on the canvas").check();
  await expect(page.locator(".stage")).toHaveAttribute("data-outlines", "");
  await expect.poll(() =>
    page.locator(".debug-overlay").evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 0) painted++;
      return painted;
    }),
  ).toBeGreaterThan(50);
  await expect(page.locator(".hud")).toContainText(/fps/);
  await expect(page.locator(".hud")).toContainText(/DOM nodes/);
  await expect(page.locator(".hud")).toContainText(/queued/);
  const json = JSON.parse((await panel.getByLabel("Settings and stats as JSON").textContent())!);
  expect(json.engine.lod.maxLive).toBe(6);
  expect(json.stats.engine.frames).toBe(100);

  await panel.getByRole("button", { name: "Run benchmark" }).click();
  await expect(panel.getByTestId("bench-fps")).toBeVisible({ timeout: 30_000 });
  const result = await engineEval(page, (d) => d.lastBenchmark);
  expect(result!.frames).toBeGreaterThan(30);
  expect(result!.fps).toBeGreaterThan(5);

  /* Saved in the address bar and in this browser, and read back on reload. */
  expect(page.url()).toContain("#settings=");
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __demo?: Demo }).__demo?.engine());
  await expect.poll(() => opts(page).then((o) => o.lod.maxLive)).toBe(6);
  expect(await engineEval(page, (d) => d.engine().frames.length)).toBe(100);
  await page.goto(demo);
  await page.waitForFunction(() => !!(window as unknown as { __demo?: Demo }).__demo?.engine());
  await expect.poll(() => opts(page).then((o) => o.lod.maxLive)).toBe(6);

  /* Presets, then Reset. */
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Low memory" }).click();
  await expect.poll(() => opts(page).then((o) => o.lod)).toMatchObject({ maxParked: 0, maxPreviews: 16 });
  await panel.getByRole("button", { name: "Max quality" }).click();
  await expect.poll(() => opts(page).then((o) => o.lod)).toMatchObject({ maxLive: 48, previewScale: 1 });
  await panel.getByRole("button", { name: "Reset everything" }).click();
  await expect.poll(() => opts(page).then((o) => [o.lod.maxLive, o.lod.maxParked, o.input.wheel, o.warmup])).toEqual([24, 24, "pan", true]);
  await expect(page.locator(".ic-list button")).toHaveCount(300);
  expect(page.url()).not.toContain("#settings=");
  expect(errors).toEqual([]);
});

test("the panel opens and closes from the keyboard", async ({ page }) => {
  await page.goto(demo);
  const toggle = page.getByRole("button", { name: "Controls" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const summary = page.locator("details.section summary").nth(1);
  await summary.focus();
  await page.keyboard.press("Enter");
  expect(await summary.evaluate((s) => (s.parentElement as HTMLDetailsElement).open)).toBe(true);
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("complementary", { name: "Canvas controls" })).toBeHidden();
});

/* Pictures of the panel for the docs, in both themes. Run with DOCS_IMAGES=1. */
test("docs images of the panel", async ({ page }) => {
  test.skip(!process.env.DOCS_IMAGES, "Set DOCS_IMAGES=1 to write docs/images.");
  for (const theme of ["light", "dark"]) {
    await page.goto(`${demo}?theme=${theme}&panel=open#settings=${encodeURIComponent(JSON.stringify({ screens: { count: 100 }, debug: { tiers: true, hud: true } }))}`);
    await page.waitForFunction(() => !!(window as unknown as { __demo?: Demo }).__demo?.engine());
    await expect.poll(() => engineEval(page, (d) => d.engine().stats().pictures), { timeout: 60_000 }).toBe(100);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `../docs/images/controls-${theme}.png` });
  }
});
