/**
 * Visual regression spec: stroke markers demo.
 *
 * The inset is invisible to a geometry test and obvious in a render — a filled
 * head whose line spikes through the tip passes every unit test in the suite.
 *
 * Interaction sequence:
 *   1. Initial mount — capture the static vocabulary board.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'stroke-markers';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
