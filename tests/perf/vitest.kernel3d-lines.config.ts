import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { weaselAliases } from '../../scripts/vite-aliases.ts';
import { HOST_GPU_ARGS } from '../../scripts/chromium-gpu-args.ts';

const root = resolve(import.meta.dirname, '../..');

// Its own config, as `vitest.bench.config.ts` is, so no correctness run picks the bench up.
export default defineConfig({
  root,
  resolve: { alias: weaselAliases(root) },
  test: {
    name: 'kernel3d-lines-bench',
    include: ['tests/perf/bench/kernel3d-lines.bench.browser.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ launchOptions: { args: [...HOST_GPU_ARGS, '--use-angle=metal'] } }),
      instances: [{ browser: 'chromium' }],
    },
  },
});
