import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };

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
    // A port no dev server shares: with `reuseExistingServer` below, a local
    // run silently attaches to whatever already listens there, and every
    // baseline then fails against the wrong application — which reads like a
    // mass regression rather than a misconfiguration.
    baseURL: `http://localhost:${ports.visual}`,
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Chromium's 2D-canvas rasterizer antialiases hairline (≤1px) strokes only
    // on the GPU path; the CI runner has no GPU and draws them hard-edged. Tile
    // patterns build their textures with canvas2d strokes, so without this the
    // same baseline cannot pass on both. Forcing the software path locally is a
    // no-op on CI, which already takes it.
    launchOptions: { args: ['--disable-accelerated-2d-canvas'] },
  },
  // Playwright's built-in snapshot dir is NOT used. diff.ts manages its own
  // baselines/ directory so we have full control over diff thresholds and
  // naming conventions.
  snapshotDir: resolve(here, 'baselines'),
  webServer: {
    command: `npx vite --config vite.config.ts --port ${ports.visual}`,
    cwd: repoRoot,
    port: ports.visual,
    // vite.config.ts loads vite-plugin-wake, which otherwise stops any other
    // running copy of this app to take its remembered port. WAKE_EXTRA runs
    // an extra copy on exactly this port instead, leaving a developer's dev
    // server alone.
    env: { WAKE_EXTRA: String(ports.visual) },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  // No retries in CI — a failing visual test is a real regression.
  retries: 0,
  workers: 1,   // serial: deterministic ordering for baseline update workflow
});
