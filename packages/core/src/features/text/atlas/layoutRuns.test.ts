import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  _resetFontRegistryForTests, registerFont, FIXTURE_FONT,
  registerCanvasFont, resetBakeBudget,
  _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
} from '@weasel-js/font';
import { layoutRuns } from './layoutRuns';
import { resolveRuns, type ResolvedRun } from '../runs/resolveRuns';
import { resolveTextStyle } from '../textStyle';

function stubFetch() {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
    }
    if (url.endsWith('.png')) {
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
}

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

async function registerFixture(family: string, opts: Array<{ weight?: number; style?: 'normal'|'italic' }>) {
  for (const v of opts) {
    await registerFont(family, v, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
  }
}

const RUN_PLAIN = (text: string): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { fill: 'solid', color: '#000' }, letterSpacing: 0,
});
const RUN_BOLD = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontWeight: 700 });
const RUN_ITALIC = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontStyle: 'italic' });

describe('layoutRuns — single line', () => {
  it('returns one group when all runs share the same variant', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].family).toBe('inter');
    expect(out.groups[0].weight).toBe(400);
    expect(out.groups[0].style).toBe('normal');
    expect(out.groups[0].quads).toHaveLength(2);
  });

  it('emits one group per distinct (family, weight, style, synthetic, fill)', async () => {
    await registerFixture('inter', [{}, { weight: 700 }]);
    const out = layoutRuns(
      [RUN_PLAIN('A'), RUN_BOLD('B'), RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(2);
    const regular = out.groups.find((g) => g.weight === 400)!;
    const bold = out.groups.find((g) => g.weight === 700)!;
    expect(regular.quads).toHaveLength(2);
    expect(bold.quads).toHaveLength(1);
  });

  it('marks groups with synthetic flags when the resolver fell back', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_ITALIC('A')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].synthetic).toEqual({ bold: false, italic: true });
  });

  it('per-run fill forces a separate group even for the same atlas variant', async () => {
    await registerFixture('inter', [{}]);
    const RED: ResolvedRun = { ...RUN_PLAIN('A'), fill: { fill: 'solid', color: '#f00' } };
    const out = layoutRuns(
      [RUN_PLAIN('A'), RED, RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(2);
  });

  it('positions glyphs across runs on the same baseline with kerning carrying through', async () => {
    await registerFixture('inter', [{}]);
    const single = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const split = layoutRuns([RUN_PLAIN('A'), RUN_PLAIN('B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const singleX = single.groups[0].quads.map((q) => q.x0);
    const splitX = split.groups.flatMap((g) => g.quads.map((q) => q.x0)).sort((a, b) => a - b);
    expect(splitX).toEqual(singleX);
  });

  it('returns no groups when the family is unregistered', () => {
    const out = layoutRuns(
      [{ ...RUN_PLAIN('A'), fontFamily: 'missing' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(0);
    expect(out.bounds.width).toBe(0);
  });

  it('records the typographic baseline (not the line-box top) on each quad', async () => {
    await registerFixture('inter', [{}]);
    // FIXTURE_FONT: info.size=32, common.base=29.
    // RUN_PLAIN: fontSize=32 → scale=1.
    // origin.y=100 → expected baselineY = 100 + 29 * 1 = 129.
    const out = layoutRuns(
      [RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 100 },
    );
    expect(out.groups[0].quads[0].baselineY).toBe(129);
  });
});

describe('layoutRuns — word wrap', () => {
  it('wraps a single run at space boundaries when content exceeds maxWidth', async () => {
    await registerFixture('inter', [{}]);
    // Fixture font has only 'A' (xadvance ~23 at size 32). Use width that
    // forces at least one wrap for the text below.
    const text = 'ABAB ABAB ABAB ABAB';
    const out = layoutRuns(
      [RUN_PLAIN(text)],
      { maxWidth: 150, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    const quads = out.groups[0].quads;
    expect(quads.length).toBeGreaterThan(4);
    const firstY = quads[0].y0;
    const lastY = quads[quads.length - 1].y0;
    expect(lastY).toBeGreaterThan(firstY);
  });

  it('mixed-size runs share a baseline on the same line', async () => {
    await registerFixture('inter', [{}]);
    const small: ResolvedRun = { ...RUN_PLAIN('A'), fontSize: 16 };
    const big: ResolvedRun = { ...RUN_PLAIN('B'), fontSize: 40 };
    const out = layoutRuns(
      [small, big],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    const allQuads = out.groups.flatMap((g) => g.quads);
    expect(allQuads).toHaveLength(2);
  });

  it('alignment shifts each line by (maxWidth - lineWidth) * factor', async () => {
    await registerFixture('inter', [{}]);
    const leftOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const centerOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'center' }, { x: 0, y: 0 });
    const rightOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'right' }, { x: 0, y: 0 });
    const leftX = leftOut.groups[0].quads[0].x0;
    const centerX = centerOut.groups[0].quads[0].x0;
    const rightX = rightOut.groups[0].quads[0].x0;
    expect(centerX).toBeGreaterThan(leftX);
    expect(rightX).toBeGreaterThan(centerX);
  });

  it('anchors center/right on the line width when no maxWidth box is given', async () => {
    await registerFixture('inter', [{}]);
    const at = (align: 'left' | 'center' | 'right') =>
      layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align }, { x: 100, y: 0 });
    const first = (o: ReturnType<typeof at>) => o.groups[0].quads[0].x0;
    // Without a box, the anchor x is the text's left edge ('left'), midpoint
    // ('center'), or right edge ('right'). So center shifts left by half the
    // line width and right by the full line width, relative to 'left'.
    const shiftCenter = first(at('left')) - first(at('center'));
    const shiftRight = first(at('left')) - first(at('right'));
    expect(shiftCenter).toBeGreaterThan(0);
    expect(shiftRight).toBeCloseTo(2 * shiftCenter, 5);
  });

  it('respects newlines inside a run as forced line breaks', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [RUN_PLAIN('A\nB')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    const quads = out.groups[0].quads;
    expect(quads).toHaveLength(2);
    expect(quads[1].y0).toBeGreaterThan(quads[0].y0);
  });
});

describe('layoutRuns — substituted families', () => {
  // The renderer looks the group's atlas up by `group.family` (exact
  // `getFont`). A group tagged with the *requested* family therefore resolves
  // to nothing and paints nothing, however correct the ResolveResult was.
  it('tags the group with the atlas family it will be looked up by', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [{ ...RUN_PLAIN('A'), fontFamily: 'ghost' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].family).toBe('inter');
    expect(out.groups[0].quads).toHaveLength(1);
  });

  it('merges two families substituting to the same atlas into one group', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [
        { ...RUN_PLAIN('A'), fontFamily: 'ghost' },
        { ...RUN_PLAIN('A'), fontFamily: 'phantom' },
      ],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].family).toBe('inter');
    expect(out.groups[0].quads).toHaveLength(2);
  });

  it('keeps a registered family on its own exact-match atlas', async () => {
    await registerFixture('inter', [{}]);
    await registerFixture('slab', [{}]);
    const out = layoutRuns(
      [RUN_PLAIN('A'), { ...RUN_PLAIN('A'), fontFamily: 'slab' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups.map((g) => g.family).sort()).toEqual(['inter', 'slab']);
  });
});

describe('layoutRuns — canvas-dynamic faces', () => {
  beforeEach(() => {
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: (_f, _w, _s, cp) =>
        cp === 32
          ? { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 12 }
          : { width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance: 22 },
    });
    registerCanvasFont('Dyn');
  });

  const dynRun = (text: string): ResolvedRun => ({
    text,
    fontFamily: 'Dyn',
    fontWeight: 400,
    fontStyle: 'normal',
    fontSize: 24, // scale = 24/48 = 0.5
    fill: { fill: 'solid', color: '#000' },
    letterSpacing: 0,
  });

  it('lays out a dynamic run into a canvas-source group with quads', () => {
    const laid = layoutRuns([dynRun('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    expect(laid.groups.length).toBe(1);
    const g = laid.groups[0];
    expect(g.source).toBe('canvas');
    expect(g.page).toBe(0);
    expect(g.quads.length).toBe(2);
    // Advance 22 at scale 0.5 → second glyph starts 11 units right of the first.
    expect(laid.groups[0].quads[1].x0 - laid.groups[0].quads[0].x0).toBeCloseTo(11);
    expect(laid.bounds.width).toBeCloseTo(22);
  });

  it('unbaked glyphs advance the pen but emit no quads', () => {
    resetBakeBudget(0);
    const laid = layoutRuns([dynRun('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    expect(laid.groups.flatMap((g) => g.quads).length).toBe(0);
    expect(laid.bounds.width).toBeCloseTo(22); // measureText advances still count
  });

  it('spaces contribute real measured advances without quads', () => {
    const laid = layoutRuns([dynRun('A B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    expect(laid.groups.flatMap((g) => g.quads).length).toBe(2);
    // A(22) + space(12) + B(22) at scale 0.5.
    expect(laid.bounds.width).toBeCloseTo(28);
  });

  it('tracks dynamic glyphs too, including the blank ones that emit no quad', () => {
    const opts = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
    const plain = layoutRuns([dynRun('A B')], opts, { x: 0, y: 0 });
    const tracked = layoutRuns([{ ...dynRun('A B'), letterSpacing: 5 }], opts, { x: 0, y: 0 });
    // A(11) + space(6) + B(11) at scale 0.5, plus 5 after each of 3 characters.
    expect(plain.bounds.width).toBeCloseTo(28);
    expect(tracked.bounds.width).toBeCloseTo(43);
    // The space emits no quad but must still carry its tracking, so 'B' moves
    // by two characters' worth — otherwise quads drift out of the line width.
    const bx = (o: ReturnType<typeof layoutRuns>) =>
      o.groups.flatMap((g) => g.quads.map((q) => q.x0))[1];
    expect(bx(tracked) - bx(plain)).toBeCloseTo(10);
  });

  it('atlas groups still report source "atlas" and page 0', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const group = out.groups[0];
    expect(group.source).toBe('atlas');
    expect(group.page).toBe(0);
  });
});

describe('layoutRuns — letterSpacing', () => {
  // FIXTURE_FONT at fontSize 32 (scale 1): A xadvance 23 / xoffset 1,
  // B xadvance 22 / xoffset 2, kerning A→B = -1.
  //   untracked 'AB': width 44, quad x0s [1, 24].
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
  const ORIGIN = { x: 0, y: 0 };
  // Emission order, deliberately unsorted — sorting would hide a bug that
  // reorders quads, and every case here lays out into a single group.
  const xs = (o: ReturnType<typeof layoutRuns>) =>
    o.groups.flatMap((g) => g.quads.map((q) => q.x0));

  it('adds tracking after every glyph, including the last', async () => {
    await registerFixture('inter', [{}]);
    const plain = layoutRuns([RUN_PLAIN('AB')], OPTS, ORIGIN);
    const tracked = layoutRuns([{ ...RUN_PLAIN('AB'), letterSpacing: 4 }], OPTS, ORIGIN);
    // Trailing tracking counts toward the measured width (matches CSS).
    expect(plain.bounds.width).toBeCloseTo(44);
    expect(tracked.bounds.width).toBeCloseTo(plain.bounds.width + 4 * 2);
    // ...and the glyphs actually move: the Nth glyph shifts by N * spacing.
    expect(xs(plain)).toEqual([1, 24]);
    expect(xs(tracked)).toEqual([1, 28]);
  });

  it('is a no-op at 0', async () => {
    await registerFixture('inter', [{}]);
    const a = layoutRuns([RUN_PLAIN('AB')], OPTS, ORIGIN);
    const b = layoutRuns([{ ...RUN_PLAIN('AB'), letterSpacing: 0 }], OPTS, ORIGIN);
    expect(b.bounds.width).toBe(a.bounds.width);
    expect(xs(b)).toEqual(xs(a));
  });

  it('is in world units — the same tracking shifts glyphs equally at any fontSize', async () => {
    await registerFixture('inter', [{}]);
    const at = (fontSize: number, letterSpacing: number) =>
      layoutRuns([{ ...RUN_PLAIN('AB'), fontSize, letterSpacing }], OPTS, ORIGIN);
    for (const fontSize of [32, 16]) {
      const plain = at(fontSize, 0);
      const tracked = at(fontSize, 4);
      // Second glyph moves right by exactly 4 world units at both sizes.
      expect(xs(tracked)[1] - xs(plain)[1]).toBeCloseTo(4);
      expect(tracked.bounds.width - plain.bounds.width).toBeCloseTo(8);
    }
  });

  it('accepts negative tracking, pulling glyphs together', async () => {
    await registerFixture('inter', [{}]);
    const tight = layoutRuns([{ ...RUN_PLAIN('AB'), letterSpacing: -4 }], OPTS, ORIGIN);
    expect(xs(tight)).toEqual([1, 20]);
    expect(tight.bounds.width).toBeCloseTo(36);
  });

  it('tracks spaces like any other character', async () => {
    await registerFixture('inter', [{}]);
    // Fixture has no space glyph → synthesized advance fontSize * 0.25 = 8.
    const plain = layoutRuns([RUN_PLAIN('A B')], OPTS, ORIGIN);
    const tracked = layoutRuns([{ ...RUN_PLAIN('A B'), letterSpacing: 4 }], OPTS, ORIGIN);
    expect(plain.bounds.width).toBeCloseTo(53);
    // Three characters tracked: A, the space, and B.
    expect(tracked.bounds.width).toBeCloseTo(53 + 12);
    // The space paints nothing, so only A and B emit quads — but its tracking
    // still separates them: 'B' picks up two characters' worth.
    expect(xs(plain)).toHaveLength(2);
    expect(xs(tracked)[1] - xs(plain)[1]).toBeCloseTo(8);
  });

  it('applies each run’s own tracking to the gap that follows its glyphs', async () => {
    await registerFixture('inter', [{}]);
    const trackedFirst = layoutRuns(
      [{ ...RUN_PLAIN('A'), letterSpacing: 10 }, RUN_PLAIN('B')],
      OPTS, ORIGIN,
    );
    const trackedSecond = layoutRuns(
      [RUN_PLAIN('A'), { ...RUN_PLAIN('B'), letterSpacing: 10 }],
      OPTS, ORIGIN,
    );
    // Tracking belongs to the glyph it follows: only the first case pushes B right.
    expect(xs(trackedFirst)).toEqual([1, 34]);
    expect(xs(trackedSecond)).toEqual([1, 24]);
    // Both add exactly one glyph's worth of tracking to the measured width.
    expect(trackedFirst.bounds.width).toBeCloseTo(54);
    expect(trackedSecond.bounds.width).toBeCloseTo(54);
  });

  const lineCount = (o: ReturnType<typeof layoutRuns>) =>
    new Set(o.groups.flatMap((g) => g.quads.map((q) => q.y0))).size;

  it('counts the tracking of the word being fitted, not just of the line so far', async () => {
    await registerFixture('inter', [{}]);
    // The wrap decision is `lineSoFar + nextWord > maxWidth`. Both terms must
    // include tracking; this case is chosen so only the *word* term decides.
    //   ls 0:  'AB'=44, ' '=8  → 52 + 44 = 96 ≤ 130 → one line.
    //   ls 10: 'AB'=64, ' '=18 → 82 + 64 = 146 > 130 → two lines.
    // Drop tracking from the word scan and the second case measures the word
    // at 44 → 126 ≤ 130 → it stays on one line and this test fails.
    const wrapOpts = { maxWidth: 130, lineHeight: 1.2, align: 'left' as const };
    const at = (letterSpacing: number) =>
      layoutRuns([{ ...RUN_PLAIN('AB AB'), letterSpacing }], wrapOpts, ORIGIN);
    expect(lineCount(at(0))).toBe(1);
    expect(lineCount(at(10))).toBe(2);
  });

  it('counts toward wrapping, so tracked text breaks into more lines', async () => {
    await registerFixture('inter', [{}]);
    const wrapOpts = { maxWidth: 150, lineHeight: 1.2, align: 'left' as const };
    const text = 'AB AB AB AB AB AB';
    const plain = layoutRuns([RUN_PLAIN(text)], wrapOpts, ORIGIN);
    const tracked = layoutRuns([{ ...RUN_PLAIN(text), letterSpacing: 10 }], wrapOpts, ORIGIN);
    expect(lineCount(plain)).toBe(2);
    expect(lineCount(tracked)).toBe(3);
  });

  it('reaches layout through resolveRuns (run value wins, style value inherited)', async () => {
    await registerFixture('inter', [{}]);
    const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 32, letterSpacing: 4 });
    const fromStyle = layoutRuns(resolveRuns([{ text: 'AB' }], style), OPTS, ORIGIN);
    const fromRun = layoutRuns(
      resolveRuns([{ text: 'AB', letterSpacing: 10 }], style),
      OPTS, ORIGIN,
    );
    expect(xs(fromStyle)).toEqual([1, 28]);
    expect(xs(fromRun)).toEqual([1, 34]);
  });
});
