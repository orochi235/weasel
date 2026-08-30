import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerFont,
  FIXTURE_FONT,
  registerCanvasFont,
  resetBakeBudget,
  setFontFallbackPolicy,
  registerFontOutlines,
  glyphOutline,
} from '@weasel-js/font';
import {
  _resetFontRegistryForTests,
  _resetFallbackForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
  _resetFontOutlinesForTests,
} from '@weasel-js/font/test-seams';
import { layoutRuns, _resetMissingGlyphWarningsForTests } from './layoutRuns';
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

// A second atlas whose baseline sits lower in the same em, so a face's ascent
// can be varied without varying its size — which is what separates "the line
// sank its baseline to clear this face" from "the run is set larger".
const TALL_FONT = { ...FIXTURE_FONT, common: { ...FIXTURE_FONT.common, base: 58 } };
async function registerTallFont(): Promise<void> {
  const prior = global.fetch;
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('tall.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(TALL_FONT) });
    }
    return (prior as unknown as (u: string) => unknown)(url);
  }) as typeof fetch;
  await registerFont('tall', {}, '/fonts/tall/tall.json', '/fonts/tall/tall.png');
  global.fetch = prior;
}

const RUN_PLAIN = (text: string): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { fill: 'solid', color: '#000' }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});
const RUN_BOLD = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontWeight: 700 });
const RUN_ITALIC = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontStyle: 'italic' });

