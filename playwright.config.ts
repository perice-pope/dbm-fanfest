import { defineConfig, devices } from "@playwright/test";

try { process.loadEnvFile(".env.local"); } catch { /* env already set */ }

export default defineConfig({
  testDir: "tests/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure", ...devices["iPhone 13"], browserName: "chromium" },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
