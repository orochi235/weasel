import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  use: {
    baseURL: `http://localhost:${ports.e2e}`,
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --config vite.config.ts --port ${ports.e2e}`,
    cwd: repoRoot,
    port: ports.e2e,
    // vite.config.ts loads vite-plugin-wake, which otherwise stops any other
    // running copy of this app to take its remembered port. WAKE_EXTRA runs
    // an extra copy on exactly this port instead, leaving a developer's dev
    // server alone.
    env: { WAKE_EXTRA: String(ports.e2e) },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  retries: 0,
});
