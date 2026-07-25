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
  await expect(readout).toHaveText(/960×240 px/);

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