describe('layoutRuns — single line', () => {
  it('returns one group when all runs share the same variant', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
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
    );
    expect(out.groups).toHaveLength(2);
    const regular = out.groups.find((g) => g.weight === 400)!;
    const bold = out.groups.find((g) => g.weight === 700)!;
    expect(regular.quads).toHaveLength(2);
    expect(bold.quads).toHaveLength(1);
  });

  it('marks groups with synthetic flags when the resolver fell back', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_ITALIC('A')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].synthetic).toEqual({ bold: false, italic: true });
  });

  it('per-run fill forces a separate group even for the same atlas variant', async () => {
    await registerFixture('inter', [{}]);
    const RED: ResolvedRun = { ...RUN_PLAIN('A'), fill: { fill: 'solid', color: '#f00' } };
    const out = layoutRuns(
      [RUN_PLAIN('A'), RED, RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups).toHaveLength(2);
  });

  it('positions glyphs across runs on the same baseline with kerning carrying through', async () => {
    await registerFixture('inter', [{}]);
    const single = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const split = layoutRuns([RUN_PLAIN('A'), RUN_PLAIN('B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const singleX = single.groups[0].quads.map((q) => q.x0);
    const splitX = split.groups.flatMap((g) => g.quads.map((q) => q.x0)).sort((a, b) => a - b);
    expect(splitX).toEqual(singleX);
  });

  it('returns no groups when the family is unregistered', () => {
    const out = layoutRuns(
      [{ ...RUN_PLAIN('A'), fontFamily: 'missing' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups).toHaveLength(0);
    expect(out.bounds.width).toBe(0);
  });

  it('records the typographic baseline (not the line-box top) on each quad', async () => {
    await registerFixture('inter', [{}]);
    // FIXTURE_FONT: info.size=32, common.base=29.
    // RUN_PLAIN: fontSize=32 → scale=1, so the baseline sits 29 below the
    // line-box top — which, layout being origin-relative, is y = 0.
    const out = layoutRuns(
      [RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups[0].quads[0].baselineY).toBe(29);
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
    );
    const allQuads = out.groups.flatMap((g) => g.quads);
    expect(allQuads).toHaveLength(2);
    // The tallest run's ascent sets it: base 29 in a 32 em, at fontSize 40.
    expect(allQuads.map((q) => q.baselineY)).toEqual([36.25, 36.25]);
    expect(out.lines[0].baselineY).toBeCloseTo(36.25, 6);
    // The small run hangs off that baseline, so its ink sits *below* the big
    // run's top rather than level with it at the line top.
    const [smallQuad, bigQuad] = allQuads;
    expect(smallQuad.y0).toBeGreaterThan(bigQuad.y0);
  });

  it('takes the tallest ascent on the line whichever run carries it', async () => {
    await registerFixture('inter', [{}]);
    const small: ResolvedRun = { ...RUN_PLAIN('A'), fontSize: 16 };
    const big: ResolvedRun = { ...RUN_PLAIN('B'), fontSize: 40 };
    // Both orders, so the baseline cannot be coming from whichever run the
    // walk happened to visit first or last.
    const bigFirst = layoutRuns([big, small], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const bigLast = layoutRuns([small, big], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(bigFirst.lines[0].baselineY).toBeCloseTo(36.25, 6);
    expect(bigLast.lines[0].baselineY).toBeCloseTo(36.25, 6);
    for (const out of [bigFirst, bigLast]) {
      const baselines = out.groups.flatMap((g) => g.quads).map((q) => q.baselineY);
      expect(new Set(baselines)).toEqual(new Set([36.25]));
    }
  });

  it('aligns two faces with different ascents on one baseline', async () => {
    await registerFixture('inter', [{}]);
    await registerTallFont();
    // inter's base is 29 in a 32 em; tall's is 58. At the same fontSize the
    // deeper ascent sinks the shared baseline, and both runs sit on it.
    const out = layoutRuns(
      [RUN_PLAIN('A'), { ...RUN_PLAIN('B'), fontFamily: 'tall' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    const baselines = out.groups.flatMap((g) => g.quads).map((q) => q.baselineY);
    expect(baselines).toHaveLength(2);
    expect(new Set(baselines).size).toBe(1);
    expect(baselines[0]).toBeCloseTo(58, 6);
  });

  it('alignment shifts each line by (maxWidth - lineWidth) * factor', async () => {
    await registerFixture('inter', [{}]);
    const leftOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'left' });
    const centerOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'center' });
    const rightOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'right' });
    const leftX = leftOut.groups[0].quads[0].x0;
    const centerX = centerOut.groups[0].quads[0].x0;
    const rightX = rightOut.groups[0].quads[0].x0;
    expect(centerX).toBeGreaterThan(leftX);
    expect(rightX).toBeGreaterThan(centerX);
  });

  it('anchors center/right on the line width when no maxWidth box is given', async () => {
    await registerFixture('inter', [{}]);
    const at = (align: 'left' | 'center' | 'right') =>
      layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align });
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
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  });

  it('lays out a dynamic run into a canvas-source group with quads', () => {
    const laid = layoutRuns([dynRun('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
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
    const laid = layoutRuns([dynRun('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(laid.groups.flatMap((g) => g.quads).length).toBe(0);
    expect(laid.bounds.width).toBeCloseTo(22); // measureText advances still count
  });

  it('spaces contribute real measured advances without quads', () => {
    const laid = layoutRuns([dynRun('A B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(laid.groups.flatMap((g) => g.quads).length).toBe(2);
    // A(22) + space(12) + B(22) at scale 0.5.
    expect(laid.bounds.width).toBeCloseTo(28);
  });

  it('tracks dynamic glyphs too, including the blank ones that emit no quad', () => {
    const opts = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
    const plain = layoutRuns([dynRun('A B')], opts);
    const tracked = layoutRuns([{ ...dynRun('A B'), letterSpacing: 5 }], opts);
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
    const out = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
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
  // Emission order, deliberately unsorted — sorting would hide a bug that
  // reorders quads, and every case here lays out into a single group.
  const xs = (o: ReturnType<typeof layoutRuns>) =>
    o.groups.flatMap((g) => g.quads.map((q) => q.x0));

  it('adds tracking after every glyph, including the last', async () => {
    await registerFixture('inter', [{}]);
    const plain = layoutRuns([RUN_PLAIN('AB')], OPTS);
    const tracked = layoutRuns([{ ...RUN_PLAIN('AB'), letterSpacing: 4 }], OPTS);
    // Trailing tracking counts toward the measured width (matches CSS).
    expect(plain.bounds.width).toBeCloseTo(44);
    expect(tracked.bounds.width).toBeCloseTo(plain.bounds.width + 4 * 2);
    // ...and the glyphs actually move: the Nth glyph shifts by N * spacing.
    expect(xs(plain)).toEqual([1, 24]);
    expect(xs(tracked)).toEqual([1, 28]);
  });

  it('is a no-op at 0', async () => {
    await registerFixture('inter', [{}]);
    const a = layoutRuns([RUN_PLAIN('AB')], OPTS);
    const b = layoutRuns([{ ...RUN_PLAIN('AB'), letterSpacing: 0 }], OPTS);
    expect(b.bounds.width).toBe(a.bounds.width);
    expect(xs(b)).toEqual(xs(a));
  });

  it('is in world units — the same tracking shifts glyphs equally at any fontSize', async () => {
    await registerFixture('inter', [{}]);
    const at = (fontSize: number, letterSpacing: number) =>
      layoutRuns([{ ...RUN_PLAIN('AB'), fontSize, letterSpacing }], OPTS);
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
    const tight = layoutRuns([{ ...RUN_PLAIN('AB'), letterSpacing: -4 }], OPTS);
    expect(xs(tight)).toEqual([1, 20]);
    expect(tight.bounds.width).toBeCloseTo(36);
  });

  it('tracks spaces like any other character', async () => {
    await registerFixture('inter', [{}]);
    // Fixture has no space glyph → synthesized advance fontSize * 0.25 = 8.
    const plain = layoutRuns([RUN_PLAIN('A B')], OPTS);
    const tracked = layoutRuns([{ ...RUN_PLAIN('A B'), letterSpacing: 4 }], OPTS);
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
      OPTS,
      );
    const trackedSecond = layoutRuns(
      [RUN_PLAIN('A'), { ...RUN_PLAIN('B'), letterSpacing: 10 }],
      OPTS,
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
      layoutRuns([{ ...RUN_PLAIN('AB AB'), letterSpacing }], wrapOpts);
    expect(lineCount(at(0))).toBe(1);
    expect(lineCount(at(10))).toBe(2);
  });

  it('counts toward wrapping, so tracked text breaks into more lines', async () => {
    await registerFixture('inter', [{}]);
    const wrapOpts = { maxWidth: 150, lineHeight: 1.2, align: 'left' as const };
    const text = 'AB AB AB AB AB AB';
    const plain = layoutRuns([RUN_PLAIN(text)], wrapOpts);
    const tracked = layoutRuns([{ ...RUN_PLAIN(text), letterSpacing: 10 }], wrapOpts);
    expect(lineCount(plain)).toBe(2);
    expect(lineCount(tracked)).toBe(3);
  });

  it('reaches layout through resolveRuns (run value wins, style value inherited)', async () => {
    await registerFixture('inter', [{}]);
    const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 32, letterSpacing: 4 });
    const fromStyle = layoutRuns(resolveRuns([{ text: 'AB' }], style), OPTS);
    const fromRun = layoutRuns(
      resolveRuns([{ text: 'AB', letterSpacing: 10 }], style),
      OPTS,
      );
    expect(xs(fromStyle)).toEqual([1, 28]);
    expect(xs(fromRun)).toEqual([1, 34]);
  });
});

describe('layoutRuns — decoration geometry', () => {
  // FIXTURE_FONT: info.size=32, common.base=29, and glyphs for 'A' (xadvance
  // 23) and 'B' (xadvance 22) only, with kerning A→B = -1. RUN_PLAIN is
  // fontSize 32, so scale = 1 and every metric below is the raw fixture
  // number. There is no space glyph, so a space advances fontSize*0.25 = 8.
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
  const BASELINE = 29;
  const UNDER_Y0 = BASELINE + 0.10 * 32;   // 32.2
  const STRIKE_Y0 = BASELINE - 0.30 * 32;  // 19.4
  const THICKNESS = 0.05 * 32;             // 1.6

  const UNDERLINED = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), underline: true });

  it('emits no decorations when neither flag is set', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_PLAIN('AB')], OPTS);
    expect(out.decorations).toEqual([]);
  });

  it('places an underline rule below the baseline, spanning the run advance', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([UNDERLINED('A')], OPTS);
    expect(out.decorations).toHaveLength(1);
    const d = out.decorations[0];
    expect(d.kind).toBe('underline');
    expect(d.x0).toBeCloseTo(0, 6);
    expect(d.x1).toBeCloseTo(23, 6);
    expect(d.y0).toBeCloseTo(UNDER_Y0, 6);
    expect(d.y1 - d.y0).toBeCloseTo(THICKNESS, 6);
  });

  it('places a strikethrough rule above the baseline', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([{ ...RUN_PLAIN('A'), strikethrough: true }], OPTS);
    expect(out.decorations).toHaveLength(1);
    const d = out.decorations[0];
    expect(d.kind).toBe('strikethrough');
    expect(d.y0).toBeCloseTo(STRIKE_Y0, 6);
    expect(d.y1 - d.y0).toBeCloseTo(THICKNESS, 6);
    expect(d.y1).toBeLessThan(BASELINE);
  });

  it('emits both rules for a run carrying both flags', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([{ ...RUN_PLAIN('A'), underline: true, strikethrough: true }], OPTS);
    expect(out.decorations.map((d) => d.kind)).toEqual(['underline', 'strikethrough']);
    // One span, two rules: same horizontal extent.
    expect(out.decorations[0].x1).toBe(out.decorations[1].x1);
  });

  it('runs continuously across interior spaces, which emit no glyph quads', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([UNDERLINED('A B')], OPTS);
    expect(out.decorations).toHaveLength(1);
    // A(23) + space(8) + B(22) = 53.
    expect(out.decorations[0].x0).toBeCloseTo(0, 6);
    expect(out.decorations[0].x1).toBeCloseTo(53, 6);
    // The space emits no quad, so x=27 sits in a hole in the glyph geometry.
    // A rule assembled per-quad rather than from the pen would break there.
    const quads = out.groups.flatMap((g) => g.quads);
    expect(quads.some((q) => q.x0 <= 27 && q.x1 >= 27)).toBe(false);
  });

  it('covers trailing letter-spacing, matching the CSS inline box', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([{ ...UNDERLINED('A'), letterSpacing: 10 }], OPTS);
    // Tracking is applied after every glyph including the last (see the
    // layoutRuns header), so the rule is 23 + 10 wide, not 23.
    expect(out.decorations[0].x1).toBeCloseTo(33, 6);
  });

  it('covers trailing letter-spacing on every glyph of a merged span', async () => {
    await registerFixture('inter', [{}]);
    // The single-glyph case above only ever takes the branch that *opens* a
    // span. Tracking has to reach the branch that *extends* one too, which
    // needs a second glyph: A(23)+10 + kern(-1) + B(22)+10 = 64.
    const out = layoutRuns([{ ...UNDERLINED('AB'), letterSpacing: 10 }], OPTS);
    expect(out.decorations).toHaveLength(1);
    expect(out.decorations[0].x1).toBeCloseTo(64, 6);
  });

  it('merges adjacent runs that agree on decoration and fill into one rule', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([UNDERLINED('A'), UNDERLINED('B')], OPTS);
    expect(out.decorations).toHaveLength(1);
    // A(23) + kern(-1) + B(22) = 44. A seam at the run join would show as two
    // rects, or as one rect that skipped the kerning gap.
    expect(out.decorations[0].x0).toBeCloseTo(0, 6);
    expect(out.decorations[0].x1).toBeCloseTo(44, 6);
  });

  it('breaks the rule where the fill changes, so each piece takes its run colour', async () => {
    await registerFixture('inter', [{}]);
    const RED: ResolvedRun = { ...UNDERLINED('B'), fill: { fill: 'solid', color: '#f00' } };
    const out = layoutRuns([UNDERLINED('A'), RED], OPTS);
    expect(out.decorations).toHaveLength(2);
    expect(out.decorations.map((d) => d.fill)).toEqual([
      { fill: 'solid', color: '#000' },
      { fill: 'solid', color: '#f00' },
    ]);
    // Each piece covers its own glyphs' advance boxes, so the join carries
    // the kerning: the pen backs up by 1 before B, and a new span opens at
    // the pen, so these two overlap by 1. Positive kerning would leave a gap
    // of the same size instead. Only at zero kerning do they abut exactly.
    expect(out.decorations[0].x1).toBeCloseTo(23, 6);
    expect(out.decorations[1].x0).toBeCloseTo(22, 6);
  });

  it('does not merge across a font-size change, since offset and thickness scale', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [UNDERLINED('A'), { ...UNDERLINED('B'), fontSize: 16 }],
      OPTS,
      );
    expect(out.decorations).toHaveLength(2);
    expect(out.decorations[1].y1 - out.decorations[1].y0).toBeCloseTo(0.05 * 16, 6);
    // Mixed sizes share a line but not a baseline: base is 29 at scale 1,
    // 14.5 at scale 0.5.
    expect(out.decorations[0].y0).not.toBeCloseTo(out.decorations[1].y0, 3);
  });

  it('stops the rule at an undecorated run and starts a new one after it', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([UNDERLINED('A'), RUN_PLAIN('B'), UNDERLINED('A')], OPTS);
    expect(out.decorations).toHaveLength(2);
    expect(out.decorations[0].x1).toBeLessThan(out.decorations[1].x0);
  });

  it('emits one rule per line when a decorated span wraps', async () => {
    await registerFixture('inter', [{}]);
    // maxWidth 30: 'A' (23) fits; the trailing space takes the line to 31;
    // 'B' (22) would take it to 53, so it wraps.
    const out = layoutRuns([UNDERLINED('A B')], { ...OPTS, maxWidth: 30 });
    expect(out.decorations).toHaveLength(2);
    const [first, second] = out.decorations;
    expect(second.y0 - first.y0).toBeCloseTo(32 * 1.2, 6);
    // Neither rule spans the break: each is bounded by its own line.
    expect(first.x1).toBeCloseTo(31, 6);
    expect(second.x0).toBeCloseTo(0, 6);
    expect(second.x1).toBeCloseTo(22, 6);
  });

  it('follows the alignment shift, since it is applied before the pen walks', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([UNDERLINED('A')], { ...OPTS, maxWidth: 100, align: 'right' });
    expect(out.decorations[0].x0).toBeCloseTo(100 - 23, 6);
    expect(out.decorations[0].x1).toBeCloseTo(100, 6);
  });

  it('decorates a whitespace-only run, which contributes no glyph quads at all', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([UNDERLINED('A'), UNDERLINED(' ')], OPTS);
    expect(out.groups.flatMap((g) => g.quads)).toHaveLength(1);
    expect(out.decorations[0].x1).toBeCloseTo(31, 6);
  });

  it('does not merge an underlined run into an adjacent struck-through one', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [UNDERLINED('A'), { ...RUN_PLAIN('B'), strikethrough: true }],
      OPTS,
      );
    expect(out.decorations.map((d) => d.kind)).toEqual(['underline', 'strikethrough']);
    // The underline stops at A; it does not run on under B.
    expect(out.decorations[0].x1).toBeCloseTo(23, 6);
    expect(out.decorations[1].x0).toBeCloseTo(22, 6);
  });

  it('merges across a face whose ascent differs, now that the line shares a baseline', async () => {
    await registerFixture('inter', [{}]);
    await registerTallFont();
    // base 29 vs 58 at equal size: both runs sit on the deeper baseline, so
    // the rule runs on under the join instead of stepping 29 units down.
    const out = layoutRuns(
      [UNDERLINED('A'), { ...UNDERLINED('B'), fontFamily: 'tall' }],
      OPTS,
      );
    expect(out.decorations).toHaveLength(1);
    // Shared baseline 58, plus the 0.10-em underline offset at fontSize 32.
    expect(out.decorations[0].y0).toBeCloseTo(58 + 32 * 0.1, 6);
  });

  it('does not merge across a font-size change at equal baseline', async () => {
    await registerFixture('inter', [{}]);
    await registerTallFont();
    // Same baseline now by construction; the sizes still differ, and offset
    // and thickness both scale with size, so the two rules stay separate.
    const out = layoutRuns(
      [UNDERLINED('A'), { ...UNDERLINED('B'), fontFamily: 'tall', fontSize: 16 }],
      OPTS,
      );
    expect(out.decorations).toHaveLength(2);
    expect(out.decorations[0].y1 - out.decorations[0].y0).toBeCloseTo(0.05 * 32, 6);
    expect(out.decorations[1].y1 - out.decorations[1].y0).toBeCloseTo(0.05 * 16, 6);
  });

  it('emits nothing for a span that advances nowhere', async () => {
    await registerFixture('inter', [{}]);
    // Tracking exactly cancels the advance, so the span is zero-width. A rect
    // with x1 === x0 rasterizes nothing; don't pay a draw call for it.
    const out = layoutRuns([{ ...UNDERLINED('A'), letterSpacing: -23 }], OPTS);
    expect(out.decorations).toEqual([]);
  });

  it('reaches layout through resolveRuns, additively over the node style', async () => {
    await registerFixture('inter', [{}]);
    const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 32, underline: true });
    const out = layoutRuns(resolveRuns([{ text: 'A' }], style), OPTS);
    expect(out.decorations.map((d) => d.kind)).toEqual(['underline']);
  });
});

