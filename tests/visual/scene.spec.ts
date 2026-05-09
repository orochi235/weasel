/**
 * Visual regression spec: scene demo.
 *
 * Captures the canvas under backend='2d' (baseline) and backend='gl', then
 * asserts pixel diff ≤ 2%.
 *
 * Interaction sequence:
 *   1. Initial mount — capture static scene.
 *
 * If this demo has interactive controls that affect the canvas (e.g. buttons,
 * drag handles), add steps 2+ following the pattern below.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'scene';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

// No per-demo tolerance override for this spec; 2d/gl pixel diff is expected
// to be well under 2% for solid-fill geometry.

test(`${DEMO_ID} — 2d baseline capture`, async ({ page }) => {
  const png = await captureCanvas(page, `/?backend=2d#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`));
});

test(`${DEMO_ID} — gl matches 2d baseline`, async ({ page }) => {
  const glPng = await captureCanvas(page, `/?backend=gl#${DEMO_ID}`);
  // Diff GL output against the committed 2D baseline.
  assertMatchesBaseline(glPng, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`));
});
