/**
 * Visual regression spec: pattern-playground demo.
 *
 * Four rects, one per built-in tile, each filled through the `pattern`
 * FillStyle variant. This is the gate on tiling itself: before the
 * patternFill program landed, the same demo rendered two flat colors, one
 * invisible rect, and one showing the backdrop, because the path fill mesh
 * has no `a_uv` for the image shader to read.
 *
 * Interaction sequence:
 *   1. Initial mount — capture the four tiles.
 *
 * Notes: static after mount.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'pattern-playground';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