describe('layoutRuns — a codepoint the atlas does not cover', () => {
  // U+2014. The fixture atlas carries 'A' and 'B' and nothing else, so this
  // is the same shape as the real defect: a run resolves to a perfectly good
  // atlas that simply never baked the character.
  const EM_DASH = '—';
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };

  const run = (text: string): ResolvedRun => ({
    text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
    fill: { fill: 'solid', color: '#000' }, letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  });

  function stubRasterizer() {
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
        left: -8, top: 26, advance: 22,
      }),
    });
  }

  beforeEach(() => {
    _resetDynamicFontsForTests();
    _resetFallbackForTests();
    _resetMissingGlyphWarningsForTests();
    resetBakeBudget();
  });

  it('escalates it to the dynamic tier instead of dropping it', async () => {
    await registerFixture('inter', [{}]);
    stubRasterizer();
    const out = layoutRuns([run(`A${EM_DASH}B`)], OPTS);

    // Two groups: the atlas serves A and B, the dynamic tier serves the dash.
    // They cannot merge — different texture, different shader.
    const atlas = out.groups.filter((g) => g.source === 'atlas');
    const canvas = out.groups.filter((g) => g.source === 'canvas');
    expect(atlas).toHaveLength(1);
    expect(canvas).toHaveLength(1);
    expect(atlas[0].quads).toHaveLength(2);
    expect(canvas[0].quads).toHaveLength(1);
  });

  it('does not substitute a literal "?"', async () => {
    // An atlas that DOES carry '?' is the case the old fallback silently hit:
    // it drew a character the author never wrote, indistinguishable from one
    // they did.
    const withQuestion = {
      ...FIXTURE_FONT,
      chars: [
        ...FIXTURE_FONT.chars,
        { id: 63, x: 48, y: 0, width: 18, height: 28, xoffset: 1, yoffset: 4, xadvance: 20, page: 0 },
      ],
    };
    global.fetch = vi.fn().mockImplementation((url: string) =>
      url.endsWith('.json')
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(withQuestion) })
        : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) }),
    ) as typeof fetch;
    await registerFixture('inter', [{}]);
    stubRasterizer();

    const out = layoutRuns([run(EM_DASH)], OPTS);
    // The one quad is the dash from the dynamic tier, not '?' from the atlas.
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].source).toBe('canvas');
    expect(out.groups[0].quads).toHaveLength(1);
  });

  it('sets the escalated glyph between its neighbours, at its own scale', async () => {
    await registerFixture('inter', [{}]);
    stubRasterizer();
    const out = layoutRuns([run(`A${EM_DASH}B`)], OPTS);

    const [a, b] = out.groups.find((g) => g.source === 'atlas')!.quads;
    const dash = out.groups.find((g) => g.source === 'canvas')!.quads[0];
    // Deliberately not a width comparison against 'AB': dropping a glyph also
    // drops the kerning pair across it, so a bare `wider than` assertion
    // passes on a 1-unit kerning shift with no dash drawn at all.
    expect(dash.x0).toBeGreaterThan(a.x0);
    expect(b.x0).toBeGreaterThan(dash.x1);

    // The stub bakes 20×24 at BAKE_SIZE 48; at fontSize 32 that is scale 2/3.
    // Getting this wrong means scaling the escalated glyph by the *atlas's*
    // info.size (32) — it would come out half again too big.
    expect(dash.x1 - dash.x0).toBeCloseTo(20 * (32 / 48), 6);
  });

  it('skips the character under the "none" policy, which documents a hard miss', async () => {
    await registerFixture('inter', [{}]);
    stubRasterizer();
    setFontFallbackPolicy('none');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = layoutRuns([run(`A${EM_DASH}B`)], OPTS);
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].source).toBe('atlas');
    expect(out.groups[0].quads).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('U+2014');
    warn.mockRestore();
  });

  it('warns once per codepoint however often it appears', async () => {
    await registerFixture('inter', [{}]);
    stubRasterizer();
    setFontFallbackPolicy('none');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    layoutRuns([run(`${EM_DASH}${EM_DASH}${EM_DASH}`)], OPTS);
    layoutRuns([run(EM_DASH)], OPTS);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

/**
 * The outline tier's layout half: which glyphs escalate, what they carry, and
 * — the invariant everything else rests on — that escalating changes nothing
 * about where they sit.
 */
describe('layoutRuns — outline tier', () => {
  const OUTLINE_D = 'M0 0L0.5 -0.7L1 0Z';

  beforeEach(() => {
    _resetFontOutlinesForTests();
  });

  function registerOutlines(family: string, weight = 400, style: 'normal' | 'italic' = 'normal') {
    registerFontOutlines(family, { weight, style }, new ArrayBuffer(4), {
      // A real face reports `null` for a space — no contours, nothing to
      // tessellate — and the stub has to as well, or the tier would emit
      // geometry for whitespace.
      parser: () => ({ unitsPerEm: 1000, ascender: 0.8, advanceOf: (cp: number) => (cp === 32 ? 0.25 : 0.6), kernOf: () => 0, glyphD: (cp: number) => (cp === 32 ? null : OUTLINE_D) }),
    });
    // The registry answers `null` until the (async) load lands; drive it to
    // ready the same way a second frame would.
    glyphOutline(family, weight, style, 65);
    return new Promise<void>((r) => setTimeout(r, 0));
  }

  const OPTS_OUT = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const, outlineMinSize: 20 };

  it('leaves every glyph on the SDF tier when the caller does not opt in', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
    expect(out.groups[0].glyphs).toEqual([]);
  });

  it('emits an outline group at or above the threshold', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutRuns([RUN_PLAIN('AB')], OPTS_OUT);
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].source).toBe('outline');
    expect(out.groups[0].quads).toEqual([]);
    expect(out.groups[0].glyphs).toHaveLength(2);
    expect(out.groups[0].glyphs[0].d).toBe(OUTLINE_D);
    // Em space is unit-scale, so world units per em is the run's own size.
    expect(out.groups[0].glyphs[0].scale).toBe(32);
  });

  it('stays on the SDF tier below the threshold', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutRuns([RUN_PLAIN('AB')], { ...OPTS_OUT, outlineMinSize: 48 });
    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
  });

  it('escalates a stroked run below the threshold, since the SDF tiers cannot stroke', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const stroked: ResolvedRun = {
      ...RUN_PLAIN('AB'),
      stroke: { paint: { fill: 'solid', color: '#f00' }, width: 2 },
    };
    const out = layoutRuns([stroked], { ...OPTS_OUT, outlineMinSize: 48 });

    expect(out.groups.map((g) => g.source)).toEqual(['outline']);
    expect(out.groups[0].stroke).toMatchObject({ width: 2 });
  });

  it('leaves a zero-width stroke below the threshold on the SDF tier', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const hairless: ResolvedRun = {
      ...RUN_PLAIN('AB'),
      stroke: { paint: { fill: 'solid', color: '#f00' }, width: 0 },
    };
    const out = layoutRuns([hairless], { ...OPTS_OUT, outlineMinSize: 48 });

    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
  });

  it('does not escalate a stroked run when the caller opted out of outlines', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const stroked: ResolvedRun = {
      ...RUN_PLAIN('AB'),
      stroke: { paint: { fill: 'solid', color: '#f00' }, width: 2 },
    };
    const out = layoutRuns([stroked], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });

    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
  });

  it('places outline glyphs at the pen and the baseline, not the quad corner', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const atlas = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const outline = layoutRuns([RUN_PLAIN('AB')], OPTS_OUT);

    // The atlas quad carries the glyph's own baseline; an outline glyph's
    // origin IS that baseline, and its x is the pen — which for the first
    // glyph of a left-aligned line is 0.
    expect(outline.groups[0].glyphs[0].x).toBe(0);
    expect(outline.groups[0].glyphs[0].baselineY).toBe(atlas.groups[0].quads[0].baselineY);
  });

  it('is metric-neutral: bounds, lines and advances are identical either way', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const atlas = layoutRuns([RUN_PLAIN('Away we go')], { maxWidth: 200, lineHeight: 1.2, align: 'left' });
    const outline = layoutRuns([RUN_PLAIN('Away we go')], { ...OPTS_OUT, maxWidth: 200 });

    // This is what lets the threshold depend on zoom: crossing it must not
    // move a single glyph, or text reflows under the user's cursor.
    expect(outline.bounds).toEqual(atlas.bounds);
    expect(outline.lines).toEqual(atlas.lines);
    expect(outline.decorations).toEqual(atlas.decorations);
  });

  it('advances the pen by the same step on either tier', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const atlas = layoutRuns([RUN_PLAIN('AAA')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const outline = layoutRuns([RUN_PLAIN('AAA')], OPTS_OUT);

    // The absolute numbers differ by the glyph's left side bearing — an atlas
    // quad starts at the ink, an outline starts at the pen — but the step
    // between two of the same glyph is the advance, and that must match.
    const step = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i]);
    expect(step(outline.groups[0].glyphs.map((g) => g.x)))
      .toEqual(step(atlas.groups[0].quads.map((q) => q.x0)));
  });

  it('declines outlines for a synthetically emboldened run', async () => {
    // The regular atlas is thickened by an SDF threshold shift; a path has no
    // threshold, so painting the real outline would make text get *lighter*
    // above the tier boundary.
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutRuns([RUN_BOLD('A')], OPTS_OUT);
    expect(out.groups[0].source).toBe('atlas');
    expect(out.groups[0].synthetic.bold).toBe(true);
  });

  it('accepts outlines for a synthetically obliqued run — a shear is exact', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutRuns([RUN_ITALIC('A')], OPTS_OUT);
    expect(out.groups[0].source).toBe('outline');
    expect(out.groups[0].synthetic).toEqual({ bold: false, italic: true });
  });

  it('falls back to the SDF tier when the face has no outlines registered', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_PLAIN('AB')], OPTS_OUT);
    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
  });

  it('keys each glyph tessellation by face and codepoint', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutRuns([RUN_PLAIN('AA B')], OPTS_OUT);
    const keys = out.groups[0].glyphs.map((g) => g.key);
    expect(keys[0]).toBe('inter|400|normal|65');
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toBe('inter|400|normal|66');
  });

  it('keeps outline and atlas glyphs in separate groups, so each is one draw call', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    // Two runs of the same face and fill at different sizes, one either side
    // of the threshold.
    const small: ResolvedRun = { ...RUN_PLAIN('A'), fontSize: 10 };
    const out = layoutRuns([small, RUN_PLAIN('B')], OPTS_OUT);
    expect(out.groups.map((g) => g.source).sort()).toEqual(['atlas', 'outline']);
  });
});

