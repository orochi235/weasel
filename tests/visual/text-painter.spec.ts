/**
 * The text demo's nodes, painted by the default node painter (`kit:text`).
 *
 * `text.spec.ts`'s baseline cannot guard the painter: MSDF edges differ per GL
 * driver, so it takes a 5% tolerance, and the demo's glyph ink is a few percent
 * of the canvas, so the painter drawing nothing would pass. These probes assert
 * what the painter owns in terms no driver difference can move.
 */
import { test, expect, type Page } from './fixture';
import { captureCanvas } from './diff.js';

// Node boxes from apps/site/demos/TextDemo.tsx, in canvas pixels (the view is
// identity at deviceScaleFactor 1).
const LARGE = { x0: 300, y0: 16, x1: 570, y1: 48 };
const ITALIC = { x0: 300, y0: 54, x1: 570, y1: 76 };
const CENTER = { x0: 300, y0: 84, x1: 570, y1: 114 };
// 'right' carries the runs, with the red word.
const RIGHT = { x0: 30, y0: 200, x1: 570, y1: 236 };
const RUNS = RIGHT;
const BOTTOM = { x0: 30, y0: 300, x1: 230, y1: 390 };
// 'rotated' is 230×34 at (300,330), turned -15° about its center (415,347).
const ROTATED = { x0: 290, y0: 300, x1: 540, y1: 398 };

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
  return page.evaluate(async ({ LARGE, ITALIC, RUNS, BOTTOM, ROTATED, CENTER, RIGHT }) => {
    const c = document.querySelector<HTMLCanvasElement>('canvas')!;
    const w = c.width;
    const h = c.height;
    const buf = await window.weaselCanvasPixels(c);
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
    // Scans the row band from `scanX0` to the canvas edge, not just the box, so
    // ink that alignment put outside the box is counted rather than clipped out.
    const span = (box: Box, scanX0 = 0): RowSpan => {
      let ink = 0;
      let outside = 0;
      let minX = w;
      let maxX = -1;
      for (let y = box.y0; y < box.y1; y++) {
        for (let x = scanX0; x < w; x++) {
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
      italic: stats(ITALIC),
      runs: stats(RUNS),
      red,
      bottomTop: stats({ ...BOTTOM, y1: midY }),
      bottomLower: stats({ ...BOTTOM, y0: midY }),
      rotatedLeft: stats({ ...ROTATED, x1: midX }),
      rotatedRight: stats({ ...ROTATED, x0: midX }),
      // 't1' shares these rows left of x 280.
      center: span(CENTER, 280),
      right: span(RIGHT),
    };
  }, { LARGE, ITALIC, RUNS, BOTTOM, ROTATED, CENTER, RIGHT });
}

test('text — kit:text paints each node where its data says', async ({ page }) => {
  await captureCanvas(page, '/#text', { settleMs: 500 });
  const s = await probe(page);

  expect(s.canvas).toEqual({ w: 600, h: 400 });

  for (const node of [s.large, s.italic, s.runs]) {
    expect(node.ink).toBeGreaterThan(50);
  }

  // `pose.y` is the top of the first line box, not a baseline: nothing above
  // the box, and ink starts in its upper half.
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

  // `align` resolves within the pose width, not about `pose.x`.
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
