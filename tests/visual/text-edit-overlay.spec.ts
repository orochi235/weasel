/**
 * The text demo's editing overlay against the canvas it stands in for.
 *
 * jsdom resolves no transforms and paints nothing, so whether the DOM editor
 * lines up with the glyphs, and whether it stays inside the canvas, can only be
 * measured here. The demo passes no `view`: the overlay has to find the camera
 * on its own.
 *
 * Node `t6` from apps/site/demos/textDemoScene.ts: world box (30, 130) 540 wide,
 * fontSize 16. Every expectation is computed from the view the canvas reports,
 * so the exact zoom a wheel step lands on does not matter.
 */
import { test, expect, type Page } from '@playwright/test';

const NODE = { x: 30, y: 130, width: 540, fontSize: 16 };

async function open(page: Page) {
  await page.goto('/?test=1#text');
  await page.waitForFunction(() => window.__weaselTest);
  await page.evaluate(() => window.__weaselTest!.ready);
  // The MSDF atlas loads async.
  await page.waitForTimeout(500);
}

async function canvasRect(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector('.ckd-canvas')!.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
}

/** Pinch-zoom about a point inside the node, then double-click it to edit. */
async function zoomAndEdit(page: Page, wheelSteps: number) {
  const c = await canvasRect(page);
  const px = c.left + NODE.x + 10;
  const py = c.top + NODE.y + 10;
  await page.mouse.move(px, py);
  await page.keyboard.down('Control');
  for (let i = 0; i < wheelSteps; i++) {
    await page.mouse.wheel(0, -40);
    await page.waitForTimeout(30);
  }
  await page.keyboard.up('Control');
  await page.waitForTimeout(200);
  await page.mouse.dblclick(px, py);
  await page.waitForSelector('[contenteditable="true"]');
  // One overlay-follow frame.
  await page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

async function overlayVsCanvas(page: Page, node: typeof NODE) {
  return page.evaluate((node) => {
    const view = window.__weaselTest!.getView();
    const canvas = document.querySelector('.ckd-canvas')!.getBoundingClientRect();
    const el = document.querySelector<HTMLElement>('[contenteditable="true"]')!;
    const r = el.getBoundingClientRect();
    const layoutWidth = el.offsetWidth;
    return {
      scale: view.scale.x,
      overlay: {
        left: r.left,
        top: r.top,
        width: r.width,
        fontPx: parseFloat(getComputedStyle(el).fontSize) * (r.width / layoutWidth),
      },
      expected: {
        left: canvas.left + (node.x - view.x) * view.scale.x,
        top: canvas.top + (node.y - view.y) * view.scale.y,
        width: node.width * view.scale.x,
        fontPx: node.fontSize * view.scale.x,
      },
    };
  }, node);
}

function expectAligned(m: Awaited<ReturnType<typeof overlayVsCanvas>>) {
  // The overlay carries a 1px CSS-vs-canvas rasterization nudge.
  expect(Math.abs(m.overlay.left - m.expected.left)).toBeLessThanOrEqual(2);
  expect(Math.abs(m.overlay.top - m.expected.top)).toBeLessThanOrEqual(2);
  expect(m.overlay.width).toBeCloseTo(m.expected.width, 0);
  expect(m.overlay.fontPx).toBeCloseTo(m.expected.fontPx, 1);
}

test('text-edit overlay — matches the canvas at zoom 1', async ({ page }) => {
  await open(page);
  await zoomAndEdit(page, 0);
  const m = await overlayVsCanvas(page, NODE);
  expect(m.scale).toBe(1);
  expectAligned(m);
});

test('text-edit overlay — follows the canvas zoom with no view passed', async ({ page }) => {
  await open(page);
  await zoomAndEdit(page, 18);
  const m = await overlayVsCanvas(page, NODE);
  expect(m.scale).toBeGreaterThan(1.8);
  expectAligned(m);
});

test('text-edit overlay — clipped to the canvas, and typing past its edge scrolls nothing', async ({ page }) => {
  await open(page);
  const before = await canvasRect(page);
  await zoomAndEdit(page, 26);

  // Caret to the end of the line, which at this zoom is past the canvas edge.
  await page.keyboard.press('Meta+ArrowRight');
  await page.keyboard.type('xyz');
  await page.waitForTimeout(100);

  const s = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[contenteditable="true"]')!;
    const canvas = document.querySelector('.ckd-canvas')!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const scrolled: string[] = [];
    for (let e = el.parentElement; e; e = e.parentElement) {
      if (e.scrollLeft || e.scrollTop) scrolled.push(`${e.tagName}.${e.className}`);
    }
    const y = r.top + 10;
    const owns = (x: number) => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && (hit === el || el.contains(hit));
    };
    return {
      text: el.innerText,
      overlayRight: r.right,
      canvas: { left: canvas.left, top: canvas.top, right: canvas.right },
      scrolled,
      insideHits: owns(canvas.right - 20),
      outsideHits: owns(Math.min(r.right - 5, canvas.right + 200)),
    };
  });

  expect(s.text).toContain('xyz');
  // The run really does extend past the canvas, or the clip check means nothing.
  expect(s.overlayRight).toBeGreaterThan(s.canvas.right + 100);
  // The probe is live: inside the canvas the overlay is what the point hits.
  expect(s.insideHits).toBe(true);
  expect(s.outsideHits).toBe(false);
  // Nothing scrolled to chase the caret, so the canvas has not moved.
  expect(s.scrolled).toEqual([]);
  expect(s.canvas.left).toBe(before.left);
  expect(s.canvas.top).toBe(before.top);
});
