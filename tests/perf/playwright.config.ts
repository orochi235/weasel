import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
// A second checkout running perf on the default port would otherwise be reused
// outside CI, and every spec would measure that checkout's code.
const port = Number(process.env.WEASEL_PERF_PORT ?? ports.perf);

// Performance / stress harness. These specs drive the demos under a real GL
// renderer and assert on wall-clock timing and crash-freedom — they are NOT
// pixel-baseline tests, so they deliberately live outside tests/visual/ where
// their timing-sensitive assertions would otherwise red the visual gate on
// slow shared CI runners. Run manually with `npm run test:perf`.
export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
    // `globalThis.gc()`, so a spec can collect the garbage it built between
    // measurements instead of paying for it inside a timed block. Absent the
    // flag `gc` is undefined and specs fall back to timing through it.
    // `--use-angle=metal` because headless otherwise picks ANGLE's OpenGL
    // backend, measuring a path shipping Chrome on macOS does not take.
    launchOptions: { args: ['--js-flags=--expose-gc', '--use-angle=metal'] },
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --config vite.config.ts --port ${port}`,
    cwd: repoRoot,
    port,
    // vite.config.ts loads vite-plugin-wake, which otherwise stops any other
    // running copy of this app to take its remembered port. WAKE_EXTRA runs
    // an extra copy on exactly this port instead, leaving a developer's dev
    // server alone.
    env: { WAKE_EXTRA: String(port) },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  retries: 0,
  workers: 1,
});
