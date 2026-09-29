import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { weaselAliases } from './scripts/vite-aliases.ts';
import { traitSchemasPlugin } from './apps/draw/vite-plugin-trait-schemas.ts';
import { forgeAliases, frameConfig as forgeFrameConfig, stories as forgeStories } from './apps/forge/viteShared.ts';
import { forgeTest } from './packages/forge/src/vite/forgeTest.ts';
import { weaselDefines } from './scripts/vite-build-info.ts';
import { demoTimestamps } from './scripts/vite-demo-timestamps.ts';
import { demoSources } from './scripts/vite-demo-sources.ts';
import { changelogs } from './scripts/vite-changelogs.ts';
import { browserCommands } from './scripts/vitest-browser-commands.ts';

// One vitest config; named projects per surface. Each project owns its
// include glob so suites can run independently (`vitest --project=weasel-ui`).
// Default `npm test` runs the jsdom projects plus `browser`, which runs
// `*.browser.test.*` files in headless Chromium. `npm run check:test-projects`
// fails the build on a test file no project's glob reaches. `forge-stories`
// is opt-in via `npm run test:stories:forge`. Shared concerns (jsdom env, setup, alias map) live
// in the per-project block — vitest doesn't currently inherit `resolve` or
// `test` keys from the top-level config when `projects` is set.
const shared = {
  resolve: {
    alias: weaselAliases(import.meta.dirname, [
      {
        find: '@weasel-js/theme/tokens.css',
        replacement: resolve(import.meta.dirname, 'packages/theme/src/generated/tokens.css'),
      },
    ]),
  },
  plugins: [react()],
};

// Vitest disables dep discovery everywhere but its vm environment, where vite scans every index.html
// in the repo and fails on the apps' virtual modules; a scan that worked would pre-bundle react and vitest.
const vm = { environments: { __vitest_vm__: { optimizeDeps: { noDiscovery: true, include: [] } } } };

