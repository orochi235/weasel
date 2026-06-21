/**
 * Visual regression spec: gestures demo.
 *
 * Captures the canvas and asserts pixel diff ≤ 2% vs the committed baseline.
 *
 * Interaction sequence:
 *   1. Initial mount — capture the empty surface (default 'drag' mode).
 *
 * The per-gesture overlays are drawn in response to live pointer drags; those
 * are exercised by the headless interaction check during development, not the
 * baseline (simulated pointer drags would add per-runner timing flakiness to a
 * pixel-exact snapshot). The baseline guards that the canvas mounts at the
 * expected size with the demo's static chrome.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'gestures';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

// No per-demo tolerance override; default (2%) applies.

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
