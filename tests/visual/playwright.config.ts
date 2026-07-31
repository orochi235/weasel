import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  // Captures read the canvas backing store (see diff.ts readCanvasPixels), so
  // baseline dimensions are the demo's own canvas size and do NOT depend on the
  // viewport or on layout above the canvas. deviceScaleFactor still matters —
  // the kit sizes the backing store by DPR, so changing it rescales every
  // baseline. The viewport is fixed mainly to keep demo layout stable.
  use: {
    // 5177, not 5174. `dev:draw` binds 5174 (and the kit dev server proxies
    // /weasel/draw/ there, so that port is spoken for), and with
    // `reuseExistingServer` below a local run would silently attach to
    // WeaselDraw instead of the kit demos — every baseline then fails against
    // the wrong application, which reads like a mass regression rather than a
    // misconfiguration. Ports: 5173 smoke / 5174 dev:draw / 5175 e2e /
    // 5176 perf + draw e2e / 5177 visual.
    baseURL: 'http://localhost:5177',
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
    command: 'npx vite --config vite.config.ts --port 5177',
    cwd: repoRoot,
    port: 5177,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  // No retries in CI — a failing visual test is a real regression.
  retries: 0,
  workers: 1,   // serial: deterministic ordering for baseline update workflow
});
