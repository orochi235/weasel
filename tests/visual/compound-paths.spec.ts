/**
 * Visual regression spec: compound-paths demo.
 *
 * Captures the canvas and asserts pixel diff ≤ 5% vs the committed baseline.
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

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`), OPTS);
});
