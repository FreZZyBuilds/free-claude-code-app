import { defineConfig } from "@playwright/test";

/*
  End-to-end tests drive the built Studio against a real fcc-server.
  Start fcc-server first (default http://127.0.0.1:8082, override with FCC_URL),
  then: npm run build && npm run test:e2e
*/
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5175",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: "node server.mjs",
    env: { STUDIO_PORT: "5175", FCC_URL: process.env.FCC_URL ?? "http://127.0.0.1:8082" },
    url: "http://127.0.0.1:5175",
    reuseExistingServer: true,
  },
});
