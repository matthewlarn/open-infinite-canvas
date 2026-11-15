/* Records what the benchmark machine is: browser, renderer, frame rate, cores. Usage: node scripts/env.cjs [out.json] */
const os = require("node:os");
const fs = require("node:fs");
const { chromium } = require("./lib.cjs");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent("<body style='margin:0'><canvas id=c></canvas></body>");
  const info = await page.evaluate(async () => {
    const gl = document.getElementById("c").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const deltas = [];
    let prev = await new Promise((r) => requestAnimationFrame(r));
    for (let i = 0; i < 120; i++) {
      const now = await new Promise((r) => requestAnimationFrame(r));
      deltas.push(now - prev);
      prev = now;
    }
    deltas.sort((a, b) => a - b);
    return {
      userAgent: navigator.userAgent,
      webglRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown",
      devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      idleFrameMsMedian: deltas[60],
      idleFrameMsP95: deltas[114],
      screen: { w: innerWidth, h: innerHeight },
    };
  });
  let gpu = null;
  try {
    const cdp = await browser.newBrowserCDPSession();
    const g = await cdp.send("SystemInfo.getInfo");
    gpu = { devices: g.gpu.devices.map((d) => `${d.vendorString} ${d.deviceString} ${d.driverVersion}`.trim()), featureStatus: g.gpu.featureStatus, modelName: g.modelName, commandLine: g.commandLine };
  } catch (e) {
    gpu = { error: String(e.message) };
  }
  const out = {
    measuredAt: new Date().toISOString(),
    browserVersion: browser.version(),
    playwright: require("@playwright/test/package.json").version,
    node: process.version,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    memoryGb: +(os.totalmem() / 1073741824).toFixed(1),
    ...info,
    gpu,
  };
  console.log(JSON.stringify(out, null, 2));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
