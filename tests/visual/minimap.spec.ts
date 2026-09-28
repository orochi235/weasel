/**
 * Linked cursors across the minimap demo's three views.
 *
 * No committed baseline; the claim is structural — hovering one view changes
 * pixels in each of the others (the crosshair appears there), and leaves them
 * as they were once the pointer goes. `MINIMAP_SHOTS=<dir>` also writes each
 * state as a PNG.
 *
 * The demo's scene is random and the detached minimap fits it, so where a
 * hover there lands on the main canvas moves with the scene — sometimes off
 * the region read, or off the canvas. `seedRandom` pins the scene.
 */
import { test, expect, type Page } from '@playwright/test';

const DEMO_ID = 'minimap';
/** From `apps/site/demos/MinimapDemo.tsx`: the main canvas is 600×400 with
 *  the inset at x ∈ [432, 592), y ∈ [8, 120); the detached one is 200×140. */
const INSET = { x: 432, y: 8, w: 160, h: 112 };
/** The main canvas below the inset. */
const MAIN_ONLY = { x: 0, y: 124, w: 600, h: 276 };

type Rect = { x: number; y: number; w: number; h: number };

/** RGBA bytes of `rect` (CSS px) on the `index`th canvas. */
async function read(page: Page, index: number, rect: Rect | null): Promise<number[]> {
  return page.evaluate(({ index, rect }) => {
    const c = document.querySelectorAll('canvas')[index] as HTMLCanvasElement;
    const o = document.createElement('canvas');
    o.width = c.width; o.height = c.height;
    const ctx = o.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(c, 0, 0);
    const dpr = c.width / c.getBoundingClientRect().width;
    const r = rect ?? { x: 0, y: 0, w: c.width / dpr, h: c.height / dpr };
    return Array.from(ctx.getImageData(
      Math.round(r.x * dpr), Math.round(r.y * dpr), Math.round(r.w * dpr), Math.round(r.h * dpr),
    ).data);
  }, { index, rect });
}

const changed = (a: number[], b: number[]) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
  }
  return n;
};

async function hoverCanvas(page: Page, index: number, x: number, y: number) {
  const box = (await page.locator('canvas').nth(index).boundingBox())!;
  await page.mouse.move(box.x + x, box.y + y, { steps: 4 });
}

/** Replaces `Math.random` with a fixed-seed PRNG (mulberry32) before any page script runs. */
async function seedRandom(page: Page, seed: number) {
  await page.addInitScript((seed) => {
    let a = seed >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
}

/** Reads `rect` until two consecutive reads agree, so a baseline is not taken mid-paint. */
async function settled(page: Page, index: number, rect: Rect | null): Promise<number[]> {
  let prev = await read(page, index, rect);
  await expect.poll(async () => {
    const next = await read(page, index, rect);
    const n = changed(prev, next);
    prev = next;
    return n;
  }).toBe(0);
  return prev;
}

/** Pixels of `rect` differing from `base`, as a poll to assert on. */
function changedFrom(page: Page, index: number, rect: Rect | null, base: number[]) {
  return expect.poll(async () => changed(base, await read(page, index, rect)));
}

async function shoot(page: Page, name: string) {
  const dir = process.env.MINIMAP_SHOTS;
  if (dir) await page.locator('[class*="demo"]').first().screenshot({ path: `${dir}/${name}.png` });
}

test(`${DEMO_ID} — the crosshair follows the pointer into every other view`, async ({ page }) => {
  await seedRandom(page, 1);
  await page.goto(`/#${DEMO_ID}`);
  await page.waitForSelector('canvas');
  expect(await page.locator('canvas').count()).toBe(2);

  await page.mouse.move(2, 2);
  const idle = {
    inset: await settled(page, 0, INSET),
    main: await settled(page, 0, MAIN_ONLY),
    detached: await settled(page, 1, null),
  };
  await shoot(page, '0-idle');

  // Over the main canvas: the crosshair appears in both minimaps.
  await hoverCanvas(page, 0, 200, 250);
  await changedFrom(page, 0, INSET, idle.inset).toBeGreaterThan(0);
  await changedFrom(page, 1, null, idle.detached).toBeGreaterThan(0);
  await shoot(page, '1-over-main');

  // Over the detached minimap: it appears on the main canvas and in the inset.
  await hoverCanvas(page, 1, 100, 70);
  await changedFrom(page, 0, MAIN_ONLY, idle.main).toBeGreaterThan(0);
  await changedFrom(page, 0, INSET, idle.inset).toBeGreaterThan(0);
  await shoot(page, '2-over-detached');

  // Over the inset: on the main canvas and the detached minimap.
  await hoverCanvas(page, 0, INSET.x + INSET.w / 2, INSET.y + INSET.h / 2);
  await changedFrom(page, 0, MAIN_ONLY, idle.main).toBeGreaterThan(0);
  await changedFrom(page, 1, null, idle.detached).toBeGreaterThan(0);
  await shoot(page, '3-over-inset');

  // Gone once the pointer leaves every view.
  await page.mouse.move(2, 2);
  await changedFrom(page, 0, INSET, idle.inset).toBe(0);
  await changedFrom(page, 1, null, idle.detached).toBe(0);
});

test(`${DEMO_ID} — pressing the inset recenters the main view on that point`, async ({ page }) => {
  await page.goto(`/#${DEMO_ID}`);
  await page.waitForSelector('canvas');
  await page.waitForTimeout(600);
  const label = page.locator('[class*="viewLabel"]');
  const before = await label.textContent();
  const box = (await page.locator('canvas').nth(0).boundingBox())!;
  await page.mouse.click(box.x + INSET.x + 20, box.y + INSET.y + 20);
  await page.waitForTimeout(150);
  await shoot(page, '4-after-press');
  expect(await label.textContent()).not.toBe(before);
});
