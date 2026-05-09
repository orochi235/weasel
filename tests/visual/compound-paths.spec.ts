/**
 * Visual regression spec: compound-paths demo.
 *
 * Captures the canvas under backend='2d' (baseline) and backend='gl', then
 * asserts pixel diff ≤ 5%.
 *
 * Interaction sequence:
 *   1. Initial mount — capture static scene.
 *
 * Notes: Pre-placed compound path. evenodd stencil rasterization may differ near winding boundaries — tolerance 5%.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline, type DiffOptions } from './diff.js';

const DEMO_ID = 'compound-paths';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

// Per-demo tolerance: 5% — see file header for justification.
const OPTS: DiffOptions = { maxDiffRatio: 0.05 };

test(`${DEMO_ID} — 2d baseline capture`, async ({ page }) => {
  const png = await captureCanvas(page, `/?backend=2d#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`), OPTS);
});

test(`${DEMO_ID} — gl matches 2d baseline`, async ({ page }) => {
  const glPng = await captureCanvas(page, `/?backend=gl#${DEMO_ID}`);
  assertMatchesBaseline(glPng, resolve(BASELINE_DIR, `${DEMO_ID}-2d.png`), OPTS);
});
