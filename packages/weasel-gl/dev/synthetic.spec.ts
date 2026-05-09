import { test, expect } from '@playwright/test';

/**
 * Step 1 exit verification — synthetic scene smoke. NOT a baseline; just
 * confirms each canvas paints non-empty pixels. Visual regression rig
 * lands in step 9.
 */
test('step 1 synthetic — every scene paints non-empty pixels', async ({ page }) => {
  await page.goto('/packages/weasel-gl/dev/synthetic.html');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(300);

  const canvasIds = ['c10', 'c100', 'c1000', 'cEvenodd', 'cCaps', 'cJoins', 'cDash', 'cAlign'];
  for (const id of canvasIds) {
    const nonEmpty = await page.evaluate((cid) => {
      const c = document.getElementById(cid) as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      // Sample a 16-pixel grid across the canvas; any non-zero alpha → paint occurred.
      const w = c.width;
      const h = c.height;
      let painted = 0;
      const samples = 16;
      const px = new Uint8Array(4);
      for (let i = 0; i < samples; i++) {
        const x = Math.floor((i / samples) * w);
        const y = Math.floor((i / samples) * h);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        if (px[3] > 0 || px[0] > 0 || px[1] > 0 || px[2] > 0) painted++;
      }
      return painted;
    }, id);
    expect(nonEmpty, `canvas#${id} should have at least one painted sample`).toBeGreaterThan(0);
  }
});
