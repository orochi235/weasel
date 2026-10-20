import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import v8 from 'node:v8';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { weaselAliases } from './scripts/vite-aliases.ts';
import { traitSchemasPlugin } from './apps/draw/vite-plugin-trait-schemas.ts';
import { forgeAliases, frameConfig as forgeFrameConfig, stories as forgeStories } from './apps/forge/viteShared.ts';
import { forgeTest } from './packages/forge/src/vite/forgeTest.ts';
import { ownEntries as forgeOwnEntries } from './packages/forge/src/vite/ownEntries.ts';
import { weaselDefines } from './scripts/vite-build-info.ts';
import { demoTimestamps } from './scripts/vite-demo-timestamps.ts';
import { demoSources } from './scripts/vite-demo-sources.ts';
import { changelogs } from './scripts/vite-changelogs.ts';
import { getStarted } from './scripts/vite-get-started.ts';
import { packageDocs } from './scripts/vite-package-docs.ts';
import { weaselIcons } from './packages/icons-plugin/src/index.ts';
import { browserCommands } from './scripts/vitest-browser-commands.ts';
import { browserDeps } from './scripts/vitest-browser-deps.ts';
import { selection } from './scripts/lib/fleet-tree.mjs';

// Sparkplug code segfaults V8's GC in worker isolates below Node 24.22.0 (nodejs/node#62393).
// Workers spawned after this inherit the flag; NODE_OPTIONS refuses it.
v8.setFlagsFromString('--no-sparkplug');

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
    alias: weaselAliases(import.meta.dirname),
  },
  plugins: [react()],
};

// Vitest disables dep discovery everywhere but its vm environment, where vite scans every index.html
// in the repo and fails on the apps' virtual modules; a scan that worked would pre-bundle react and vitest.
const vm = { environments: { __vitest_vm__: { optimizeDeps: { noDiscovery: true, include: [] } } } };

const BROWSER_TESTS = ['packages/**/*.browser.test.{ts,tsx}', 'apps/**/*.browser.test.{ts,tsx}'];
const BROWSER_SETUP = './vitest.browser.setup.ts';

const VITE_SERVER_TESTS = [
  'packages/forge/src/csf/shims/alias.test.ts',
  'packages/forge/src/vite/plugin.test.ts',
  'packages/forge/src/vite/replacedFile.test.ts',
  'packages/prefs/src/vite.test.ts',
  'scripts/vitest-browser-deps.vite.test.ts',
];

// A branch's fleet run seeds vitest's `related` with what the branch changes, so only the test files
// importing it run. Every path seeded counts as affected, which is how the gate project always runs.
const related = selection(import.meta.dirname, process.env, {
  always: readdirSync(join(import.meta.dirname, 'scripts')).filter((f) => f.endsWith('.gate.ts')).map((f) => `scripts/${f}`),
  // Changes that reach tests with no import edge to follow, this config and what it loads among them:
  // any of these runs everything.
  triggers: [
    '**/package.json',
    'package-lock.json',
    '**/tsconfig*.json',
    '.onto/tests',
    '**/{vitest,vite}.config.*',
    'vitest.*setup.ts',
    'packages/labkit/src/test-setup.ts',
    'scripts/{vite,vitest}-*.ts',
    'scripts/lib/**',
    'apps/draw/vite-plugin-*.ts',
    'apps/forge/viteShared.ts',
    'packages/forge/src/vite/**',
    'packages/icons-plugin/**',
  ],
});