const FORGE_NODE = [
  'packages/forge/src/csf/shims/alias.test.ts',
  'packages/forge/src/vite/plugin.test.ts',
];

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        ...vm,
        test: {
          name: 'core',
          environment: 'jsdom',
          pool: 'vmThreads',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: [
            'packages/core/src/**/*.test.{ts,tsx}',
            'tests/e2e/helpers/**/*.test.{ts,tsx}',
            'tests/perf/lib/**/*.test.{ts,tsx}',
            'typedoc/**/*.test.mjs',
          ],
          exclude: ['**/*.smoke.test.{ts,tsx}', '**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
        },
      },
      {
        ...shared,
        ...vm,
        // The demo site reads three virtual modules that only exist because
        // `vite.config.ts` wires their plugins. Vitest does not inherit that
        // config, so without these the site's own shell — `registry.ts`,
        // `Releases.tsx` — cannot be imported by a test at all, which is why
        // it went uncovered. Its own project rather than a glob on `core`, so
        // 400-odd core files don't pay for reading every CHANGELOG.
        plugins: [
          react(),
          demoTimestamps({ root: import.meta.dirname }),
          demoSources({ root: import.meta.dirname }),
          changelogs({ root: import.meta.dirname }),
        ],
        test: {
          name: 'site',
          environment: 'jsdom',
          pool: 'vmThreads',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['apps/site/**/*.test.{ts,tsx}'],
          exclude: ['**/*.smoke.test.{ts,tsx}', '**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
        },
      },
      {
        ...shared,
        ...vm,
        test: {
          name: 'smoke',
          environment: 'jsdom',
          pool: 'vmThreads',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: [
            'packages/**/*.smoke.test.{ts,tsx}',
            'apps/**/*.smoke.test.{ts,tsx}',
          ],
          // labkit's smoke test runs in the dedicated `labkit` project (own setup).
          exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', 'packages/labkit/**', 'packages/forge/**', '**/*.browser.test.{ts,tsx}'],
        },
      },
      {
        ...shared,
        ...vm,
        test: {
          name: 'weasel-ui',
          environment: 'jsdom',
          pool: 'vmThreads',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['packages/**/*.test.{ts,tsx}'],
          // labkit runs in its own project below (own setup + css handling).
          // core runs in the `core` project above — it lived at the repo root
          // until the move into packages/, and this glob would otherwise
          // swallow its entire suite and run it twice.
          exclude: ['packages/labkit/**', 'packages/forge/**', 'packages/core/**', '**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
        },
      },
      {
        ...shared,
        ...vm,
        test: {
          name: 'labkit',
          environment: 'jsdom',
          pool: 'vmThreads',
          globals: true,
          // labkit ships its own setup (jest-dom matchers, cleanup, storage
          // hoist) and imports component CSS, so it needs css handling — the
          // root setup/projects don't provide either.
          setupFiles: ['./packages/labkit/src/test-setup.ts'],
          css: true,
          // A test that mounts a whole lab takes up to ~0.5 s alone and blows the 5 s default under a full fleet run.
          testTimeout: 20_000,
          include: ['packages/labkit/{src,scripts,examples}/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
        },
      },
      {
        ...shared,
        ...vm,
        test: {
          name: 'forge',
          environment: 'jsdom',
          pool: 'vmThreads',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          // A test that mounts the whole workshop takes ~1 s alone and blows the 5 s default under a full fleet run.
          testTimeout: 20_000,
          include: ['packages/forge/src/**/*.test.{ts,tsx}', 'apps/forge/*.test.{ts,tsx}'],
          exclude: [...FORGE_NODE, '**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
        },
      },
      {
        ...shared,
        test: {
          // These start a real vite server, and rolldown's native binding
          // rejects a RegExp made in another realm, so they cannot run in a VM
          // context the way every jsdom project does.
          name: 'forge-node',
          environment: 'node',
          pool: 'threads',
          testTimeout: 20_000,
          include: FORGE_NODE,
        },
      },
      {
        ...shared,
        ...vm,
        // The draw app's Bundle Inspector consumes
        // `virtual:weasel-trait-schemas`, served by a Vite plugin that's
        // wired in `apps/draw/vite.config.ts` for dev/build. Vitest
        // doesn't inherit that config, so the plugin has to be added
        // here too or any test that imports a Bundle Inspector module
        // fails to resolve the virtual id at load time.
        plugins: [react(), traitSchemasPlugin({ repoRoot: import.meta.dirname })],
        test: {
          name: 'draw',
          environment: 'jsdom',
          pool: 'vmThreads',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          // `apps/shared/` holds modules both in-repo apps import (buildInfo),
          // and `scripts/` the build-time plugins that feed them. Both ride
          // with the draw project rather than getting one of their own — same
          // jsdom environment, and no third config to keep in sync.
          include: [
            'apps/draw/**/*.test.{ts,tsx}',
        'apps/theme-editor/**/*.test.{ts,tsx}',
            'apps/shared/**/*.test.{ts,tsx}',
            'scripts/**/*.test.ts',
          ],
          exclude: ['**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
        },
      },
      // Tests that need a real browser — layout, real IndexedDB, CSS that jsdom
      // resolves none of. Headless Chromium, like forge-stories below.
      {
        ...shared,
        // Scanned up front: a dependency discovered mid-run makes vite re-optimize and reload,
        // and the reloaded page gets a second React ("Invalid hook call").
        optimizeDeps: { entries: ['packages/**/*.browser.test.{ts,tsx}', 'apps/**/*.browser.test.{ts,tsx}'] },
        test: {
          name: 'browser',
          include: ['packages/**/*.browser.test.{ts,tsx}', 'apps/**/*.browser.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          css: true,
          browser: {
            enabled: true,
            provider: playwright(),
            commands: browserCommands,
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      // Every story — native and CSF — rendered and played through forge's frame, with the workshop's
      // frame setup. Opt-in via `npm run test:stories:forge`; kept out of `test`, `test:unit` and CI
      // because it pulls Playwright and ~250 MB of browser only to prove every story mounts.
      {
        plugins: [
          react(),
          traitSchemasPlugin({ repoRoot: import.meta.dirname }),
          forgeTest({ stories: forgeStories, frameConfig: forgeFrameConfig }),
        ],
        resolve: { alias: forgeAliases(import.meta.dirname) },
        define: weaselDefines(import.meta.dirname),
        test: {
          name: 'forge-stories',
          include: forgeStories,
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
