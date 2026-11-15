import { defineConfig } from "@playwright/test";

/* The pre-installed Chromium is used. Nothing is downloaded. */
export const PORTS = { bench: 4179, react18: 4180, demo: 4181 };

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  reporter: [["list"]],
  use: { browserName: "chromium", viewport: { width: 1440, height: 900 }, baseURL: `http://127.0.0.1:${PORTS.bench}` },
  webServer: [
    { command: `node scripts/serve.cjs app/dist ${PORTS.bench}`, url: `http://127.0.0.1:${PORTS.bench}`, reuseExistingServer: false },
    { command: `node scripts/serve.cjs app/dist-react18 ${PORTS.react18}`, url: `http://127.0.0.1:${PORTS.react18}`, reuseExistingServer: false },
    { command: `node scripts/serve.cjs ../apps/demo/dist ${PORTS.demo}`, url: `http://127.0.0.1:${PORTS.demo}`, reuseExistingServer: false },
  ],
});
