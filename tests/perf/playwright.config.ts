import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

// Performance / stress harness. These specs drive the demos under a real GL
// renderer and assert on wall-clock timing and crash-freedom — they are NOT
// pixel-baseline tests, so they deliberately live outside tests/visual/ where
// their timing-sensitive assertions would otherwise red the visual gate on
// slow shared CI runners. Run manually with `npm run test:perf`.
export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  use: {
    baseURL: 'http://localhost:5176',   // distinct port: 5173 smoke / 5174 visual / 5175 e2e
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --config vite.config.ts --port 5176',
    cwd: repoRoot,
    port: 5176,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  retries: 0,
  workers: 1,
});
