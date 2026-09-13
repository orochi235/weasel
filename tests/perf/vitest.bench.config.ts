import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from '../../scripts/vite-aliases';

const repoRoot = resolve(__dirname, '../..');

// Benchmarks live in their own config, not as a project in `vitest.config.ts`,
// so that no `--project` selection or bare `vitest run` can pull them into a
// correctness run. `npm run perf:bench` is the way in; it passes `--outputJson`
// and turns that report into a result file.
export default defineConfig({
  root: repoRoot,
  resolve: {
    alias: weaselAliases(repoRoot, [
      {
        find: '@weasel-js/theme/tokens.css',
        replacement: resolve(repoRoot, 'packages/theme/src/generated/tokens.css'),
      },
    ]),
  },
  plugins: [react()],
  test: {
    name: 'bench',
    // jsdom, not node: the font registry rasterizes through canvas/DOM shims
    // that `vitest.setup.ts` installs, and the core barrel pulls in modules
    // that touch `window` at load.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    benchmark: {
      include: ['tests/perf/bench/**/*.bench.ts'],
      reporters: ['default'],
    },
  },
});
