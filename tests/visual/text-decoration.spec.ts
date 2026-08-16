/**
 * Real-GL assertion for underline / strikethrough geometry. Like
 * `text-aa.spec.ts`, deliberately NO committed baseline — the golden-image
 * suite cannot catch this class of defect. `text.spec.ts` runs at a 5% diff
 * tolerance (MSDF AA differs from Canvas 2D AA), and the whole decorated `t6`
 * node is well under 5% of a 600×360 canvas, so it was added and passed
 * against the *old* baseline without anyone noticing.
 *
 * What it measures, instead of pixels: a decoration rule is a **gap-free
 * horizontal run** of ink tens of pixels wide. A row of glyphs never is —
 * stems and crossbars are a few pixels each, separated by gaps. So the rows
 * carrying a long unbroken run *are* the rules, and their positions and
 * extents can be asserted without knowing what the glyphs look like.
 *
 * Pinned here:
 * - exactly two rule bands exist (underline + strikethrough), not one or three
 * - their vertical separation is `0.40 em` — the gap between the `0.10` and
 *   `-0.30` em constants in `layoutRuns`. Asserting the separation rather than
 *   two absolute offsets keeps this independent of where the baseline lands,
 *   which is the ascender question `docs/TODO.md` tracks separately.
 * - each rule spans only its own run, not the whole line. `t6` puts
 *   `underline` on the first word and `strikethrough` on a later one, so a
 *   rule that leaked across spans would show up as one starting at the wrong x.
 */
import { test, expect } from '@playwright/test';

// Node `t6` from apps/site/demos/textDemoScene.ts: x 30, y 130, 540×60,
// fontSize 16, one solid fill (#1c1c1c). Runs: 'Underline' (underline),
// ', ', 'strikethrough' (strikethrough), ', and ', 'tracking', '.'.
const BOX = { x0: 30, y0: 130, x1: 570, y1: 190 };
const FONT_SIZE = 16;

// #1c1c1c on white is ink 227 of 255. Count a pixel as ink at half coverage —
// a 0.05 em rule is under a pixel thick, so it lands antialiased across two
// rows and neither is full strength.
const INK_MIN = 60;

// A rule under 'Underline' at 16px is ~65px wide; the widest glyph feature in
// this string is a crossbar of a few px. 30 sits far from both.
const RULE_MIN_RUN = 30;

test('text decoration — rules are gap-free runs at the em offsets layoutRuns declares', async ({ page }) => {
  await page.goto('/#text');
  await page.waitForSelector('canvas');
  await expect
    .poll(async () => page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas')!;
      return c.width > 0 ? 1 : 0;
    }), { timeout: 15_000 })
    .toBe(1);
  // The MSDF atlas loads async; the first frame can be empty.
  await page.waitForTimeout(500);

  const rows = await page.evaluate(({ BOX, INK_MIN, RULE_MIN_RUN }) => {
    const c = document.querySelector<HTMLCanvasElement>('canvas')!;
    const gl = c.getContext('webgl2')!;
    const w = c.width;
    const h = c.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    // readPixels is bottom-up; this takes top-down scene coords. The canvas is
    // 600×360 at deviceScaleFactor 1, so scene units map 1:1 to pixels.
    const inkAt = (x: number, y: number): number => {
      const i = ((h - 1 - y) * w + x) * 4;
      return 255 - (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]);
    };

    // Longest contiguous inked span per row, with where it starts and ends.
    const out: Array<{ y: number; run: number; start: number; end: number }> = [];
    for (let y = BOX.y0; y < BOX.y1; y++) {
      let best = 0, bestStart = -1, cur = 0, curStart = -1;
      for (let x = BOX.x0; x < BOX.x1; x++) {
        if (inkAt(x, y) >= INK_MIN) {
          if (cur === 0) curStart = x;
          cur++;
          if (cur > best) { best = cur; bestStart = curStart; }
        } else {
          cur = 0;
        }
      }
      if (best >= RULE_MIN_RUN) out.push({ y, run: best, start: bestStart, end: bestStart + best });
    }
    return { ruleRows: out, canvasW: w, canvasH: h };
  }, { BOX, INK_MIN, RULE_MIN_RUN });

  // Guard the guard: a sample box that missed the node would report zero rule
  // rows, which every assertion below would have to be written to notice.
  expect(rows.canvasW).toBe(600);
  expect(rows.canvasH).toBe(360);
  expect(rows.ruleRows.length).toBeGreaterThan(0);

  // Group consecutive rows into bands — a sub-pixel rule antialiases across
  // two rows, so a band is 1-3 rows tall.
  const bands: Array<{ y: number; run: number; start: number; end: number }[]> = [];
  for (const r of rows.ruleRows) {
    const last = bands[bands.length - 1];
    if (last && r.y - last[last.length - 1].y <= 1) last.push(r);
    else bands.push([r]);
  }
  expect(bands).toHaveLength(2);
  for (const b of bands) expect(b.length).toBeLessThanOrEqual(3);

  // Center of each band, weighted by run length so the antialiased edge row
  // doesn't drag the estimate.
  const centerOf = (b: typeof bands[number]): number => {
    const total = b.reduce((n, r) => n + r.run, 0);
    return b.reduce((acc, r) => acc + r.y * r.run, 0) / total;
  };
  const [upper, lower] = bands;
  const separation = centerOf(lower) - centerOf(upper);
  // 0.10 em - (-0.30 em) = 0.40 em = 6.4px at fontSize 16, and the run-weighted
  // centers measure 6.5 — the estimate is good to a tenth of a pixel, so the
  // window below is slack for cross-driver AA, not for the measurement.
  // Verified to catch the constant drifting: UNDERLINE_OFFSET 0.10 -> 0.18
  // reads 8.0 and fails.
  expect(separation).toBeGreaterThan(0.4 * FONT_SIZE - 1.2);
  expect(separation).toBeLessThan(0.4 * FONT_SIZE + 1.2);

  // The upper band is the strikethrough, on 'strikethrough' — a run that
  // starts partway along the line. The lower is the underline, on
  // 'Underline' — the first run, hard against the node's left edge.
  const widest = (b: typeof bands[number]) => b.reduce((m, r) => (r.run > m.run ? r : m));
  const strike = widest(upper);
  const underline = widest(lower);
  expect(underline.start).toBeLessThan(BOX.x0 + 4);
  expect(strike.start).toBeGreaterThan(underline.end);

  // Per-span, not per-line: neither rule reaches the end of the text. A rule
  // that leaked across runs would span most of the 540-wide box.
  const lineWidth = BOX.x1 - BOX.x0;
  expect(underline.run).toBeLessThan(lineWidth / 2);
  expect(strike.run).toBeLessThan(lineWidth / 2);
});
