/*
 * Puts the latest benchmark run beside the reference run from the research spike.
 *
 *   node scripts/compare.cjs [results/bench.json] [reference/bench.json]
 *
 * It prints a table and writes the same table to results/compare.md. A frame rate counts as "within noise"
 * when it is within 2 frames a second or 10% of the reference, whichever is larger. Two runs of the same build
 * on this kind of machine differ by about that much. The exit code is 1 if an engine row falls outside it.
 */
const fs = require("node:fs");
const path = require("node:path");

const NEW = path.resolve(process.argv[2] ?? path.join(__dirname, "..", "results", "bench.json"));
const REF = path.resolve(process.argv[3] ?? path.join(__dirname, "..", "reference", "bench.json"));
const PATHS = [
  ["zoom-sweep", "Zoom sweep"],
  ["pan-far", "Pan, zoomed out"],
  ["pan-mid", "Pan at 50%"],
  ["pan-near", "Pan at 100%"],
];
const LABEL = { engine: "Engine", today: "Today", naive: "Naive" };

if (!fs.existsSync(NEW)) {
  console.error(`No results at ${NEW}. Run \`pnpm bench\` first.`);
  process.exit(2);
}
const now = JSON.parse(fs.readFileSync(NEW, "utf8"));
const ref = JSON.parse(fs.readFileSync(REF, "utf8"));
const find = (set, v, n) => set.runs.find((r) => r.variant === v && r.n === n && r.ok);
const within = (a, b) => Math.abs(a - b) <= Math.max(2, b * 0.1);

const lines = [];
const out = (s = "") => lines.push(s);
let engineOutside = 0;
let rows = 0;

out("## Frames per second, packaged build against the spike");
out();
out("| Variant | Screens | Path | Packaged | Spike | Difference | Within noise |");
out("|---|---|---|---|---|---|---|");
for (const r of now.runs) {
  if (!r.ok) {
    out(`| ${LABEL[r.variant] ?? r.variant} | ${r.n} | run failed: ${r.error} | | | | |`);
    if (r.variant === "engine") engineOutside++;
    continue;
  }
  const base = find(ref, r.variant, r.n);
  for (const [key, label] of PATHS) {
    const a = r.paths?.[key]?.median;
    if (!a) continue;
    const b = base?.paths?.[key]?.median;
    rows++;
    if (!b) {
      out(`| ${LABEL[r.variant] ?? r.variant} | ${r.n} | ${label} | ${a.fps.toFixed(1)} fps, p95 ${a.p95Ms.toFixed(1)}ms | no reference | | |`);
      continue;
    }
    const ok = within(a.fps, b.fps);
    if (!ok && r.variant === "engine") engineOutside++;
    const d = a.fps - b.fps;
    out(`| ${LABEL[r.variant] ?? r.variant} | ${r.n} | ${label} | ${a.fps.toFixed(1)} fps, p95 ${a.p95Ms.toFixed(1)}ms, ${a.longTasks} long | ${b.fps.toFixed(1)} fps, p95 ${b.p95Ms.toFixed(1)}ms, ${b.longTasks} long | ${d >= 0 ? "+" : ""}${d.toFixed(1)} | ${ok ? "yes" : "NO"} |`);
  }
}

out();
out("## Load, background work and size");
out();
out("| Variant | Screens | Ready | Background | DOM elements | Heap | Browser memory | Picture memory |");
out("|---|---|---|---|---|---|---|---|");
const cell = (a, b, unit = "", digits = 0) => `${a === undefined || a === null ? "n/a" : a.toFixed(digits)}${unit} (spike ${b === undefined || b === null ? "n/a" : b.toFixed(digits)}${unit})`;
for (const r of now.runs) {
  if (!r.ok) continue;
  const b = find(ref, r.variant, r.n);
  const ready = (x) => x?.atRest?.stats && undefined;
  void ready;
  out(
    `| ${LABEL[r.variant] ?? r.variant} | ${r.n} | ${cell(r.loadMs, b?.loadMs, "ms")} | ${cell(r.backgroundMs / 1000, b ? b.backgroundMs / 1000 : null, "s", 1)} | ${cell(r.atRest.domElements, b?.atRest.domElements)} | ${cell(r.atRest.heapUsedMb, b?.atRest.heapUsedMb, " MB", 1)} | ${cell(r.atRest.browserMemory?.totalMb, b?.atRest.browserMemory?.totalMb, " MB")} | ${
      r.atRest.stats.pictureBytes ? cell(r.atRest.stats.pictureBytes / 1048576, b ? b.atRest.stats.pictureBytes / 1048576 : null, " MB", 1) : "none"
    } |`,
  );
}
out();
out(`Ready is the time Playwright waited for the page to report it could be used, which includes starting the page. Background is the time to picture every screen.`);
out();
out(
  engineOutside === 0
    ? `**Verdict.** Every engine frame rate is within noise of the spike (${rows} rows compared in all).`
    : `**Verdict.** ${engineOutside} engine row${engineOutside === 1 ? " is" : "s are"} outside noise of the spike. Read the table before quoting these numbers.`,
);
out();
out(`Measured ${now.runs.map((r) => r.measuredAt).sort().pop()} on headless Chromium with no real GPU. Reference measured ${ref.runs.map((r) => r.measuredAt).sort().pop()}.`);

const text = lines.join("\n") + "\n";
process.stdout.write(text);
fs.writeFileSync(path.join(path.dirname(NEW), "compare.md"), text);
process.exit(engineOutside === 0 ? 0 : 1);