/**
 * The outline tier as a *metrics* source, not a paint upgrade.
 *
 * Every other test here registers an atlas first, because until now that was
 * the only way a family could resolve at all. A consumer holding font bytes
 * and nothing else — no bake step, no `registerFont` — is the case this
 * covers.
 */
describe('layoutRuns from a font face alone', () => {
  const OUTLINE_D = 'M0 0L0.5 -0.7L1 0Z';

  /** Metrics chosen so every assertion below is exact: 0.5em per glyph,
   *  0.25em for a space, and one kerned pair. */
  function registerFaceOnly(family: string): void {
    registerFontOutlines(family, { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
      parser: () => ({
        unitsPerEm: 1000,
        ascender: 0.8,
        advanceOf: (cp: number) => (cp === 32 ? 0.25 : 0.5),
        // 'AV' only, so an unkerned pair proves the lookup is per-pair.
        kernOf: (l: number, r: number) => (l === 65 && r === 86 ? -0.1 : 0),
        glyphD: (cp: number) => (cp === 32 ? null : OUTLINE_D),
      }),
    });
  }

  /** The registry answers `null` until the (async) load lands. */
  async function settle(family: string): Promise<void> {
    glyphOutline(family, 400, 'normal', 65);
    await new Promise((r) => setTimeout(r, 0));
  }

  function runsOf(text: string, family: string, fontSize: number): ResolvedRun[] {
    return resolveRuns([{ text }], resolveTextStyle({ fontFamily: family, fontSize }));
  }

  it('lays out with no atlas registered at all', async () => {
    const family = 'face-only';
    registerFaceOnly(family);
    await settle(family);

    const out = layoutRuns(runsOf('AB', family, 100), {
      maxWidth: Infinity, lineHeight: 1.2, align: 'left',
    });

    // Two glyphs at 0.5em of a 100-unit em.
    expect(out.bounds.width).toBeCloseTo(100, 5);
    expect(out.lines).toHaveLength(1);
    // Baseline is the face's ascender, not an atlas's `common.base`.
    expect(out.lines[0].baselineY).toBeCloseTo(80, 5);

    // One group, on the outline tier, carrying geometry and no quads.
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].source).toBe('outline');
    expect(out.groups[0].quads).toHaveLength(0);
    expect(out.groups[0].glyphs.map((g) => g.x)).toEqual([0, 50]);
    expect(out.groups[0].glyphs[0].scale).toBe(100);
  });

  it('kerns from the face, per pair', async () => {
    const family = 'face-kern';
    registerFaceOnly(family);
    await settle(family);

    const kerned = layoutRuns(runsOf('AV', family, 100), {
      maxWidth: Infinity, lineHeight: 1.2, align: 'left',
    });
    const plain = layoutRuns(runsOf('AB', family, 100), {
      maxWidth: Infinity, lineHeight: 1.2, align: 'left',
    });

    // -0.1em pulls the second glyph in, and the line width follows it.
    expect(kerned.groups[0].glyphs.map((g) => g.x)).toEqual([0, 40]);
    expect(kerned.bounds.width).toBeCloseTo(90, 5);
    expect(plain.bounds.width).toBeCloseTo(100, 5);
  });

  it('wraps on the face\'s own advances', async () => {
    const family = 'face-wrap';
    registerFaceOnly(family);
    await settle(family);

    // 'AB' is 100 wide, a space 25: two words fit in 225, not in 200.
    const wide = layoutRuns(runsOf('AB AB', family, 100), {
      maxWidth: 225, lineHeight: 1.2, align: 'left',
    });
    const narrow = layoutRuns(runsOf('AB AB', family, 100), {
      maxWidth: 200, lineHeight: 1.2, align: 'left',
    });

    expect(wide.lines).toHaveLength(1);
    expect(narrow.lines).toHaveLength(2);
  });

  it('needs no outlineMinSize — there is no tier below it to prefer', async () => {
    const family = 'face-nogate';
    registerFaceOnly(family);
    await settle(family);

    // The gate exists to keep small text on an SDF tier. This family has none,
    // so gating it would paint nothing.
    const out = layoutRuns(runsOf('A', family, 8), {
      maxWidth: Infinity, lineHeight: 1.2, align: 'left',
    });

    expect(out.groups[0].glyphs).toHaveLength(1);
  });
});

