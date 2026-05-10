/**
 * Visual regression spec: color-matrix demo.
 *
 * Captures the canvas at the demo's default state (three nested groups at
 * the seed presets: outer Identity, middle Sepia, inner Hue+90°) and
 * asserts pixel diff ≤ 2%.
 *
 * Interaction sequence:
 *   1. Initial mount — capture three palettes under their stacked matrices.
 *
 * Notes: Static after mount. The hue-rotate matrix uses a luminance-
 * preserving approximation; the baseline pins whatever the current
 * implementation produces.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'color-matrix';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
