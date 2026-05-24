import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

// Manual-run e2e suite for WeaselDraw. Not part of `npm test` or
// `prepublishOnly`; invoke via `npm run test:e2e:draw`. Uses port 5176 to
// avoid collisions with `dev:draw` (5174) and the visual suite (also 5174).
export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  use: {
    baseURL: 'http://localhost:5176',
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'npx vite --config apps/draw/vite.config.ts --port 5176',
    cwd: repoRoot,
    url: 'http://localhost:5176/weasel/draw/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  retries: 0,
  workers: 1,
});
