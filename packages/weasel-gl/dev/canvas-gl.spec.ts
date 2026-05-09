import { test, expect, type Page } from '@playwright/test';

const PAGE = '/packages/weasel-gl/dev/canvas-gl.html';

async function getCanvas(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const c = document.querySelector('#root canvas') as HTMLCanvasElement;
    if (!c) throw new Error('no canvas mounted');
    return { width: c.width, height: c.height };
  });
}

async function readPixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.evaluate(({ x, y }: { x: number; y: number }) => {
    const c = document.querySelector('#root canvas') as HTMLCanvasElement;
    const gl = c.getContext('webgl2') as WebGL2RenderingContext;
    const buf = new Uint8Array(4);
    gl.readPixels(x, c.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return Array.from(buf);
  }, { x, y });
}

test('canvas-gl smoke — canvas mounts under #root', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(300);
  const dims = await getCanvas(page);
  expect(dims.width).toBeGreaterThan(0);
  expect(dims.height).toBeGreaterThan(0);
});

test('canvas-gl smoke — red rect renders inside its bounds', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(300);
  // World rect (100,100,80,80); under DPR=1 view identity, screen pixel is the
  // same. Account for DPR via canvas.width / 512 cssWidth ratio.
  const ratio = await page.evaluate(() => {
    const c = document.querySelector('#root canvas') as HTMLCanvasElement;
    return c.width / 512;
  });
  const px = Math.round(140 * ratio);
  const py = Math.round(140 * ratio);
  const pixel = await readPixel(page, px, py);
  expect(pixel[0]).toBeGreaterThan(150);
  expect(pixel[1]).toBeLessThan(80);
  expect(pixel[2]).toBeLessThan(80);
  expect(pixel[3]).toBeGreaterThan(200);
});

test('canvas-gl smoke — outside-bounds pixel is transparent', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(300);
  const ratio = await page.evaluate(() => {
    const c = document.querySelector('#root canvas') as HTMLCanvasElement;
    return c.width / 512;
  });
  const px = Math.round(500 * ratio);
  const py = Math.round(500 * ratio);
  const pixel = await readPixel(page, px, py);
  expect(pixel[3]).toBeLessThan(50);
});

test('canvas-gl smoke — 16×16 grid scan: at least 30 painted samples', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(300);
  const painted = await page.evaluate(() => {
    const c = document.querySelector('#root canvas') as HTMLCanvasElement;
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
