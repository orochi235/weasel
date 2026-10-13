/**
 * Visual regression spec: shape-tools demo. Picks three tools from the palette
 * in turn and drags each across its own third of the canvas.
 */
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, readCanvasPixels, dragOnCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'shape-tools';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

const DRAGS = [
  { tool: 'Ellipse', from: [40, 120], to: [180, 280] },
  { tool: 'Polygon', from: [230, 120], to: [370, 280] },
  { tool: 'Star', from: [420, 120], to: [560, 280] },
] as const;

test(`${DEMO_ID} — ellipse, polygon, and star drags each insert their shape`, async ({ page }) => {
  let last = await captureCanvas(page, `/#${DEMO_ID}`);
  const canvas = page.locator('canvas').first();
  const palette = page.getByRole('toolbar', { name: 'Tools' });
  for (const { tool, from, to } of DRAGS) {
    await palette.getByRole('button', { name: tool }).click();
    await dragOnCanvas(page, canvas, [from, to]);
    const png = await readCanvasPixels(canvas);
    // An updated baseline is written unchecked, so say here that each drag drew.
    expect(png.equals(last), `the ${tool} drag should change the canvas`).toBe(false);
    last = png;
  }
  assertMatchesBaseline(last, resolve(BASELINE_DIR, `${DEMO_ID}-three-shapes.png`));
});
