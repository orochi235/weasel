import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface DiffOptions {
  /** pixelmatch per-pixel color distance threshold 0–1. Default 0.1. */
  threshold?: number;
  /** Fraction of total pixels allowed to differ. Default 0.02 (2%). */
  maxDiffRatio?: number;
}

/**
 * Navigate to `url`, wait for the canvas to stabilize, capture a screenshot
 * of the first <canvas> element, and return the PNG buffer.
 */
export async function captureCanvas(page: Page, url: string): Promise<Buffer> {
  await page.goto(url);
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => document.readyState === 'complete');
  // Two rAF ticks: first clears any synchronous layout paint; second ensures
  // async effects (React state updates, font loads) have flushed.
  await page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  ));
  // Extra settle for demos with async resource loading (font atlas, images).
  await page.waitForTimeout(150);
  const canvas = page.locator('canvas').first();
  return await canvas.screenshot();
}

/**
 * After a user interaction, wait for the canvas to repaint before capturing.
 * Call this after each simulated event in a spec's interaction sequence.
 */
export async function waitForRepaint(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  ));
}

/**
 * Assert that `actual` (PNG buffer) matches `baselinePath` within tolerance.
 *
 * If UPDATE_SNAPSHOTS env var is set (set automatically by test:visual:update),
 * writes `actual` as the new baseline instead of asserting.
 *
 * @param actual      PNG buffer from captureCanvas()
 * @param baselinePath  Absolute path to the committed baseline PNG
 * @param opts        Tolerance overrides (document per-demo justification in spec)
 */
export function assertMatchesBaseline(
  actual: Buffer,
  baselinePath: string,
  opts: DiffOptions = {},
): void {
  const threshold = opts.threshold ?? 0.1;
  const maxDiffRatio = opts.maxDiffRatio ?? 0.02;

  const isUpdate = process.env.UPDATE_SNAPSHOTS === '1';

  if (isUpdate || !existsSync(baselinePath)) {
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, actual);
    return; // No assertion on update; CI never sets UPDATE_SNAPSHOTS.
  }

  const baselinePng = PNG.sync.read(readFileSync(baselinePath));
  const actualPng = PNG.sync.read(actual);

  // Dimensions must match exactly. A mismatch means the viewport changed or
  // the canvas size changed — treat as a baseline invalidation, not a pixel diff.
  expect(actualPng.width, 'Canvas width changed vs baseline').toBe(baselinePng.width);
  expect(actualPng.height, 'Canvas height changed vs baseline').toBe(baselinePng.height);

  const { width, height } = baselinePng;
  const diffPng = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(
    baselinePng.data,
    actualPng.data,
    diffPng.data,
    width,
    height,
    { threshold },
  );

  const diffRatio = mismatchedPixels / (width * height);
  expect(
    diffRatio,
    `Pixel diff ${(diffRatio * 100).toFixed(2)}% exceeds ${(maxDiffRatio * 100).toFixed(0)}% threshold`,
  ).toBeLessThanOrEqual(maxDiffRatio);
}
