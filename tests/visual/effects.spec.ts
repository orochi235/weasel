/**
 * Visual regression spec: full-screen effect passes.
 *
 * The unit tests can prove the passes happen; only a browser can prove they
 * did anything. Two captures, and the pair is the assertion: at radius 0 the
 * tiles are crisp, at the default radius they are not, and the HUD hairlines
 * drawn above the blurred layer are identical in both — which is what
 * separates a real pass from a CSS `filter` on the canvas.
 *
 * Determinism: the demo's tiles are a fixed literal and nothing animates, so
 * both frames are stable without a time freeze.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, readCanvasPixels, waitForRepaint, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'effects';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — blurred world, sharp HUD`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-blurred.png`));
});

test(`${DEMO_ID} — radius 0 leaves the layer untouched`, async ({ page }) => {
  await captureCanvas(page, `/#${DEMO_ID}`);
  // The blur slider is the only range input on the page.
  await page.locator('input[type=range]').fill('0');
  await waitForRepaint(page);
  const png = await readCanvasPixels(page.locator('canvas').first());
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-sharp.png`));
});
