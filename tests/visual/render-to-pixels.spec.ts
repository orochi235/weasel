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
