/**
 * Visual regression spec: vertex-colors demo.
 *
 * Captures the canvas at the demo's default state (rainbow heptagon at
 * radius 140 from canvas center) and asserts pixel diff ≤ 2%.
 *
 * Interaction sequence:
 *   1. Initial mount — capture rainbow heptagon.
 *
 * Notes: Static after mount; SVG handles sit above the canvas and are not
 * captured. Triangulation is deterministic (earcut over the same 7 input
 * points), so the per-triangle color seams are part of the baseline.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'vertex-colors';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