export default defineConfig({
  test: {
    globalSetup: ['./scripts/fleet-tree.setup.ts', './scripts/module-cache.setup.ts'],
    fsModuleCache: true,
    ...(related && { related }),
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
        // The demo site reads several virtual modules that only exist because
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
          getStarted({ root: import.meta.dirname }),
          packageDocs({ root: import.meta.dirname }),
          weaselIcons.vite({ mode: 'app' }),
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
          exclude: ['packages/labkit/**', 'packages/forge/**', 'packages/core/**', ...VITE_SERVER_TESTS, '**/*.build.test.ts', '**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
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
          exclude: [...VITE_SERVER_TESTS, '**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
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
          include: [...VITE_SERVER_TESTS, 'packages/icons-plugin/src/**/*.build.test.ts'],
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
        plugins: [react(), traitSchemasPlugin({ repoRoot: import.meta.dirname }), weaselIcons.vite({ mode: 'app' })],
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
            'apps/chart/**/*.test.{ts,tsx}',
            'apps/theme-editor/**/*.test.{ts,tsx}',
            'apps/devtools-extension/**/*.test.{ts,tsx}',
            'apps/shared/**/*.test.{ts,tsx}',
            'scripts/**/*.test.ts',
          ],
          exclude: [...VITE_SERVER_TESTS, '**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
        },
      },
      // The typecheck, lint, and check:* steps CI runs, as tests, so a fleet
      // run (`.onto/tests`, which is one vitest command) fails on what a push
      // would. Not in `npm test`: CI runs those steps itself.
      {
        test: {
          name: 'gate',
          environment: 'node',
          pool: 'threads',
          testTimeout: 900_000,
          // The browser project starts only once this group ends, so a serial gate held it back by a
          // minute. Uncached, lint and check:needs beside typecheck slowed labkit's storyArgs.test.tsx
          // past its timeout; cached, typecheck is the only heavy check left.
          maxConcurrency: 3,
          include: ['scripts/**/*.gate.ts'],
        },
      },
      // Tests that need a real browser — layout, real IndexedDB, CSS that jsdom
      // resolves none of. Headless Chromium, like forge-stories below.
      {
        ...shared,
        // A dependency met mid-run makes vite re-optimize and reload the page under the suites, and a
        // node's warm cache skips the scan that would have found it. `optimizeDeps.force` is not the
        // fix: with it the browser session never connected on two fleet nodes. `info` puts vite's
        // "Re-optimizing dependencies" line in the log, which vitest's default `warn` drops.
        logLevel: 'info',
        optimizeDeps: {
          entries: BROWSER_TESTS,
          include: browserDeps(import.meta.dirname, { entries: BROWSER_TESTS, setupFiles: [BROWSER_SETUP] }),
        },
        test: {
          name: 'browser',
          include: BROWSER_TESTS,
          // The default second is not enough on a fleet node running eight other projects: a smooth
          // scroll or a dialog's close outlasts it there, and a poll that is going to pass costs nothing.
          expect: { poll: { timeout: 5000 } },
          // Browser mode's default is 15 s. A chart test drawing its shapes through the canvas takes 3.5 s
          // alone, passed at up to 14 s in full fleet runs, and was cut off at 15 s in the busiest ones.
          testTimeout: 45_000,
          setupFiles: [BROWSER_SETUP],
          // After every other project in one process: a browser test's clicks and screenshots stall
          // when the node's cores are taken, and time out. `npm test` and the fleet run it beside
          // them instead, with the rest held to fewer workers (scripts/vitest-overlap.mjs).
          sequence: { groupOrder: 1 },
          // Every tab shares one Chromium. Past six, the project took no less wall time on 14- and
          // 18-core nodes, and a test making WebGL contexts ran three to five times as long.
          maxWorkers: 6,
          exclude: ['**/node_modules/**', '**/dist/**'],
          css: true,
          browser: {
            enabled: true,
            // A fake audio sink: on a node whose output device does not run, a real one leaves an
            // AudioContext "running" with its clock stopped, and the tests sound on every node.
            provider: playwright({ launchOptions: { args: ['--disable-audio-output'] } }),
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
        // The same guard as the `browser` project's: every story and the frame they render through.
        logLevel: 'info',
        optimizeDeps: {
          include: browserDeps(import.meta.dirname, {
            entries: forgeStories,
            setupFiles: [forgeFrameConfig, ...forgeOwnEntries(['test'])],
          }),
        },
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
