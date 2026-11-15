import type { Page } from "@playwright/test";

/** The hooks the benchmark page publishes. See `app/src/bench-hooks.ts`. */
export type Cam = { x: number; y: number; z: number };

declare global {
  interface Window {
    __engine: {
      frames: { id: string; index: number; name: string; x: number; y: number; w: number; h: number; tier: string }[];
      getSelected(): { id: string; index: number } | null;
      select(id: string | null): void;
      fit(rect?: unknown, options?: { animate?: boolean }): void;
      fitFrame(id: string, options?: { animate?: boolean }): void;
      getCamera(): Cam;
      reducedMotion: boolean;
    };
    __snapshot: { hasDrawElement(): string | null; hasActivity: boolean; pictureErrors: string[] };
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function open(page: Page, query: string, base = "") {
  await page.goto(`${base}/?${query}&hud=0`);
  await page.waitForFunction(() => window.__bench?.ready);
}

export const cam = (page: Page) => page.evaluate(() => window.__bench!.getCamera());
export const stats = (page: Page) => page.evaluate(() => window.__bench!.stats() as Record<string, number>);

/** Waits until the engine reports nothing left to do. */
export async function idle(page: Page, timeout = 60_000) {
  await sleep(400);
  await page.waitForFunction(() => window.__bench!.idle(), null, { timeout }).catch(() => {});
  await sleep(200);
}

export const fitAll = (page: Page) => page.evaluate(() => window.__bench!.setCamera(window.__bench!.fitAll()));
