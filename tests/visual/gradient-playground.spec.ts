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
 * element directly). The dual-test shape (2d + gl) is preserved for
 * consistency with the rest of the suite even though `?backend=` is now a
 * no-op.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'gradient-playground';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — 2d baseline capture`, async ({ page }) => {
  const png = await captureCanvas(page, `/?backend=2d#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`));
});

test(`${DEMO_ID} — gl matches 2d baseline`, async ({ page }) => {
  const glPng = await captureCanvas(page, `/?backend=gl#${DEMO_ID}`);
  assertMatchesBaseline(glPng, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`));
});
