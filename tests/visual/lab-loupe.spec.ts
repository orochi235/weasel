/**
 * That the lens actually magnifies, for both of labkit's painters.
 *
 * No committed baseline: the claims are structural, and structure is portable
 * where a PNG is not. jsdom can assert everything else about a loupe — aim,
 * factor, mode, the lens raised and put away — but not that the picture inside
 * it is bigger than the one outside, which is the whole point.
 */
import { expect, type Page, test } from '@playwright/test';

const DEMO_ID = 'lab-loupe';

// The demo is a lazy chunk pulling in labkit and its stylesheet, and this file
// sorts early enough to be the one that pays the dev server's cold compile —
// which on its own exceeds the 30s default.
test.describe.configure({ timeout: 90_000 });

/** `drawDetail` in the demo rules alternating single-world-pixel bars across
 *  world (80..160, 90..160); the view opens at pan (24, 24), zoom 1. */
const RULES = { x: 24 + 120, y: 24 + 125 };
/** A scanline across the middle of the patch, in stack CSS px. */
const SCAN = { x: 24 + 85, w: 70, y: 24 + 125 };

/** Share of neighbouring pixels along a scanline that are byte-identical. One
 *  world pixel wide, the bars alternate on almost every pair; magnified n×,
 *  each holds flat for n before stepping. */
async function flatness(page: Page, selector: string, scan = SCAN): Promise<number> {
  return page.evaluate(
    ({ selector, scan }) => {
      const c = document.querySelector<HTMLCanvasElement>(selector);
      if (!c) throw new Error(`no canvas for ${selector}`);
      const o = document.createElement('canvas');
      o.width = c.width;
      o.height = c.height;
      const ctx = o.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(c, 0, 0);
      const dpr = c.width / c.getBoundingClientRect().width;
      const { data } = ctx.getImageData(
        Math.round(scan.x * dpr),
        Math.round(scan.y * dpr),
        Math.round(scan.w * dpr),
        1,
      );
      const px: string[] = [];
      for (let i = 0; i < data.length; i += 4) px.push(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      let same = 0;
      for (let i = 1; i < px.length; i++) if (px[i] === px[i - 1]) same++;
      return same / (px.length - 1);
    },
    { selector, scan },
  );
}

async function openLab(page: Page): Promise<{ x: number; y: number }> {
  await page.goto(`/#${DEMO_ID}`);
  await page.waitForSelector('.lk-canvas-stack__canvas');
  await page.waitForTimeout(500);
  const box = await page.locator('.lk-canvas-stack').first().boundingBox();
  if (!box) throw new Error('no canvas stack');
  return box;
}

test(`${DEMO_ID} — the canvas lens magnifies what the stack drew`, async ({ page }) => {
  const box = await openLab(page);

  // The same bars, unmagnified, read off the stack's own canvas first: the lens
  // covers the whole patch once it is up.
  const before = await flatness(page, '.lk-canvas-stack__canvas');
  expect(before).toBeLessThan(0.35);

  await page.getByRole('button', { name: 'Loupe' }).first().click();
  await page.mouse.move(box.x + RULES.x, box.y + RULES.y);
  await page.waitForTimeout(400);

  // 6× holds five of every six pairs flat, whatever the rasterizer.
  const after = await flatness(page, '.lk-loupe__canvas', { x: 30, w: 140, y: 100 });
  expect(after).toBeGreaterThan(0.6);
  expect(after).toBeGreaterThan(before * 2);
});

test(`${DEMO_ID} — the wheel resizes the lens, not the trial`, async ({ page }) => {
  const box = await openLab(page);
  await page.getByRole('button', { name: 'Loupe' }).first().click();
  await page.mouse.move(box.x + RULES.x, box.y + RULES.y);
  await page.waitForTimeout(300);

  const zoomBefore = await page.locator('.lk-viewport-controls').first().innerText();
  const flatBefore = await flatness(page, '.lk-loupe__canvas', { x: 30, w: 140, y: 100 });

  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(400);

  // Wider bars: more neighbouring pairs hold flat.
  expect(await flatness(page, '.lk-loupe__canvas', { x: 30, w: 140, y: 100 })).toBeGreaterThan(
    flatBefore,
  );
  // And the stack's own zoom never saw the event.
  expect(await page.locator('.lk-viewport-controls').first().innerText()).toBe(zoomBefore);
});

test(`${DEMO_ID} — the lens takes no pointer events`, async ({ page }) => {
  const box = await openLab(page);
  await page.getByRole('button', { name: 'Loupe' }).first().click();
  await page.mouse.move(box.x + RULES.x, box.y + RULES.y);
  await page.waitForTimeout(300);

  const under = await page.evaluate(
    (p) => document.elementFromPoint(p.x, p.y)?.className ?? null,
    { x: box.x + RULES.x, y: box.y + RULES.y },
  );
  expect(under).not.toContain('lk-loupe');
});

test(`${DEMO_ID} — the DOM lens re-renders the instrument bigger`, async ({ page }) => {
  await openLab(page);

  await page.locator('.ckd-lab-frame select').first().selectOption({ label: 'Written detail' });
  const trial = page.locator('.lk-trial').filter({ hasText: 'Written detail' }).first();
  await trial.getByRole('button', { name: 'Loupe' }).click();
  const host = await trial.locator('.lk-trial__loupe-host').boundingBox();
  if (!host) throw new Error('no loupe host');

  const plain = await trial.locator('.lab-loupe-line').first().boundingBox();
  // Aim at the middle of the host rather than a fixed offset into it: the lab
  // lays the trial out in a column ~150px wide here, so `+200` landed outside
  // the host, no pointer ever entered it, and the lens never mounted.
  await page.mouse.move(host.x + host.width / 2, host.y + host.height / 2);
  await page.waitForTimeout(400);

  const magnified = await trial.locator('.lk-loupe .lab-loupe-line').first().boundingBox();
  if (!plain || !magnified) throw new Error('no line to measure');
  // Laid out once and scaled by the camera the lens handed over: the default
  // factor is 6, and the trial opens at zoom 1.
  expect(magnified.height / plain.height).toBeCloseTo(6, 1);
});