describe('layoutRuns — baseline shift', () => {
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
  const SHIFTED = (text: string, baselineShift: number): ResolvedRun =>
    ({ ...RUN_PLAIN(text), baselineShift });

  it('raises a run off the line baseline without moving its neighbours', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_PLAIN('A'), SHIFTED('B', 10)], OPTS);
    const quads = out.groups.flatMap((g) => g.quads);
    expect(quads.map((q) => q.baselineY)).toEqual([29, 19]);
    // The line itself is unmoved: its box still reports the shared baseline,
    // so a shifted run rides the line rather than reflowing it.
    expect(out.lines[0].baselineY).toBe(29);
    expect(out.lines[0].y0).toBe(0);
    expect(out.bounds.height).toBeCloseTo(32 * 1.2, 6);
  });

  it('lowers on a negative shift, and moves the glyph ink with the baseline', async () => {
    await registerFixture('inter', [{}]);
    const plain = layoutRuns([RUN_PLAIN('A')], OPTS).groups[0].quads[0];
    const down = layoutRuns([SHIFTED('A', -8)], OPTS).groups[0].quads[0];
    expect(down.baselineY - plain.baselineY).toBeCloseTo(8, 6);
    expect(down.y0 - plain.y0).toBeCloseTo(8, 6);
    expect(down.y1 - plain.y1).toBeCloseTo(8, 6);
    // Purely vertical — a shift buys no horizontal advance.
    expect(down.x0).toBeCloseTo(plain.x0, 6);
    expect(down.x1).toBeCloseTo(plain.x1, 6);
  });

  it('does not let a shift feed back into the line it is measured against', async () => {
    await registerFixture('inter', [{}]);
    // A lone raised run would drag the baseline up with it if the line's
    // ascent were computed from shifted positions.
    const out = layoutRuns([SHIFTED('A', 25)], OPTS);
    expect(out.lines[0].baselineY).toBe(29);
    expect(out.groups[0].quads[0].baselineY).toBe(4);
  });

  it('carries a shifted run’s own decoration rules with it', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [{ ...RUN_PLAIN('A'), underline: true, baselineShift: 10 }],
      OPTS,
    );
    expect(out.decorations).toHaveLength(1);
    // Baseline 29 raised to 19, plus the 0.10-em underline offset at size 32.
    expect(out.decorations[0].y0).toBeCloseTo(19 + 3.2, 6);
  });

  it('does not merge a decorated span across a baseline shift', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [
        { ...RUN_PLAIN('A'), underline: true },
        { ...RUN_PLAIN('B'), underline: true, baselineShift: 10 },
      ],
      OPTS,
    );
    // Same size, same fill, same flags — only the baseline differs, which is
    // exactly the guard `fontSize` alone cannot stand in for.
    expect(out.decorations).toHaveLength(2);
    expect(out.decorations[0].y0 - out.decorations[1].y0).toBeCloseTo(10, 6);
  });

  it('shifts outline geometry the same way it shifts quads', async () => {
    await registerFixture('inter', [{}]);
    registerFontOutlines('inter', { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
      parser: () => ({
        unitsPerEm: 1000, ascender: 0.8,
        advanceOf: () => 0.6, kernOf: () => 0,
        glyphD: () => 'M0 0L0.5 -0.7L1 0Z',
      }),
    });
    glyphOutline('inter', 400, 'normal', 65);
    await new Promise((r) => setTimeout(r, 0));

    const opts = { ...OPTS, outlineMinSize: 20 };
    const plain = layoutRuns([RUN_PLAIN('A')], opts);
    const raised = layoutRuns([SHIFTED('A', 12)], opts);
    const a = plain.groups.find((g) => g.source === 'outline')!.glyphs[0];
    const b = raised.groups.find((g) => g.source === 'outline')!.glyphs[0];
    expect(a.baselineY - b.baselineY).toBeCloseTo(12, 6);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.scale).toBe(a.scale);
  });
});

