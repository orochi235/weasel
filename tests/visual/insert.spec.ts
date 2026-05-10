/**
 * Visual regression spec: insert demo.
 *
 * Captures the canvas and asserts pixel diff ≤ 2% vs the committed baseline.
 *
 * Interaction sequence:
 *   1. Initial mount — capture static scene.
 *
 * Notes: Canvas starts empty; initial mount = empty canvas is a valid (background-color) baseline. A scripted-drag insertion is deferred to a follow-up iteration of this spec.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'insert';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

// No per-demo tolerance override; default (2%) applies.

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
