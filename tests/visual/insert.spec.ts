/**
 * Visual regression spec: insert demo. Drags the rect tool across the empty
 * canvas and captures the rectangle the insert action committed.
 */
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, readCanvasPixels, dragOnCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'insert';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — a drag inserts a rectangle`, async ({ page }) => {
  const empty = await captureCanvas(page, `/#${DEMO_ID}`);
  const canvas = page.locator('canvas').first();
  await dragOnCanvas(page, canvas, [[80, 60], [260, 200]]);
  const png = await readCanvasPixels(canvas);
  // An updated baseline is written unchecked, so say here that the drag drew.
  expect(png.equals(empty), 'the drag should change the canvas').toBe(false);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-rect.png`));
});
