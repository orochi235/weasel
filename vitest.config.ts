import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { weaselAliases } from './scripts/vite-aliases';
import { traitSchemasPlugin } from './apps/draw/vite-plugin-trait-schemas';

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
        find: '@weasel-js/theme/tokens.css',
        replacement: resolve(__dirname, 'packages/theme/src/generated/tokens.css'),
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
          include: [
            'packages/core/src/**/*.test.{ts,tsx}',
            'apps/site/**/*.test.{ts,tsx}',
            'tests/e2e/helpers/**/*.test.{ts,tsx}',
          ],
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
            'packages/**/*.smoke.test.{ts,tsx}',
            'apps/**/*.smoke.test.{ts,tsx}',
          ],
          // labkit's smoke test runs in the dedicated `labkit` project (own setup).
          exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', 'packages/labkit/**'],
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
          // labkit runs in its own project below (own setup + css handling).
          // core runs in the `kit` project above — it lived at the repo root
          // until the move into packages/, and this glob would otherwise
          // swallow its entire suite and run it twice.
          exclude: ['packages/labkit/**', 'packages/core/**', '**/node_modules/**'],
        },
      },
      {
        ...shared,
        test: {
          name: 'labkit',
          environment: 'jsdom',
          globals: true,
          // labkit ships its own setup (jest-dom matchers, cleanup, storage
          // hoist) and imports component CSS, so it needs css handling — the
          // root setup/projects don't provide either.
          setupFiles: ['./packages/labkit/src/test-setup.ts'],
          css: true,
          include: ['packages/labkit/src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/node_modules/**'],
        },
      },
      {
        ...shared,
        // The draw app's Bundle Inspector consumes
        // `virtual:weasel-trait-schemas`, served by a Vite plugin that's
        // wired in `apps/draw/vite.config.ts` for dev/build. Vitest
        // doesn't inherit that config, so the plugin has to be added
        // here too or any test that imports a Bundle Inspector module
        // fails to resolve the virtual id at load time.
        plugins: [react(), traitSchemasPlugin({ repoRoot: __dirname })],
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
