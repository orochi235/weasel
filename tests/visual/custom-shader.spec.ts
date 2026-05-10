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
 * Why a custom flow instead of captureCanvas: the helper grabs only the
 * first <canvas>; this demo has three. We loop the three panels manually.
 */
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const DEMO_ID = 'custom-shader';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

const PANELS = [
  { name: 'plasma', index: 0 },
  { name: 'ripple', index: 1 },
  { name: 'voronoi', index: 2 },
];

for (const panel of PANELS) {
  test(`${DEMO_ID} — ${panel.name} panel`, async ({ page }) => {
    await page.goto(`/?frozenTime=0#${DEMO_ID}`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => document.readyState === 'complete');
    // Wait until all three canvases are mounted before snapshotting any one.
    await page.waitForFunction(() => document.querySelectorAll('canvas').length >= 3);
    // Two rAF ticks for layout/effect flush + 200ms for the weasel-mark
    // texture (Ripple panel is `disabled` until it loads, leaving canvas blank).
    await page.evaluate(() => new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    ));
    await page.waitForTimeout(200);
    const canvas = page.locator('canvas').nth(panel.index);
    const png = await canvas.screenshot();
    assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}-${panel.name}.png`));
  });
}

function assertMatchesBaseline(actual: Buffer, baselinePath: string): void {
  const isUpdate = process.env.UPDATE_SNAPSHOTS === '1';
  if (isUpdate || !existsSync(baselinePath)) {
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, actual);
    return;
  }
  const baselinePng = PNG.sync.read(readFileSync(baselinePath));
  const actualPng = PNG.sync.read(actual);
  expect(actualPng.width, 'Canvas width changed vs baseline').toBe(baselinePng.width);
  expect(actualPng.height, 'Canvas height changed vs baseline').toBe(baselinePng.height);
  const { width, height } = baselinePng;
  const diffPng = new PNG({ width, height });
  const mismatchedPixels = pixelmatch(
    baselinePng.data, actualPng.data, diffPng.data, width, height, { threshold: 0.1 },
  );
  const diffRatio = mismatchedPixels / (width * height);
  expect(
    diffRatio,
    `Pixel diff ${(diffRatio * 100).toFixed(2)}% exceeds 2% threshold`,
  ).toBeLessThanOrEqual(0.02);
}
