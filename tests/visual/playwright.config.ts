import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  // Pixel determinism requires a fixed viewport size. All baselines are
  // captured at 1280×800, deviceScaleFactor 1. Changing either value
  // invalidates ALL baselines — regenerate via test:visual:update.
  use: {
    baseURL: 'http://localhost:5174',   // separate port from smoke suite (5173)
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // Playwright's built-in snapshot dir is NOT used. diff.ts manages its own
  // baselines/ directory so we have full control over diff thresholds and
  // naming conventions.
  snapshotDir: resolve(here, 'baselines'),
  webServer: {
    command: 'npx vite --config vite.config.ts --port 5174',
    cwd: repoRoot,
    port: 5174,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  // No retries in CI — a failing visual test is a real regression.
  retries: 0,
  workers: 1,   // serial: deterministic ordering for baseline update workflow
});
