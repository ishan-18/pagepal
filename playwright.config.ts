import { defineConfig } from '@playwright/test';

/**
 * Real-browser tests. Uses the installed Microsoft Edge by default (no browser
 * download); set PW_CHANNEL=chromium (after `npx playwright install chromium`) in CI.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 20_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    channel: process.env.PW_CHANNEL ?? 'msedge',
    viewport: { width: 1280, height: 800 },
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  webServer: {
    command: 'node scripts/serve.mjs 5174',
    port: 5174,
    reuseExistingServer: !process.env.CI,
  },
});
