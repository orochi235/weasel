/**
 * Real-GL assertions for `renderSceneToPixels` — same-context only.
 * Deliberately NO committed baseline: GL rasterization is not byte-identical
 * across drivers, so this spec asserts in-page invariants (dims, readback
 * orientation via known layout, background color, same-context determinism)
 * instead of golden images.
 */
import { test, expect } from '@playwright/test';

test('render-to-pixels — dims, background, and same-context determinism', async ({ page }) => {
  await page.goto('/#render-to-pixels');
  const readout = page.getByTestId('rtp-readout');
  await expect(readout).toHaveText(/identical: yes/, { timeout: 15_000 });
  await expect(readout).toHaveText(/960×340 px/);

  // Pixel probes on the blitted 2D canvas (top-down proof + background + fill).
  const probe = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="rtp-output"]')!;
    const ctx = c.getContext('2d')!;
    const px = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    return {
      corner: px(2, 2),        // background (white)
      insideA: px(200, 120),   // node 'a' interior: scene (100,120) → output (200,120), fill #7fb069
    };
  });
  expect(probe.corner).toEqual([255, 255, 255, 255]);
  const [r, g, b, a] = probe.insideA;
  expect(Math.abs(r - 0x7f)).toBeLessThanOrEqual(2);
  expect(Math.abs(g - 0xb0)).toBeLessThanOrEqual(2);
  expect(Math.abs(b - 0x69)).toBeLessThanOrEqual(2);
  expect(a).toBe(255);
});

test('render-to-pixels — pose rotation and per-node alpha reach the headless raster', async ({ page }) => {
  await page.goto('/#render-to-pixels');
  const readout = page.getByTestId('rtp-readout');
  await expect(readout).toHaveText(/identical: yes/, { timeout: 15_000 });

  // Output scale is {x:2, y:1}, source origin (0,0) — so output px is
  // (sceneX × 2, sceneY).
  //
  // Node 'spun': a 60×60 square at scene (40,260) with rotation π/4. Upright
  // it covers x 40..100, y 260..320; rotated it is a diamond about (70,290)
  // with a half-diagonal of ~42.4. The two probes below sit on opposite
  // sides of that difference, so together they can only both pass when the
  // rotation is applied.
  //
  // Node 'dimmed': a black rect at alpha 0.25 over white → ~191 grey.
  const probe = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="rtp-output"]')!;
    const ctx = c.getContext('2d')!;
    const px = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    return {
      squareOnly: px(88, 264),   // scene (44,264): inside the upright square, outside the diamond
      diamondOnly: px(140, 252), // scene (70,252): above the upright square, inside the diamond
      dimmed: px(560, 290),      // scene (280,290): interior of the dimmed rect
    };
  });

  expect(probe.squareOnly).toEqual([255, 255, 255, 255]);
  const [dr, dg, db] = probe.diamondOnly;
  expect(Math.abs(dr - 0xb0)).toBeLessThanOrEqual(2);
  expect(Math.abs(dg - 0x4a)).toBeLessThanOrEqual(2);
  expect(Math.abs(db - 0x7f)).toBeLessThanOrEqual(2);

  // Black at alpha 0.25 over white: 255 × 0.75 ≈ 191. Full opacity would be 0.
  for (const channel of probe.dimmed.slice(0, 3)) {
    expect(Math.abs(channel - 191)).toBeLessThanOrEqual(4);
  }
  expect(probe.dimmed[3]).toBe(255);
});

test('render-to-pixels — verticalAlign: bottom pushes text to the lower part of its box', async ({ page }) => {
  await page.goto('/#render-to-pixels');
  const readout = page.getByTestId('rtp-readout');
  await expect(readout).toHaveText(/identical: yes/, { timeout: 15_000 });

  // Node 'd': scene box (x:10, y:202, width:460, height:36), verticalAlign
  // 'bottom', rendered via a demo-local `drawOne` that forwards
  // TextDrawCommand's height/verticalAlign directly (see
  // RenderToPixelsDemo.tsx). Output scale is {x:2, y:1}, so box-local scene
  // y offsets map 1:1 to output rows; box top → output y 202, box bottom →
  // output y 238.
  const darkness = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="rtp-output"]')!;
    const ctx = c.getContext('2d')!;
    // Average how far each sampled pixel's luminance falls below white
    // (0 = pure background, 255 = solid ink) across a wide horizontal
    // sample of the box, at a given box-local scene y.
    const rowInk = (sceneY: number) => {
      const y = sceneY; // scale.y === 1
      const { data } = ctx.getImageData(20, y, 900, 1); // x in output px, covers box width×scale.x
      let total = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        total += 255 - data[i]; // red channel vs. white background
        n++;
      }
      return total / n;
    };
    return {
      top: rowInk(206),    // just below the box top — should be empty (legacy top-align would land text here)
      bottom: rowInk(232), // near the box bottom — should contain glyph ink
    };
  });

  expect(darkness.top).toBeLessThan(2); // background only, no glyph ink
  expect(darkness.bottom).toBeGreaterThan(20); // dense glyph row pulls the average well below white
});
