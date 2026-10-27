import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');

// Benchmarks live in their own config, not as a project in `vitest.config.ts`,
// so that no `--project` selection or bare `vitest run` can pull them into a
// correctness run. `npm run perf:bench` is the way in; it asks for the JSON
// reporter and turns that report into a result file.
export default defineConfig({
  root: repoRoot,
  test: {
    name: 'bench',
    // Node imports the code itself, not Vite's module runner: the runner turns
    // every imported binding into a getter, which a sub-microsecond bench
    // times along with the code. `node-hooks.mjs` resolves and compiles the
    // source in Vite's place.
    experimental: { viteModuleRunner: false, nodeLoader: false },
    execArgv: ['--import', './tests/perf/bench/node-hooks.mjs'],
    // jsdom, not node: the font registry rasterizes through canvas/DOM shims
    // that `vitest.setup.ts` installs, and the core barrel pulls in modules
    // that touch `window` at load.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    benchmark: {
      include: ['tests/perf/bench/**/*.bench.ts'],
    },
  },
});
