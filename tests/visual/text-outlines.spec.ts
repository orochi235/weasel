/**
 * The outline text tier, in real GL.
 *
 * No committed baseline, and deliberately so. The comparison this demo exists
 * to make has the canvas-SDF tier on one side of it, and that tier rasterizes
 * through `fillText` — platform text rendering, which differs by OS, by
 * version, and by whether a machine has subpixel positioning on. A committed
 * PNG would encode one machine's rasterizer.
 *
 * What is portable is the *structure* of the claim, and it happens to be the
 * two things worth pinning anyway:
 *
 *   1. The tier engages — flipping it changes pixels. A wiring regression
 *      that quietly left every glyph on the SDF tier would still produce a
 *      perfectly good-looking canvas, and a tolerance-based baseline would
 *      pass it.
 *   2. The tier is metric-neutral — flipping it does *not* move anything.
 *      That invariant is what lets the threshold depend on zoom: cross it
 *      while reading and text must not reflow. It is also the assertion most
 *      likely to catch a real mistake, since an em-space placement bug lands
 *      as a shifted or mis-scaled glyph rather than as an ugly one.
 */
import { test, expect, type Page } from '@playwright/test';

/** Ink bounding box and coverage of the demo canvas backing store. */
async function inkStats(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    const o = document.createElement('canvas');
    o.width = c.width; o.height = c.height;
    const ctx = o.getContext('2d')!;
    ctx.drawImage(c, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, ink = 0;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        // Well inside the glyph, not on its antialiased edge: the two tiers
        // resolve edges differently by construction, and a threshold near the
        // edge would measure that rather than where the glyph sits.
        if (data[(y * c.width + x) * 4] < 64) {
          ink++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { minX, minY, maxX, maxY, ink, width: c.width, height: c.height };
  });
}

async function setZoom(page: Page, zoom: number): Promise<void> {
  await page.evaluate((z) => {
    const el = document.querySelector<HTMLInputElement>('input[data-testid="outline-zoom"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(z));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, zoom);
  await page.waitForTimeout(500);
}

test('the outline tier engages, and does not move the text it replaces', async ({ page }) => {
  await page.goto('/#text-outlines');
  // The face has to be parsed before anything can render from outlines.
  await expect(page.getByTestId('outline-status')).toContainText('ready', { timeout: 15_000 });
  await setZoom(page, 4);

  const withOutlines = await inkStats(page);
  expect(withOutlines.ink).toBeGreaterThan(1000);

  await page.getByTestId('outline-toggle').uncheck();
  await page.waitForTimeout(600);
  const withSdf = await inkStats(page);
  expect(withSdf.ink).toBeGreaterThan(1000);

  // 1. Something actually changed. Coverage is the cheapest signal that
  //    survives a platform rasterizer difference — a distance field
  //    reconstructed from a 48px bake and magnified 4× does not lay down the
  //    same number of interior pixels as exact geometry.
  const coverageDelta = Math.abs(withOutlines.ink - withSdf.ink) / withSdf.ink;
  expect(coverageDelta).toBeGreaterThan(0.001);

  // 2. And nothing moved — to within one bake texel.
  //
  //    The tolerance is not slop, it is the resolution of the thing being
  //    compared against. The dynamic tier's glyph rects come out of a 48px
  //    raster and are stored as integers (`yoffset = base - raster.top` in
  //    `dynamicAtlas.ts`), so its *ink edge* is quantized to that grid and
  //    then scaled up with everything else: the 96px line drawn at 4× is 8
  //    device pixels per bake texel. The outline tier has no such grid, so a
  //    disagreement of one texel is the SDF tier's rounding, not a placement
  //    error — and metric neutrality is a claim about pen positions and line
  //    boxes, which `layoutRuns.test.ts` pins exactly and to the float.
  //
  //    What survives here is the class of bug that misses by glyph heights:
  //    a wrong scale, a missing baseline, an em-space sign flip. None of
  //    those fit inside a texel.
  const scale = withOutlines.width / 600;          // device px per CSS px
  const bakeTexel = (96 / 48) * 4 * scale;          // 96px line, 48px bake, 4× zoom
  const slack = Math.ceil(bakeTexel) + 2;
  expect(Math.abs(withOutlines.minX - withSdf.minX)).toBeLessThanOrEqual(slack);
  expect(Math.abs(withOutlines.minY - withSdf.minY)).toBeLessThanOrEqual(slack);
  expect(Math.abs(withOutlines.maxX - withSdf.maxX)).toBeLessThanOrEqual(slack);
  expect(Math.abs(withOutlines.maxY - withSdf.maxY)).toBeLessThanOrEqual(slack);
});

test('zoom pulls small text across the threshold without moving it', async ({ page }) => {
  await page.goto('/#text-outlines');
  await expect(page.getByTestId('outline-status')).toContainText('ready', { timeout: 15_000 });

  // At 1× only the 96px line is past the 48px threshold; at 4× every line is.
  // The rule is on-screen size, so the *same* document renders through
  // different tiers at different zooms — and still has to lay out identically.
  await setZoom(page, 1);
  const near = await inkStats(page);
  expect(near.ink).toBeGreaterThan(500);

  await page.getByTestId('outline-toggle').uncheck();
  await page.waitForTimeout(600);
  const nearSdf = await inkStats(page);

  // Same bake-texel rule as above, and at 1× a texel is only 2px — so this
  // is a much tighter bound on the same claim, bought by not magnifying.
  const slack = Math.ceil((96 / 48) * (near.width / 600)) + 1;
  expect(Math.abs(near.minY - nearSdf.minY)).toBeLessThanOrEqual(slack);
  expect(Math.abs(near.maxY - nearSdf.maxY)).toBeLessThanOrEqual(slack);
});
