import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { weaselAliases } from './scripts/vite-aliases';

const storybookDir = dirname(fileURLToPath(new URL('./.storybook/main.ts', import.meta.url)));

// One vitest config; named projects per surface. Each project owns its
// include glob so suites can run independently (`vitest --project=weasel-ui`).
// Default `npm test` runs the jsdom projects (kit, weasel-ui, WeaselDraw,
// smoke). Heavy projects (storybook browser tests) are opt-in via
// `npm run test:stories`. Shared concerns (jsdom env, setup, alias map) live
// in the per-project block — vitest doesn't currently inherit `resolve` or
// `test` keys from the top-level config when `projects` is set.
const shared = {
  resolve: {
    alias: weaselAliases(__dirname, [
      {
        find: '@orochi235/weasel-theme/tokens.css',
        replacement: resolve(__dirname, 'packages/weasel-theme/src/tokens.css'),
      },
    ]),
  },
  plugins: [react()],
};

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          name: 'kit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.{ts,tsx}', 'demo/**/*.test.{ts,tsx}'],
          exclude: ['**/*.smoke.test.{ts,tsx}', '**/node_modules/**'],
        },
      },
      {
        ...shared,
        test: {
          name: 'smoke',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: [
            'src/**/*.smoke.test.{ts,tsx}',
            'packages/**/*.smoke.test.{ts,tsx}',
            'apps/**/*.smoke.test.{ts,tsx}',
            'demo/**/*.smoke.test.{ts,tsx}',
          ],
          exclude: ['**/node_modules/**', 'dist/**', '.claude/**'],
        },
      },
      {
        ...shared,
        test: {
          name: 'weasel-ui',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['packages/**/*.test.{ts,tsx}'],
        },
      },
      {
        ...shared,
        test: {
          name: 'draw',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['apps/draw/**/*.test.{ts,tsx}'],
        },
      },
      // Runs every CSF story as a Vitest test. Requires Playwright
      // (`@playwright/test` + a browser install). Opt-in via
      // `npm run test:stories`; not included in default `npm test`
      // because spinning up Chromium is slow and unnecessary for most
      // dev-loop runs. CI / pre-release should still run this.
      {
        plugins: [
          react(),
          storybookTest({ configDir: storybookDir }),
        ],
        resolve: shared.resolve,
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