describe('layoutRuns — overline', () => {
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };

  it('places a rule above the ascent, spanning the run advance', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([{ ...RUN_PLAIN('A'), overline: true }], OPTS);
    expect(out.decorations).toHaveLength(1);
    const [rule] = out.decorations;
    expect(rule.kind).toBe('overline');
    // Baseline 29, less the 0.90-em offset at size 32.
    expect(rule.y0).toBeCloseTo(29 - 28.8, 6);
    expect(rule.y1 - rule.y0).toBeCloseTo(0.05 * 32, 6);
    expect(rule.x0).toBeCloseTo(0, 6);
    expect(rule.x1).toBeCloseTo(23, 6);
    // Above the glyph it decorates, which is the whole point.
    expect(rule.y1).toBeLessThan(out.groups[0].quads[0].y0);
  });

  it('emits all three rules for one span, underline then strikethrough then overline', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [{ ...RUN_PLAIN('A'), underline: true, strikethrough: true, overline: true }],
      OPTS,
    );
    expect(out.decorations.map((d) => d.kind))
      .toEqual(['underline', 'strikethrough', 'overline']);
    // Ordered down the page: overline highest, underline lowest.
    const [under, strike, over] = out.decorations;
    expect(over.y0).toBeLessThan(strike.y0);
    expect(strike.y0).toBeLessThan(under.y0);
  });

  it('does not merge an overlined span with a merely underlined one', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [{ ...RUN_PLAIN('A'), underline: true },
       { ...RUN_PLAIN('B'), underline: true, overline: true }],
      OPTS,
    );
    expect(out.decorations.map((d) => d.kind))
      .toEqual(['underline', 'underline', 'overline']);
  });
});
