/**
 * Visual regression spec: gradient-playground demo.
 *
 * Captures the canvas at the demo's default state (linear-gradient variant,
 * 3-stop teal→magenta→gold seed) and asserts pixel diff ≤ 2%.
 *
 * Interaction sequence:
 *   1. Initial mount — capture default linear gradient.
 *
 * Notes: Static after mount; the SVG handle overlay sits above the canvas
 * and is not part of the screenshot (`captureCanvas` screenshots the canvas
 * element directly).
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'gradient-playground';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
