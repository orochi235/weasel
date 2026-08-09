/**
 * Pixel mode must magnify with NEAREST, not LINEAR.
 *
 * No committed baseline: the claim is structural, and structure is portable
 * where a PNG is not. The demo's ruling patch is alternating single-pixel
 * rules, so magnifying a readback of it 8× at NEAREST holds each source
 * color flat for eight pixels before stepping; LINEAR ramps between them and
 * almost every neighbouring pair differs. The share of neighbouring pairs
 * that are byte-identical separates the two and depends on no rasterizer.
 *
 * Counting *distinct* colors does not: the ramp repeats with the pattern, so
 * LINEAR yields as few of them as NEAREST does.
 */
import { test, expect, type Page } from '@playwright/test';

const DEMO_ID = 'loupe';

/** The loupe's default bounds are `{ x: 24, y: 24, w: 220, h: 200 }` in CSS px
 *  and its frame insets are `{ titleH: 24, edge: 6 }`, so its content rect is
 *  `{ x: 30, y: 48, w: 208, h: 170 }`. Sample a scanline well inside that. */
const SCAN = { x: 40, w: 188, y: 130 };

/** Share of neighbouring pixels along the scanline that are identical. */
async function flatnessAcrossLoupe(page: Page): Promise<number> {
  return page.evaluate((scan) => {
    const c = document.querySelector('canvas')!;
    const o = document.createElement('canvas');
    o.width = c.width; o.height = c.height;
    const ctx = o.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(c, 0, 0);
    const dpr = c.width / c.getBoundingClientRect().width;
    const { data } = ctx.getImageData(
      Math.round(scan.x * dpr), Math.round(scan.y * dpr), Math.round(scan.w * dpr), 1,
    );
    const px: string[] = [];
    for (let i = 0; i < data.length; i += 4) px.push(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    let same = 0;
    for (let i = 1; i < px.length; i++) if (px[i] === px[i - 1]) same++;
    return same / (px.length - 1);
  }, SCAN);
}

test(`${DEMO_ID} — pixel mode magnifies with hard edges`, async ({ page }) => {
  await page.goto(`/#${DEMO_ID}`);
  await page.waitForSelector('canvas');
  await page.waitForTimeout(500);

  // Aim into the middle of the demo's ruling patch (`RULING` in
  // `apps/site/demos/LoupeDemo.tsx`), which is clear of the window — the
  // loupe freezes its aim while the pointer is over itself.
  const box = (await page.locator('canvas').first().boundingBox())!;
  await page.mouse.move(box.x + 430, box.y + 310);
  await page.getByLabel('pixel').check();
  await page.mouse.move(box.x + 431, box.y + 311);
  await page.waitForTimeout(600);   // readback → createImageBitmap → redraw

  // 8× NEAREST holds ~7 of every 8 pairs flat; LINEAR holds almost none.
  expect(await flatnessAcrossLoupe(page)).toBeGreaterThan(0.6);
});
