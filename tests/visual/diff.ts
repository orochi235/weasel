import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface DiffOptions {
  /** pixelmatch per-pixel color distance threshold 0–1. Default 0.1. */
  threshold?: number;
  /** Fraction of total pixels allowed to differ. Default 0.02 (2%). */
  maxDiffRatio?: number;
}

export interface CaptureOptions {
  /** Which <canvas> to read when a demo mounts several. Default 0 (the first). */
  nth?: number;
  /** Wait until at least this many canvases are mounted before reading. Default 1. */
  expectCanvases?: number;
  /** Extra settle time after the rAF ticks, for async resources. Default 150ms. */
  settleMs?: number;
}

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

/**
 * Read a canvas's backing store as a PNG buffer.
 *
 * Deliberately NOT `locator.screenshot()`. An element screenshot clips to the
 * element's *layout* box, so the captured height depends on whether the canvas
 * happens to sit at a fractional y offset — and that offset is the accumulated
 * height of the text above it, which differs between platforms with different
 * font metrics. That produced ±1px baseline drift between macOS and the CI
 * runner. It also silently resamples any canvas whose CSS box differs from its
 * backing store (the `gestures` demo draws 520×360 into a 522×362 box).
 *
 * Reading the backing store yields exactly `canvas.width × canvas.height`
 * pixels of what the renderer actually drew, independent of layout, fonts,
 * borders, scrollbars, viewport size, and the compositor. Every WebGL2 context
 * the kit creates sets `preserveDrawingBuffer: true` (see Canvas.tsx), so the
 * buffer is still readable after the frame is composited.
 *
 * Note this captures only canvas pixels — the CSS background painted behind a
 * transparent canvas is not included, by design: these baselines test the
 * renderer, not the demo page's styling.
 */
export async function readCanvasPixels(canvas: Locator): Promise<Buffer> {
  const dataUrl = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    if (!c.width || !c.height) {
      throw new Error(`Canvas has zero-sized backing store (${c.width}×${c.height})`);
    }
    return c.toDataURL('image/png');
  });
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new Error(`toDataURL() did not return a PNG (got "${dataUrl.slice(0, 32)}…")`);
  }
  return Buffer.from(dataUrl.slice(PNG_DATA_URL_PREFIX.length), 'base64');
}

/**
 * Navigate to `url`, wait for the canvas to stabilize, and return its pixels
 * as a PNG buffer.
 */
export async function captureCanvas(
  page: Page,
  url: string,
  opts: CaptureOptions = {},
): Promise<Buffer> {
  const { nth = 0, expectCanvases = 1, settleMs = 150 } = opts;
  await page.goto(url);
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => document.readyState === 'complete');
  if (expectCanvases > 1) {
    // Multi-canvas demos: don't read panel N before every panel has mounted.
    await page.waitForFunction(
      (n) => document.querySelectorAll('canvas').length >= n,
      expectCanvases,
    );
  }
  // Two rAF ticks: first clears any synchronous layout paint; second ensures
  // async effects (React state updates, font loads) have flushed.
  await page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  ));
  // Extra settle for demos with async resource loading (font atlas, images).
  await page.waitForTimeout(settleMs);
  return await readCanvasPixels(page.locator('canvas').nth(nth));
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
 * Where failed captures and diff images are written, for CI to upload as
 * artifacts. Gitignored; `test-results/` is also where Playwright puts traces.
 */
const FAILURE_DIR = resolve(process.cwd(), 'test-results', 'visual');

/**
 * Write evidence for a failing spec. Without this a failure reports only a
 * percentage, leaving no way to see what actually changed.
 */
function writeFailureArtifact(name: string, kind: 'actual' | 'diff', png: Buffer): void {
  mkdirSync(FAILURE_DIR, { recursive: true });
  writeFileSync(resolve(FAILURE_DIR, `${name}-${kind}.png`), png);
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
  const name = basename(baselinePath, '.png');

  // Dimensions must match exactly. Since we read the backing store, the capture
  // size is exactly the demo's canvas size — so a mismatch means the demo
  // genuinely resized, not that the environment drifted. Treat it as a baseline
  // invalidation rather than a pixel diff. No diff image is possible here, but
  // the capture itself is the evidence.
  if (actualPng.width !== baselinePng.width || actualPng.height !== baselinePng.height) {
    writeFailureArtifact(name, 'actual', actual);
  }
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
  if (diffRatio > maxDiffRatio) {
    writeFailureArtifact(name, 'actual', actual);
    writeFailureArtifact(name, 'diff', PNG.sync.write(diffPng));
  }
  expect(
    diffRatio,
    `Pixel diff ${(diffRatio * 100).toFixed(2)}% exceeds ${(maxDiffRatio * 100).toFixed(0)}% threshold`,
  ).toBeLessThanOrEqual(maxDiffRatio);
}
