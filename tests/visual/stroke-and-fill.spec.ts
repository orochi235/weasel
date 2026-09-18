/**
 * Visual regression spec: stroke-and-fill demo.
 *
 * Captures the canvas at the demo's default state — a gradient-filled rect
 * with a 6px stroke, a vertex-colored heptagon and a tapered polyline — and
 * asserts pixel diff ≤ 2%.
 *
 * Interaction sequence:
 *   1. Initial mount — capture the three shapes as seeded.
 *
 * Notes: static after mount. The gradient handles and the paint panel are DOM
 * over and beside the canvas; `captureCanvas` reads the canvas backing store,
 * so neither is part of the capture.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'stroke-and-fill';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
