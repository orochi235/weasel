import { test, expect } from '@playwright/test';

/** Step 4 paint smoke. Linear / radial / conic gradients + image command. */
test('paint smoke — gradients and image render non-empty pixels', async ({ page }) => {
  await page.goto('/packages/weasel-gl/dev/paint.html');
  await page.waitForFunction(
    () => document.getElementById('status')?.textContent === 'Paint smoke ready.',
    { timeout: 10_000 },
  );
  await page.waitForTimeout(200);

  const ids = ['cLinear', 'cRadial', 'cConic', 'cImage'];
  for (const id of ids) {
    const painted = await page.evaluate((cid) => {
      const c = document.getElementById(cid) as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
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
    expect(painted, `canvas#${id} should paint pixels`).toBeGreaterThan(0);
  }
});
