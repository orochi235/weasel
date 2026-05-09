/**
 * Visual regression spec: animation demo.
 *
 * Captures the canvas under backend='2d' (baseline) and backend='gl', then
 * asserts pixel diff ≤ 2%.
 *
 * Interaction sequence:
 *   1. Initial mount — capture static scene.
 *
 * Notes: Tween animations may not be deterministic at capture time; capture initial mount as the stable baseline. (Plan optionally suggests clicking "Add card"; deferred — initial mount captures a deterministic pre-populated scene.)
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'animation';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

// No per-demo tolerance override; default (2%) applies.

test(`${DEMO_ID} — 2d baseline capture`, async ({ page }) => {
  const png = await captureCanvas(page, `/?backend=2d#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`));
});

test(`${DEMO_ID} — gl matches 2d baseline`, async ({ page }) => {
  const glPng = await captureCanvas(page, `/?backend=gl#${DEMO_ID}`);
  assertMatchesBaseline(glPng, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`));
});
