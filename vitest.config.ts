import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { weaselAliases } from './scripts/vite-aliases';

const storybookDir = dirname(fileURLToPath(new URL('./.storybook/main.ts', import.meta.url)));

// One vitest config; three named projects. Each project owns its include
// glob so suites can run independently (`vitest --project=weasel-ui`),
// and the default run (`npm test`) executes all three. Shared concerns
// (jsdom env, setup, alias map) live in the per-project block — vitest
// doesn't currently inherit `resolve` or `test` keys from the top-level
// config when `projects` is set.
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
          name: 'swillustrator',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['apps/swillustrator/**/*.test.{ts,tsx}'],
        },
      },
      // Runs every CSF story as a Vitest test. Requires Playwright (`@playwright/test`
      // + a browser install). To skip: `vitest --project=kit --project=weasel-ui --project=swillustrator`
      // or filter explicitly.
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
          setupFiles: ['./.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
});
