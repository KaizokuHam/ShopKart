import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5178", trace: "retain-on-failure", screenshot: "only-on-failure", reducedMotion: "reduce" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    { command: "node ../../backend/testing/e2e-server.js", url: "http://127.0.0.1:8096/health", env: { SHOPKART_E2E: "1" }, timeout: 1200000, reuseExistingServer: false },
    { command: "npm run dev -- --host 127.0.0.1 --port 5178", url: "http://127.0.0.1:5178", env: { VITE_API_URL: "http://127.0.0.1:8096" }, timeout: 60000, reuseExistingServer: false },
  ],
});
