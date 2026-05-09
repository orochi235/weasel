import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

export default defineConfig({
  testDir: '.',
  testMatch: 'smoke.spec.ts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npx vite --config packages/weasel-gl/dev/vite.config.ts --port 5173',
    cwd: repoRoot,
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
