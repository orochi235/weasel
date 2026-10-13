/**
 * Visual regression spec: gestures demo, the empty surface at mount. The
 * per-gesture overlays are not captured: simulated pointer drags would add
 * per-runner timing flakiness to a pixel-exact snapshot.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'gestures';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
