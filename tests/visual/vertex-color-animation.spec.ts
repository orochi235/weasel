/**
 * Visual regression spec: vertex-color-animation demo.
 *
 * Captures the canvas after pausing the color cycle, so all three strokes show
 * their committed rainbow and the capture does not depend on the clock.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline, readCanvasPixels, waitForRepaint } from './diff.js';

const DEMO_ID = 'vertex-color-animation';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  await captureCanvas(page, `/#${DEMO_ID}`);
  await page.getByRole('button', { name: 'pause cycle' }).click();
  await waitForRepaint(page);
  const png = await readCanvasPixels(page.locator('canvas').first());
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
