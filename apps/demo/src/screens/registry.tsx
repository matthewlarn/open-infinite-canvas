import type { FC, ReactNode } from "react";
import type { FrameSpec } from "open-infinite-canvas";
import { Calendar, Catalogue, Join, Settings, SignIn, ToolDetail, type ScreenProps } from "./screens-a";
import { ActivityFeed, ArticleScreen, Chat, Checkout, Dashboard, Inventory, Profile, Workshops } from "./screens-b";

type Variant = { name: string; state: string; Component: FC<ScreenProps> };

/** Every screen template in every state it has. A state variant is the same component with a different start. */
export const VARIANTS: Variant[] = [
  { name: "Sign in", state: "default", Component: SignIn },
  { name: "Catalogue", state: "default", Component: Catalogue },
  { name: "Tool", state: "default", Component: ToolDetail },
  { name: "Dashboard", state: "default", Component: Dashboard },
  { name: "Checkout", state: "step1", Component: Checkout },
  { name: "Article", state: "default", Component: ArticleScreen },
  { name: "Desk activity", state: "live", Component: ActivityFeed },
  { name: "Inventory", state: "default", Component: Inventory },
  { name: "Join", state: "default", Component: Join },
  { name: "Dates", state: "default", Component: Calendar },
  { name: "Sign in", state: "error", Component: SignIn },
  { name: "Catalogue", state: "loading", Component: Catalogue },
  { name: "Messages", state: "default", Component: Chat },
  { name: "Workshops", state: "default", Component: Workshops },
  { name: "Checkout", state: "step2", Component: Checkout },
  { name: "Settings", state: "default", Component: Settings },
  { name: "Tool", state: "reserved", Component: ToolDetail },
  { name: "Profile", state: "default", Component: Profile },
  { name: "Catalogue", state: "empty", Component: Catalogue },
  { name: "Dashboard", state: "loading", Component: Dashboard },
  { name: "Join", state: "filled", Component: Join },
  { name: "Checkout", state: "step3", Component: Checkout },
  { name: "Messages", state: "typing", Component: Chat },
  { name: "Dates", state: "range", Component: Calendar },
  { name: "Sign in", state: "filled", Component: SignIn },
  { name: "Catalogue", state: "error", Component: Catalogue },
  { name: "Tool", state: "loading", Component: ToolDetail },
  { name: "Workshops", state: "full", Component: Workshops },
  { name: "Checkout", state: "done", Component: Checkout },
];

export type Device = "phone" | "tablet" | "desktop";
export const DEVICE_SIZE: Record<Device, { w: number; h: number }> = {
  phone: { w: 393, h: 852 },
  tablet: { w: 820, h: 1180 },
  desktop: { w: 1440, h: 900 },
};

export type DemoFrame = FrameSpec & { variant: number; seed: number; device: Device };

const GAP_X = 80;
const GAP_Y = 140;

/**
 * `count` frames, eight in ten of them phones. Laid out in rows by device so the world is roughly as wide as a
 * 16:10 screen is. Every position is a plain number in world pixels. Nothing is measured from the DOM.
 */
export function buildFrames(count: number): DemoFrame[] {
  const buckets: Record<Device, DemoFrame[]> = { phone: [], tablet: [], desktop: [] };
  for (let i = 0; i < count; i++) {
    const device: Device = i % 10 === 7 ? "tablet" : i % 10 === 9 ? "desktop" : "phone";
    const variant = i % VARIANTS.length;
    const v = VARIANTS[variant];
    const size = DEVICE_SIZE[device];
    const run = Math.floor(i / VARIANTS.length) + 1;
    buckets[device].push({
      id: `f${i}`,
      x: 0,
      y: 0,
      w: size.w,
      h: size.h,
      name: `${v.name}, ${v.state} ${String(run).padStart(2, "0")}`,
      group: device,
      variant,
      seed: i,
      device,
    });
  }
  let area = 0;
  for (const d of Object.keys(buckets) as Device[]) area += buckets[d].length * (DEVICE_SIZE[d].w + GAP_X) * (DEVICE_SIZE[d].h + GAP_Y);
  const rowWidth = Math.max(DEVICE_SIZE.desktop.w + GAP_X, Math.sqrt(area * 1.6));
  const out: DemoFrame[] = [];
  let y = 0;
  for (const d of ["phone", "tablet", "desktop"] as Device[]) {
    const size = DEVICE_SIZE[d];
    const perRow = Math.max(1, Math.floor(rowWidth / (size.w + GAP_X)));
    buckets[d].forEach((f, i) => {
      f.x = (i % perRow) * (size.w + GAP_X);
      f.y = y + Math.floor(i / perRow) * (size.h + GAP_Y);
      out.push(f);
    });
    if (buckets[d].length) y += Math.ceil(buckets[d].length / perRow) * (size.h + GAP_Y) + GAP_Y;
  }
  return out;
}

export function renderDemoFrame(frame: FrameSpec): ReactNode {
  const f = frame as DemoFrame;
  const v = VARIANTS[f.variant];
  return <v.Component seed={f.seed} state={v.state} />;
}
