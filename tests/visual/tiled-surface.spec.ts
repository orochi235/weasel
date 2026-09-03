/**
 * Real-GL guard for `WeaselRenderer.setTarget()`. No committed baseline: GL
 * rasterization is not byte-identical across drivers, so this asserts
 * containment invariants by probing pixels instead of diffing an image.
 *
 * The claim is that each pane's frame clear stops at its own rect. Two panes
 * paint into one buffer with two different background colours; if either
 * clear escaped its scissor, one background would cover both panes and the
 * gutters around them would stop being transparent.
 */
import { test, expect } from '@playwright/test';

/** Reads the shared surface back through a 2D canvas so pixels can be probed.
 *  The GL canvas is created with `preserveDrawingBuffer: true`, so drawing it
 *  into a 2D context after the frame lands is well-defined. */
const probe = (points: Record<string, [number, number]>) => `
  (() => {
    const src = document.querySelector('[data-testid="tiled-surface"]');
    const off = document.createElement('canvas');
    off.width = src.width; off.height = src.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const dpr = src.width / parseFloat(src.style.width);
    const at = (x, y) => Array.from(
      ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data
    );
    const pts = ${JSON.stringify(points)};
    const out = {};
    for (const k of Object.keys(pts)) out[k] = at(pts[k][0], pts[k][1]);
    return out;
  })()
`;

const near = (got: number[], want: [number, number, number], tol = 3) => {
  for (let i = 0; i < 3; i++) expect(Math.abs(got[i] - want[i])).toBeLessThanOrEqual(tol);
};

const ready = async (page: import('@playwright/test').Page) => {
  await page.goto('/#tiled-surface');
  await page.waitForSelector('[data-testid="tiled-surface"]');
  await page.waitForTimeout(800);
};

test('tiled-surface — each pane clears only its own rect', async ({ page }) => {
  await ready(page);

  // Pane A is #e8f0fb at CSS (20,20)-(400,380); pane B is #fdf3d8 at
  // (420,20)-(800,380). The gutter between them is never painted by either.
  // Pane B's probe is up in its top-left corner: its own rectangle, at 2x,
  // covers (580,160)-(780,320) and would otherwise be what got sampled.
  const px = await page.evaluate(probe({
    paneA: [300, 100],
    paneB: [450, 60],
    gutter: [410, 200],
    aboveA: [200, 8],
    farRight: [812, 200],
  }));

  near(px.paneA, [0xe8, 0xf0, 0xfb]);
  near(px.paneB, [0xfd, 0xf3, 0xd8]);

  // Two different backgrounds surviving in the same buffer is the containment
  // claim: whichever pane painted second did not clear the first.
  expect(px.paneA.slice(0, 3)).not.toEqual(px.paneB.slice(0, 3));

  // Nothing outside either rect was touched at all.
  expect(px.gutter[3]).toBe(0);
  expect(px.aboveA[3]).toBe(0);
  expect(px.farRight[3]).toBe(0);
});

test('tiled-surface — a pane clips its content at its own edge', async ({ page }) => {
  await ready(page);

  // Weak on purpose, and kept for the one thing it does catch: this passes with
  // EITHER the viewport or the scissor broken, because each clips drawing on
  // its own. Only losing both fails it. The containment claim with teeth is the
  // first test — a clear ignores the viewport, so only the scissor holds it in.
  //
  // Pane B's 'mark' node sits at world (180,150) with its camera at 2x panned
  // (-40,-30) — pane-local (440,360), past the pane's 380x360 box.
  const px = await page.evaluate(probe({
    beyondB: [806, 340],
    insideBEdge: [795, 340],
  }));

  expect(px.beyondB[3]).toBe(0);
  near(px.insideBEdge, [0xfd, 0xf3, 0xd8]);
});

test('tiled-surface — an even-odd hole stays a hole', async ({ page }) => {
  await ready(page);

  // The 'ring' node is filled even-odd, so it goes through
  // `drawPathFillStencil` and uses stencil bit 0. Pane A pose (40,180) 100x100
  // at 1x, pane origin (20,20) — the ring spans CSS (60,200)-(160,300) and its
  // hole, inset by a quarter of the short side, spans (85,225)-(135,275).
  const px = await page.evaluate(probe({
    hole: [110, 250],
    body: [65, 250],
  }));

  // The hole shows the pane's own background through it.
  near(px.hole, [0xe8, 0xf0, 0xfb]);
  // …and the body is the ring's fill, so the probe is not just missing the shape.
  near(px.body, [0x6b, 0x4c, 0x9a]);
});
