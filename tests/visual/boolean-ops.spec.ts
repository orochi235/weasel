/**
 * Visual regression spec: boolean-ops demo, static after mount. Tolerance
 * bumped to 5% to cover evenodd-stencil-edge differences on multi-contour
 * boolean results, matching `compound-paths.spec.ts`.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline, type DiffOptions } from './diff.js';

const DEMO_ID = 'boolean-ops';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

const OPTS: DiffOptions = { maxDiffRatio: 0.05 };

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`), OPTS);
});
