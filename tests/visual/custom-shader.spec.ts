/**
 * Visual regression spec: custom-shader demo, one frame per panel.
 *
 * Determinism: `?frozenTime=0` swaps the RAF loop for a fixed `u_time = 0`.
 * Mouse defaults to (0.5, 0.5); ripples default to empty; voronoi seeds
 * derive from a fixed sequence — no other live state.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'custom-shader';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

const PANELS = [
  { name: 'plasma', index: 0 },
  { name: 'ripple', index: 1 },
  { name: 'voronoi', index: 2 },
];

for (const panel of PANELS) {
  test(`${DEMO_ID} — ${panel.name} panel`, async ({ page }) => {
    // 200ms settle covers the weasel-mark texture load (the Ripple panel stays
    // `disabled` until it resolves, leaving its canvas blank).
    const png = await captureCanvas(page, `/?frozenTime=0#${DEMO_ID}`, {
      nth: panel.index,
      expectCanvases: PANELS.length,
      settleMs: 200,
    });
    assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-${panel.name}.png`));
  });
}
