/**
 * Real-GL assertion for text antialiasing. Deliberately NO committed baseline:
 * this measures a *property* of glyph edges rather than their exact pixels, so
 * it survives the driver-to-driver rasterization differences that force
 * `text.spec.ts` up to a 5% tolerance — and that tolerance is precisely why a
 * golden image cannot catch this class of defect. A whole node's worth of text
 * turning hard-edged stays under 5% of a 600×360 canvas.
 *
 * What it measures: at 16px, a correctly antialiased glyph spends *more*
 * pixels on partially-covered edges than on fully-covered interior. Stems are
 * one to two pixels wide, so edges dominate. If the shader's smoothstep band
 * collapses below a pixel, coverage quantizes to all-or-nothing and that ratio
 * inverts.
 *
 * Measured on this scene (see the constants below for why the sample box is
 * where it is):
 *   fwidth()-derived band (correct)        partial/solid = 1.54
 *   constant 0.05 band (the 2026-07 bug)   partial/solid = 0.34
 * The 1.0 gate sits between them with room on both sides.
 */
import { test, expect } from '@playwright/test';

// Node `t1` from apps/site/demos/textDemoScene.ts: x 30, y 30, 240×80, a
// single solid fill (#1c1c1c) at fontSize 16. Restricting the sample to one
// node of one known color is what lets the thresholds below be absolute — the
// demo's other nodes are blue, gray, and magenta, and their mid-luminance ink
// would land in the "partial" bucket on coverage grounds alone.
const BOX = { x0: 30, y0: 30, x1: 270, y1: 110 };

// #1c1c1c on white is ink 227 of 255. A pixel at full coverage sits at ~227,
// background at ~0; the gap between 20 and 200 can only be partial coverage.
const BG_MAX = 20;
const SOLID_MIN = 200;

test('text AA — glyph edges carry a partial-coverage ramp', async ({ page }) => {
  await page.goto('/#text');
  await page.waitForSelector('canvas');
  // The MSDF atlas loads async; wait for ink to actually appear in the box
  // rather than racing the first frame.
  await expect
    .poll(async () => page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas')!;
      return c.width > 0 ? 1 : 0;
    }), { timeout: 15_000 })
    .toBe(1);
  await page.waitForTimeout(500);

  const stats = await page.evaluate(({ BOX, BG_MAX, SOLID_MIN }) => {
    const c = document.querySelector<HTMLCanvasElement>('canvas')!;
    const gl = c.getContext('webgl2')!;
    const w = c.width;
    const h = c.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    // readPixels is bottom-up; this takes top-down scene coords. The canvas is
    // 600×360 at deviceScaleFactor 1, so scene units map 1:1 to pixels.
    const inkAt = (x: number, y: number) => {
      const i = ((h - 1 - y) * w + x) * 4;
      return 255 - (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]);
    };
    let solid = 0;
    let partial = 0;
    for (let y = BOX.y0; y < BOX.y1; y++) {
      for (let x = BOX.x0; x < BOX.x1; x++) {
        const v = inkAt(x, y);
        if (v < BG_MAX) continue;
        if (v >= SOLID_MIN) solid++;
        else partial++;
      }
    }
    return { solid, partial, canvasW: w, canvasH: h };
  }, { BOX, BG_MAX, SOLID_MIN });

  // Guard the guard: if the sample box missed the text entirely, the ratio
  // below would be meaningless (or divide into nothing).
  expect(stats.canvasW).toBe(600);
  expect(stats.canvasH).toBe(360);
  expect(stats.solid).toBeGreaterThan(200);

  const ratio = stats.partial / stats.solid;
  expect(ratio).toBeGreaterThan(1.0);
  // Loose upper bound: a band far wider than a pixel smears every glyph into
  // partial coverage. Not a tight fit — just the other cliff.
  expect(ratio).toBeLessThan(5.0);
});
