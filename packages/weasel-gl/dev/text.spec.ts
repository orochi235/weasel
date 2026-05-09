import { test, expect } from '@playwright/test';

/**
 * Step 3 text smoke. Verifies kind:'text' renders non-empty pixels via
 * the MSDF shader. Convention §1: unit tests don't catch atlas/sampler bugs
 * — this smoke is the primary correctness check.
 *
 * NOT a pixel-baseline test (visual regression rig lands in step 9).
 */

test('text smoke — Inter glyphs paint non-empty pixels at all sizes', async ({ page }) => {
  await page.goto('/packages/weasel-gl/dev/text.html');
  await page.waitForFunction(
    () => document.querySelector('p')?.textContent === 'Inter loaded.',
    { timeout: 10_000 },
  );
  await page.waitForTimeout(200);

  const canvasIds = ['cHello', 'cSmall', 'cLarge', 'cZoom'];

  for (const id of canvasIds) {
    const painted = await page.evaluate((cid) => {
      const c = document.getElementById(cid) as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      // Grid sample (not diagonal — text only occupies a strip of the canvas).
      const grid = 16;
      let nonZero = 0;
      const px = new Uint8Array(4);
      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          const x = Math.floor((gx + 0.5) / grid * c.width);
          const y = Math.floor((gy + 0.5) / grid * c.height);
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          if (px[3] > 10) nonZero++;
        }
      }
      return nonZero;
    }, id);
    expect(painted, `canvas#${id} should have painted glyph pixels`).toBeGreaterThan(0);
  }
});
