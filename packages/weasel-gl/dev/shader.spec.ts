import { test, expect } from '@playwright/test';

const PAGE = '/packages/weasel-gl/dev/shader.html';
const BOUNDS = { x: 106, y: 106, w: 300, h: 300 };

test('shader smoke — Voronoi renders non-trivial pixels inside bounds', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(200);

  const centerX = BOUNDS.x + BOUNDS.w / 2;
  const centerY = BOUNDS.y + BOUNDS.h / 2;

  const pixel = await page.evaluate(({ x, y }: { x: number; y: number }) => {
    const c = document.getElementById('c') as HTMLCanvasElement;
    const gl = c.getContext('webgl2') as WebGL2RenderingContext;
    const buf = new Uint8Array(4);
    const glY = c.height - y - 1;
    gl.readPixels(x, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return Array.from(buf);
  }, { x: centerX, y: centerY });

  expect(pixel[3]).toBeGreaterThan(200);
  const maxChannel = Math.max(pixel[0], pixel[1], pixel[2]);
  expect(maxChannel).toBeGreaterThan(30);
});

test('shader smoke — pixels outside bounds are not overwritten', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(200);

  const pixel = await page.evaluate(() => {
    const c = document.getElementById('c') as HTMLCanvasElement;
    const gl = c.getContext('webgl2') as WebGL2RenderingContext;
    const buf = new Uint8Array(4);
    gl.readPixels(10, c.height - 10 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return Array.from(buf);
  });

  expect(pixel[3]).toBeLessThan(50);
});

test('shader smoke — 4×4 grid samples all opaque inside bounds', async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForTimeout(200);

  const results = await page.evaluate(({ bounds, grid }: { bounds: typeof BOUNDS; grid: number }) => {
    const c = document.getElementById('c') as HTMLCanvasElement;
    const gl = c.getContext('webgl2') as WebGL2RenderingContext;
    const pixels: number[][] = [];
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const x = Math.round(bounds.x + (col + 0.5) * bounds.w / grid);
        const y = Math.round(bounds.y + (row + 0.5) * bounds.h / grid);
        const buf = new Uint8Array(4);
        gl.readPixels(x, c.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        pixels.push(Array.from(buf));
      }
    }
    return pixels;
  }, { bounds: BOUNDS, grid: 4 });

  for (const [, , , a] of results) {
    expect(a).toBeGreaterThan(200);
  }
});
