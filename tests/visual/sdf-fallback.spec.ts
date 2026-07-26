/**
 * Dynamic canvas-SDF fonts, real GL: node 'e' in RenderToPixelsDemo renders
 * 'Dynamic SDF 123' in a canvas-registered family ('Arial') that has no
 * baked MSDF atlas. Asserts (a) the headless renderSceneToPixels output
 * contains glyph ink for the dynamic family (inline bake, no async gap) and
 * (b) headless determinism still holds with dynamic glyphs in play.
 * No committed baseline — installed-font rasterization varies by machine.
 */
import { test, expect } from '@playwright/test';

test('canvas-sourced SDF text renders ink in headless output', async ({ page }) => {
  await page.goto('/#render-to-pixels');
  const readout = page.getByTestId('rtp-readout');
  // 'identical: yes' doubles as the determinism assertion: two consecutive
  // renderSceneToPixels calls byte-match even with dynamic bakes involved.
  await expect(readout).toHaveText(/identical: yes/, { timeout: 15_000 });

  const ink = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="rtp-output"]')!;
    const ctx = c.getContext('2d')!;
    // Node 'e' text band: scene y 4..36 → output rows (scale.y = 1); sample
    // a wide box through the glyphs. scale.x = 2 → scene x 10 ≈ output x 20.
    const { data } = ctx.getImageData(20, 8, 400, 24);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total += 255 - data[i];
    return total / (data.length / 4);
  });
  // Background-only would be ~0; a text line through the band pulls the
  // average well up. Threshold is loose on purpose (any installed face).
  expect(ink).toBeGreaterThan(5);
});
