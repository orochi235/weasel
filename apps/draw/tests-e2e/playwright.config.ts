import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ports from '../../../scripts/dev-ports.json' with { type: 'json' };

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

// Manual-run e2e suite for WeaselDraw. Not part of `npm test` or
// `prepublishOnly`; invoke via `npm run test:e2e:draw`.
export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  use: {
    baseURL: `http://localhost:${ports.drawE2e}`,
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --config apps/draw/vite.config.ts --port ${ports.drawE2e}`,
    cwd: repoRoot,
    url: `http://localhost:${ports.drawE2e}/weasel/draw/`,
    // apps/draw/vite.config.ts loads vite-plugin-wake, which otherwise stops
    // any other running copy of this app to take its remembered port.
    // WAKE_EXTRA runs an extra copy on exactly this port instead, leaving a
    // developer's dev server alone.
    env: { WAKE_EXTRA: String(ports.drawE2e) },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  retries: 0,
  workers: 1,
});
