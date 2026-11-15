/* Counts DOM elements per screen template, so the demo's weight can be compared with real prototypes. Usage: node scripts/count.cjs [n] [out.json] */
const { chromium, startServer } = require("./lib.cjs");
(async () => {
  const n = Number(process.argv[2] ?? 290);
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${server.url}/?v=naive&n=${n}&hud=0`);
  await page.waitForFunction(() => window.__bench?.ready, null, { timeout: 120000 });
  const rows = await page.evaluate(() => [...document.querySelectorAll(".naive-frame")].map((f) => ({ name: f.querySelector(".naive-label").textContent.replace(/ \d+$/, ""), w: f.offsetWidth, els: f.querySelectorAll(".screen *").length + 1, text: f.querySelector(".screen").textContent.length })));
  const by = new Map();
  for (const r of rows) {
    const k = r.name;
    const e = by.get(k) ?? { n: 0, els: 0, text: 0, min: Infinity, max: 0 };
    e.n++; e.els += r.els; e.text += r.text; e.min = Math.min(e.min, r.els); e.max = Math.max(e.max, r.els);
    by.set(k, e);
  }
  const total = rows.reduce((s, r) => s + r.els, 0);
  for (const [k, e] of [...by].sort((a, b) => b[1].els / b[1].n - a[1].els / a[1].n)) console.log(`${k.padEnd(26)} avg ${String(Math.round(e.els / e.n)).padStart(4)}  min ${String(e.min).padStart(4)}  max ${String(e.max).padStart(4)}  chars ${Math.round(e.text / e.n)}`);
  console.log(`\n${rows.length} screens, ${total} elements, ${(total / rows.length).toFixed(1)} per screen`);
  const out = process.argv[3];
  if (out) {
    require("node:fs").writeFileSync(out, JSON.stringify({ measuredAt: new Date().toISOString(), screens: rows.length, total, perScreen: +(total / rows.length).toFixed(1), byTemplate: [...by].map(([name, e]) => ({ name, screens: e.n, elements: Math.round(e.els / e.n), characters: Math.round(e.text / e.n) })).sort((a, b) => b.elements - a.elements) }, null, 1));
  }
  await browser.close();
  await server.close();
})().catch((e) => { console.error(e); process.exit(1); });
