/**
 * Annotation capture, end to end in a real browser. No committed baseline:
 * neither GL nor the browser's SVG rasterizer is byte-identical across
 * drivers, so this probes pixels and reads coordinates back out of the
 * exported document instead.
 *
 * The first test is also the repo's only viewport calibration for a *drawn*
 * mark. `insert.spec.ts` and `shape-tools.spec.ts` both defer a scripted-drag
 * insertion, and the annotation overlay's client→world path — a pane whose
 * input box is nowhere near the shared surface's origin — had no coverage at
 * all before this.
 */
import { expect, test } from '@playwright/test';

/** The demo's pane and its content box, which are deliberately the same size,
 *  so the pane sits at zoom 1 and a client delta is a world delta. */
const CONTENT = { w: 240, h: 160 };

const ready = async (page: import('@playwright/test').Page) => {
  await page.goto('/#annotation-capture');
  await page.getByTestId('capture-base').waitFor();
  await page.waitForTimeout(600);
};

/** Draw with a palette tool over the pane, in fractions of the content box. */
async function draw(
  page: import('@playwright/test').Page,
  tool: string,
  from: [number, number],
  to: [number, number],
): Promise<{ x: number; y: number }> {
  await page.getByRole('button', { name: tool }).click();
  const box = await page.locator('[data-annotation-target="pane"]').boundingBox();
  if (!box) throw new Error('the annotation overlay has no box');
  await page.mouse.move(box.x + from[0] * box.width, box.y + from[1] * box.height);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0] * box.width, box.y + to[1] * box.height, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  return { x: box.x, y: box.y };
}

/** The exported document, as text. */
async function captureSvg(page: import('@playwright/test').Page): Promise<string> {
  await page.getByTestId('capture-svg').click();
  const img = page.getByTestId('capture-result');
  await img.waitFor();
  return page.evaluate(async (src) => (await fetch(src)).text(), await img.getAttribute('src'));
}

test('a drawn mark lands where the pointer put it', async ({ page }) => {
  await ready(page);
  // The top-left quadrant, inset so the mark cannot be confused with the
  // quadrant boundary at the pane's midpoint.
  await draw(page, 'Rectangle', [0.125, 0.1875], [0.375, 0.5625]);

  const svg = await captureSvg(page);
  // The marks nest in their own <svg>; read the path out of it rather than
  // scanning the whole document, which also holds the base's geometry.
  const d = /<path d="([^"]+)"/.exec(svg.slice(svg.lastIndexOf('<svg')))?.[1];
  expect(d, `no mark path in ${svg.slice(-300)}`).toBeTruthy();
  const [x, y, w, h] = [...(d ?? '').matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

  // Content-box units: 0.125 x 240 = 30, 0.1875 x 160 = 30, 60 x 60 across.
  // A client-to-world path that failed to subtract the pane's offset within
  // the shared surface would put these in the hundreds.
  expect(x).toBeCloseTo(30, 0);
  expect(y).toBeCloseTo(30, 0);
  expect(w).toBeCloseTo(60, 0);
  expect(Math.abs(h ?? 0)).toBeCloseTo(60, 0);
});

test('a capture at scale 4 puts the mark on the feature it was drawn over', async ({ page }) => {
  await ready(page);
  await draw(page, 'Rectangle', [0.125, 0.1875], [0.375, 0.5625]);

  await page.getByTestId('capture-png').click();
  const img = page.getByTestId('capture-result');
  await img.waitFor();

  expect(await img.getAttribute('data-width')).toBe(String(CONTENT.w * 4));
  expect(await img.getAttribute('data-height')).toBe(String(CONTENT.h * 4));

  const probe = await page.evaluate(async (src) => {
    const bitmap = await createImageBitmap(await (await fetch(src)).blob());
    const c = document.createElement('canvas');
    c.width = bitmap.width;
    c.height = bitmap.height;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0);
    const at = (fx: number, fy: number) =>
      Array.from(
        ctx.getImageData(Math.round(fx * bitmap.width), Math.round(fy * bitmap.height), 1, 1).data,
      );
    return {
      size: [bitmap.width, bitmap.height],
      // The mark's own left edge, drawn at x = 0.125 of the content box.
      onEdge: at(0.125, 0.375),
      // Inside the mark, which is a stroke and not a fill: still the base.
      inside: at(0.25, 0.375),
      // The far quadrant, which no mark went near.
      farQuadrant: at(0.75, 0.75),
      centre: at(0.5, 0.5),
    };
  }, await img.getAttribute('src'));

  expect(probe.size).toEqual([CONTENT.w * 4, CONTENT.h * 4]);
  // The mark colour is `#e5484d`. Asserting closeness to it, not merely
  // "reddish": the demo's quadrants are deliberately nowhere near it, and a
  // loose predicate is one a bare base would satisfy with no mark drawn.
  const near = (got: number[], want: [number, number, number]) =>
    want.every((v, i) => Math.abs((got[i] ?? -999) - v) <= 45);
  expect(near(probe.onEdge, [229, 72, 77]), `mark edge was rgb(${probe.onEdge.slice(0, 3)})`).toBe(
    true,
  );
  // Inside the box, which is a stroke and not a fill: the base shows through,
  // and it is not the mark colour. Without this an export that flooded the
  // whole frame red would pass the assertion above.
  expect(near(probe.inside, [229, 72, 77])).toBe(false);
  expect(probe.inside[3]).toBe(255);
  expect(near(probe.farQuadrant, [229, 72, 77])).toBe(false);
  expect(probe.farQuadrant[3]).toBe(255);
  // The base's black centre dot is still black, so the base was not rescaled.
  expect(probe.centre.slice(0, 3).every((v) => v < 40)).toBe(true);
});

test('the exported document carries the base and the mark together', async ({ page }) => {
  await ready(page);
  await draw(page, 'Rectangle', [0.125, 0.1875], [0.375, 0.5625]);
  const svg = await captureSvg(page);
  // The base's own centre dot, and the mark's stroke.
  expect(svg).toContain('<circle');
  expect(svg.toLowerCase()).toContain('#e5484d');
  // Two nested documents inside the outer one: the base and the marks.
  expect((svg.match(/<svg/g) ?? []).length).toBe(3);
});

test("the toolbar's Export downloads a file named for its target", async ({ page }) => {
  await ready(page);
  await draw(page, 'Rectangle', [0.125, 0.1875], [0.375, 0.5625]);

  await page.getByRole('button', { name: 'Export' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();
  expect((await download).suggestedFilename()).toBe('pane.png');
});
