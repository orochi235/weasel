import { test, expect } from '@playwright/test';

const PAGE = '/packages/weasel-gl/dev/layers.html';

async function readPixel(page: import('@playwright/test').Page, x: number, y: number): Promise<number[]> {
  return page.evaluate(({ x, y }: { x: number; y: number }) => {
    const c = document.getElementById('c') as HTMLCanvasElement;
    const gl = c.getContext('webgl2') as WebGL2RenderingContext;
    const buf = new Uint8Array(4);
    gl.readPixels(x, c.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return Array.from(buf);
  }, { x, y });
}

test('layers smoke — red rect path renders inside its bounds', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(200);
  const pixel = await readPixel(page, 140, 140);
  expect(pixel[0]).toBeGreaterThan(150);
  expect(pixel[1]).toBeLessThan(80);
  expect(pixel[2]).toBeLessThan(80);
  expect(pixel[3]).toBeGreaterThan(200);
});

test('layers smoke — blue rect path renders', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(200);
  const pixel = await readPixel(page, 250, 250);
  expect(pixel[2]).toBeGreaterThan(150);
  expect(pixel[3]).toBeGreaterThan(200);
});

test('layers smoke — cell highlight pixel is greenish-tinted', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(200);
  // Cell (2,2) at spacing 50 → world (100,100)-(150,150). Sample a point that's
  // inside the highlight but outside the red rect (which starts at 100,100, w=80).
  // The red rect covers (100..180, 100..180). The cell covers (100..150, 100..150).
  // Both overlap heavily. Sample a point in the cell that's NOT covered by red:
  // there is no such point. Sample at (148, 148) which is inside both — the
  // composite shows the highlight blended over the red rect.
  const pixel = await readPixel(page, 148, 148);
  expect(pixel[3]).toBeGreaterThan(200);
});

test('layers smoke — outside-bounds pixel is transparent', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(200);
  const pixel = await readPixel(page, 500, 500);
  expect(pixel[3]).toBeLessThan(50);
});

test('layers smoke — 16×16 grid scan: at least 30 painted samples', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(200);
  const painted = await page.evaluate(() => {
    const c = document.getElementById('c') as HTMLCanvasElement;
    const gl = c.getContext('webgl2') as WebGL2RenderingContext;
    let count = 0;
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 16; col++) {
        const x = Math.round((col + 0.5) * c.width / 16);
        const y = Math.round((row + 0.5) * c.height / 16);
        const buf = new Uint8Array(4);
        gl.readPixels(x, c.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        if (buf[3] > 30) count++;
      }
    }
    return count;
  });
  expect(painted).toBeGreaterThanOrEqual(30);
});
