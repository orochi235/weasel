/**
 * Visual regression spec: text-nodes demo.
 *
 * The only spec that paints `data.text` nodes through the default node painter
 * (`kit:text` in `NodeShape.ts`). The `text` demo draws through
 * `createTextLayer`, and `text-outlines` / `render-to-pixels` build text
 * commands by hand, so none of them reach it.
 *
 * The baseline alone cannot guard the painter. MSDF edges differ per GL driver,
 * so it takes `text.spec.ts`'s 5% tolerance, and all of this demo's glyph ink is
 * about 2% of the canvas: measured, the painter drawing nothing diffs 2.09% and
 * every glyph moved down 4px diffs 2.80%. Both pass the baseline. The probes
 * below assert what the painter owns in terms no driver difference can move.
 */
import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline, type DiffOptions } from './diff.js';

const DEMO_ID = 'text-nodes';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

const OPTS: DiffOptions = { maxDiffRatio: 0.05 };

// Node boxes from apps/site/demos/TextNodesDemo.tsx, in canvas pixels (the view
// is identity at deviceScaleFactor 1).
const LARGE = { x0: 20, y0: 16, x1: 460, y1: 48 };
const BOLD = { x0: 20, y0: 58, x1: 460, y1: 80 };
const ITALIC = { x0: 20, y0: 86, x1: 460, y1: 108 };
const RUNS = { x0: 20, y0: 120, x1: 460, y1: 146 };
const BOTTOM = { x0: 20, y0: 160, x1: 220, y1: 280 };
// 'rotated' is 210×34 at (250,200), turned -15° about its center (355,217).
const ROTATED = { x0: 240, y0: 160, x1: 475, y1: 275 };
// 'center' and 'right' share one 440-wide box shape, one row apart.
const CENTER = { x0: 20, y0: 296, x1: 460, y1: 326 };
const RIGHT = { x0: 20, y0: 336, x1: 460, y1: 366 };

type Box = typeof LARGE;

interface InkStats {
  ink: number;
  firstRow: number;
  meanY: number;
}

interface RowSpan {
  /** Ink anywhere across the canvas width in the box's rows. */
  ink: number;
  /** Of that, ink left of `x0` or right of `x1`. */
  outside: number;
  minX: number;
  maxX: number;
}

async function probe(page: Page) {
  return page.evaluate(({ LARGE, BOLD, ITALIC, RUNS, BOTTOM, ROTATED, CENTER, RIGHT }) => {
    const c = document.querySelector<HTMLCanvasElement>('canvas')!;
    const gl = c.getContext('webgl2')!;
    const w = c.width;
    const h = c.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const px = (x: number, y: number) => {
      const i = ((h - 1 - y) * w + x) * 4;
      return [buf[i], buf[i + 1], buf[i + 2]];
    };
    // Darkness against the white ground. The pale box behind 'bottom' is ~18,
    // so 60 counts glyphs and not the box.
    const isInk = (x: number, y: number) => {
      const [r, g, b] = px(x, y);
      return 255 - (0.299 * r + 0.587 * g + 0.114 * b) >= 60;
    };
    const stats = (box: Box): InkStats => {
      let ink = 0;
      let firstRow = -1;
      let sumY = 0;
      for (let y = box.y0; y < box.y1; y++) {
        for (let x = box.x0; x < box.x1; x++) {
          if (!isInk(x, y)) continue;
          ink++;
          sumY += y;
          if (firstRow < 0) firstRow = y;
        }
      }
      return { ink, firstRow, meanY: ink ? sumY / ink : -1 };
    };
    // Scans the whole row band, not just the box, so ink that alignment put
    // outside the box is counted rather than clipped out of the probe.
    const span = (box: Box): RowSpan => {
      let ink = 0;
      let outside = 0;
      let minX = w;
      let maxX = -1;
      for (let y = box.y0; y < box.y1; y++) {
        for (let x = 0; x < w; x++) {
          if (!isInk(x, y)) continue;
          ink++;
          if (x < box.x0 || x >= box.x1) outside++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
      return { ink, outside, minX, maxX };
    };
    let red = 0;
    for (let y = RUNS.y0; y < RUNS.y1; y++) {
      for (let x = RUNS.x0; x < RUNS.x1; x++) {
        const [r, g, b] = px(x, y);
        if (r - g > 60 && r - b > 60) red++;
      }
    }
    const midY = (BOTTOM.y0 + BOTTOM.y1) / 2;
    const midX = (ROTATED.x0 + ROTATED.x1) / 2;
    return {
      canvas: { w, h },
      large: stats(LARGE),
      aboveLarge: stats({ x0: LARGE.x0, y0: 0, x1: LARGE.x1, y1: LARGE.y0 }),
      bold: stats(BOLD),
      italic: stats(ITALIC),
      runs: stats(RUNS),
      red,
      bottomTop: stats({ ...BOTTOM, y1: midY }),
      bottomLower: stats({ ...BOTTOM, y0: midY }),
      rotatedLeft: stats({ ...ROTATED, x1: midX }),
      rotatedRight: stats({ ...ROTATED, x0: midX }),
      center: span(CENTER),
      right: span(RIGHT),
    };
  }, { LARGE, BOLD, ITALIC, RUNS, BOTTOM, ROTATED, CENTER, RIGHT });
}

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  // The MSDF atlas loads async; the default settle can race it.
  const png = await captureCanvas(page, `/#${DEMO_ID}`, { settleMs: 500 });
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`), OPTS);
});

test(`${DEMO_ID} — kit:text paints each node where its data says`, async ({ page }) => {
  await captureCanvas(page, `/#${DEMO_ID}`, { settleMs: 500 });
  const s = await probe(page);

  expect(s.canvas).toEqual({ w: 480, h: 380 });

  for (const node of [s.large, s.bold, s.italic, s.runs]) {
    expect(node.ink).toBeGreaterThan(50);
  }

  // `pose.y` is the top of the first line box, not a baseline: nothing above
  // the box, and ink starts in its upper half. The old `p.y + fontSize` origin
  // put the first ink a full em lower.
  expect(s.aboveLarge.ink).toBe(0);
  expect(s.large.firstRow).toBeLessThan(LARGE.y0 + 12);

  // `runs` wins over `text`: only the runs carry the red word.
  expect(s.red).toBeGreaterThan(40);

  // `verticalAlign: 'bottom'` resolves within the pose height.
  expect(s.bottomTop.ink).toBe(0);
  expect(s.bottomLower.ink).toBeGreaterThan(50);

  // Rotated -15°: the left half of the line sits lower than the right.
  expect(s.rotatedLeft.ink).toBeGreaterThan(50);
  expect(s.rotatedRight.ink).toBeGreaterThan(50);
  expect(s.rotatedLeft.meanY - s.rotatedRight.meanY).toBeGreaterThan(8);

  // `align` resolves within the pose width, not about `pose.x`. Anchored on
  // `pose.x`, centered text straddles the box's left edge and right-aligned
  // text ends at it.
  expect(s.center.ink).toBeGreaterThan(50);
  expect(s.center.outside).toBe(0);
  const leftGap = s.center.minX - CENTER.x0;
  const rightGap = CENTER.x1 - 1 - s.center.maxX;
  expect(Math.abs(leftGap - rightGap)).toBeLessThan(6);

  expect(s.right.ink).toBeGreaterThan(50);
  expect(s.right.outside).toBe(0);
  expect(RIGHT.x1 - 1 - s.right.maxX).toBeLessThan(6);
  expect(s.right.minX).toBeGreaterThan(RIGHT.x0 + 100);
});
