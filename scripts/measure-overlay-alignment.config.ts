// The edit overlay's alignment matrix: every browser at DPR 1 and 2.
//   npx vitest run -c scripts/measure-overlay-alignment.config.ts
// Narrow with MEASURE_BROWSERS=chromium,webkit and MEASURE_DPRS=1.
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import base from '../vitest.config.ts';

type Project = { test: { name?: string; browser: object } };
const browser = (base.test!.projects as Project[]).find((p) => p.test?.name === 'browser')!;
const browsers = (process.env.MEASURE_BROWSERS ?? 'chromium,webkit,firefox').split(',');
const dprs = (process.env.MEASURE_DPRS ?? '1,2').split(',').map(Number);

export default defineConfig({
  root: resolve(import.meta.dirname, '..'),
  test: {
    projects: [{
      ...browser,
      test: {
        ...browser.test,
        name: 'overlay-alignment',
        provide: { overlayAlignmentMatrix: true },
        include: ['packages/core/src/features/text/overlayAlignment.browser.test.tsx'],
        browser: {
          ...browser.test.browser,
          instances: browsers.flatMap((name) => dprs.map((dpr) => ({
            browser: name,
            name: `${name}-dpr${dpr}`,
            provider: playwright({ contextOptions: { deviceScaleFactor: dpr } }),
          }))),
        },
      },
    }],
  },
});
