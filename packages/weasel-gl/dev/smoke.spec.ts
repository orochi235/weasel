import { test, expect } from '@playwright/test';

test('step 1 smoke — red and green rects render', async ({ page }) => {
  await page.goto('/packages/weasel-gl/dev/smoke.html');
  // Wait for canvas to exist and the renderer to flush.
  await page.waitForSelector('canvas');
  await page.waitForTimeout(200);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // Sample a pixel inside the red square (50,50)–(150,150) → center (100, 100).
  const redPixel = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const px = new Uint8Array(4);
    // GL framebuffer Y is bottom-up; canvas height is 600 (CSS) × dpr.
    // Sample at GL coord y = drawingBufferHeight - 100*dpr.
    const dpr = window.devicePixelRatio || 1;
    gl.readPixels(100 * dpr, c.height - 100 * dpr, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Array.from(px);
  });
  expect(redPixel[0]).toBeGreaterThan(200);             // red high
  expect(redPixel[1]).toBeLessThan(40);                 // green low
  expect(redPixel[2]).toBeLessThan(40);                 // blue low

  // Sample inside the green rect at (200..300, 50..150) → center (250, 100).
  const greenPixel = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const px = new Uint8Array(4);
    const dpr = window.devicePixelRatio || 1;
    gl.readPixels(250 * dpr, c.height - 100 * dpr, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Array.from(px);
  });
  // Green at 50% alpha over a transparent (clear-color black) background.
  expect(greenPixel[1]).toBeGreaterThan(60);
  expect(greenPixel[0]).toBeLessThan(40);
});
