/**
 * Visual regression spec: gestures demo. Drags in the default `drag` mode and
 * captures the trace the overlay leaves behind: start dot, polyline, end dot.
 */
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, readCanvasPixels, dragOnCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'gestures';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — a drag leaves its trace on the overlay`, async ({ page }) => {
  const empty = await captureCanvas(page, `/#${DEMO_ID}`);
  const canvas = page.locator('canvas').first();
  await dragOnCanvas(page, canvas, [[80, 280], [180, 90], [300, 260], [440, 80]]);
  const png = await readCanvasPixels(canvas);
  // An updated baseline is written unchecked, so say here that the drag drew.
  expect(png.equals(empty), 'the drag should change the canvas').toBe(false);
  // The whole trace is 0.3% of the canvas, so the default 2% would
  // pass an empty one.
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-drag-trace.png`), { maxDiffRatio: 0.0005 });
});
