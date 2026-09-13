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

/**
 * Node 'bottom' from apps/site/demos/TextNodesDemo.tsx: box (20, 160) 200×120
 * in canvas pixels, two 18px lines bottom-aligned, painted by `kit:text` with
 * no declared `wrap`. The typed words have no descenders, so the two lines'
 * ink stays in separate row bands.
 */
const BOTTOM = { x0: 20, y0: 160, x1: 220, y1: 280 };

/** Row bands of glyph ink inside `box`, read off the canvas's framebuffer,
 *  and how many ink pixels there are in all. */
async function canvasInk(page: Page, box: typeof BOTTOM) {
  return page.evaluate((box) => {
    const c = document.querySelector<HTMLCanvasElement>('.ckd-canvas')!;
    const gl = c.getContext('webgl2')!;
    const w = c.width;
    const h = c.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let bands = 0;
    let pixels = 0;
    let inBand = false;
    for (let y = box.y0; y < box.y1; y++) {
      let row = 0;
      for (let x = box.x0; x < box.x1; x++) {
        const i = ((h - 1 - y) * w + x) * 4;
        if (255 - (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) >= 60) row++;
      }
      if (row > 0 && !inBand) bands++;
      inBand = row > 0;
      pixels += row;
    }
    return { bands, pixels };
  }, box);
}

/** Lines the overlay's text occupies: its client rects, grouped by line. */
async function overlayLines(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[contenteditable="true"]')!;
    const range = document.createRange();
    range.selectNodeContents(el);
    const linePx = parseFloat(getComputedStyle(el).lineHeight);
    const tops = [...range.getClientRects()]
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => r.top)
      .sort((a, b) => a - b);
    let lines = 0;
    let last = -Infinity;
    for (const top of tops) {
      if (top - last > linePx / 2) lines++;
      last = top;
    }
    return lines;
  });
}

async function frames(page: Page) {
  await page.evaluate(() => new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

test('text-edit overlay — an unwrapped line longer than its box keeps the lines the canvas drew', async ({ page }) => {
  await page.goto('/#text-nodes');
  await page.waitForSelector('.ckd-canvas');
  // The MSDF atlas loads async.
  await page.waitForTimeout(500);
  const c = await canvasRect(page);

  // Past the end of the first line, 'Bottom of'; lengthen it well past the box.
  await page.mouse.dblclick(c.left + 150, c.top + 247);
  await page.waitForSelector('[contenteditable="true"]');
  await page.keyboard.type(' and then some more words');
  await frames(page);
  const typing = await overlayLines(page);
  await page.keyboard.press('Enter');
  await page.waitForSelector('[contenteditable="true"]', { state: 'detached' });
  await frames(page);
  await page.waitForTimeout(100);
  const drawn = (await canvasInk(page, BOTTOM)).bands;
  // The strip between the box's right edge and the rotated node beside it.
  const pastBox = await canvasInk(page, { ...BOTTOM, x0: BOTTOM.x1 + 2, x1: BOTTOM.x1 + 18 });

  // Open an edit on the committed text, from its second line.
  await page.mouse.dblclick(c.left + 40, c.top + 269);
  await page.waitForSelector('[contenteditable="true"]');
  await frames(page);
  const reopened = await overlayLines(page);

  // The canvas drew the line past its box, or the count means nothing.
  expect(pastBox.pixels).toBeGreaterThan(20);
  expect(drawn).toBe(2);
  expect(typing).toBe(drawn);
  expect(reopened).toBe(drawn);
});
