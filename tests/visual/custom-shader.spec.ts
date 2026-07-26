/**
 * Visual regression spec: custom-shader demo.
 *
 * Captures one frame per panel (Plasma / Ripple / Voronoi) and asserts pixel
 * diff ≤ 2% vs the committed baselines.
 *
 * Determinism: `?frozenTime=0` swaps the RAF loop for a fixed `u_time = 0`
 * (see CustomShaderDemo.tsx readFrozenTime). All three panels render the
 * same frame on every run. Mouse defaults to (0.5, 0.5); ripples default to
 * empty; voronoi seeds derive from a fixed sequence — no other live state.
 *
 * This demo mounts three canvases, so each panel is captured by index via
 * captureCanvas's `nth` option.
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
