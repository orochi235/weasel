import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerFont,
  FIXTURE_FONT,
  registerCanvasFont,
  registerFontOutlines,
  glyphOutline,
} from '@weasel-js/font';
import {
  _resetFontRegistryForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { ResolvedRun } from '../runs/resolveRuns';
import { stubFetch, registerFixture, registerTallFont, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — single line', () => {
  it('positions glyphs across runs on the same baseline with kerning carrying through', async () => {
    await registerFixture('inter', [{}]);
    const single = layoutAndPaint([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const split = layoutAndPaint([RUN_PLAIN('A'), RUN_PLAIN('B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const singleX = single.groups[0].quads.map((q) => q.x0);
    const splitX = split.groups.flatMap((g) => g.quads.map((q) => q.x0)).sort((a, b) => a - b);
    expect(splitX).toEqual(singleX);
  });

  it('records the typographic baseline (not the line-box top) on each quad', async () => {
    await registerFixture('inter', [{}]);
    // FIXTURE_FONT: info.size=32, common.base=29.
    // RUN_PLAIN: fontSize=32 → scale=1, so the baseline sits 29 below the
    // line-box top — which, layout being origin-relative, is y = 0.
    const out = layoutAndPaint(
      [RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    expect(out.groups[0].quads[0].baselineY).toBe(29);
  });
});

describe('layoutRuns — word wrap', () => {
  it('mixed-size runs share a baseline on the same line', async () => {
    await registerFixture('inter', [{}]);
    const small: ResolvedRun = { ...RUN_PLAIN('A'), fontSize: 16 };
    const big: ResolvedRun = { ...RUN_PLAIN('B'), fontSize: 40 };
    const out = layoutAndPaint(
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
    const bigFirst = layoutAndPaint([big, small], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const bigLast = layoutAndPaint([small, big], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
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
    const out = layoutAndPaint(
      [RUN_PLAIN('A'), { ...RUN_PLAIN('B'), fontFamily: 'tall' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    const baselines = out.groups.flatMap((g) => g.quads).map((q) => q.baselineY);
    expect(baselines).toHaveLength(2);
    expect(new Set(baselines).size).toBe(1);
    expect(baselines[0]).toBeCloseTo(58, 6);
  });
});

describe('layoutRuns — baseline shift', () => {
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
  const SHIFTED = (text: string, baselineShift: number): ResolvedRun =>
    ({ ...RUN_PLAIN(text), baselineShift });

  it('raises a run off the line baseline without moving its neighbours', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('A'), SHIFTED('B', 10)], OPTS);
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
    const plain = layoutAndPaint([RUN_PLAIN('A')], OPTS).groups[0].quads[0];
    const down = layoutAndPaint([SHIFTED('A', -8)], OPTS).groups[0].quads[0];
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
    const out = layoutAndPaint([SHIFTED('A', 25)], OPTS);
    expect(out.lines[0].baselineY).toBe(29);
    expect(out.groups[0].quads[0].baselineY).toBe(4);
  });

  it('keeps the line a shrunken run would have had at its strut size', async () => {
    await registerFixture('inter', [{}]);
    // Half size and raised, but held open at the inherited 32: the line is the
    // one a plain run at 32 lays out, so a superscript alone on its line does
    // not shrink the line under it.
    const small: ResolvedRun = { ...RUN_PLAIN('A'), fontSize: 16, baselineShift: 10, strutSize: 32 };
    const out = layoutAndPaint([small], OPTS);
    const plain = layoutAndPaint([RUN_PLAIN('A')], OPTS);
    expect(out.lines[0].baselineY).toBe(plain.lines[0].baselineY);
    expect(out.bounds.height).toBeCloseTo(32 * 1.2, 6);
    expect(out.groups[0].quads[0].baselineY).toBe(plain.lines[0].baselineY - 10);
  });

  it('carries a shifted run’s own decoration rules with it', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint(
      [{ ...RUN_PLAIN('A'), underline: true, baselineShift: 10 }],
      OPTS,
    );
    expect(out.decorations).toHaveLength(1);
    // Baseline 29 raised to 19, plus the 0.10-em underline offset at size 32.
    expect(out.decorations[0].y0).toBeCloseTo(19 + 3.2, 6);
  });

  it('does not merge a decorated span across a baseline shift', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint(
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
    const plain = layoutAndPaint([RUN_PLAIN('A')], opts);
    const raised = layoutAndPaint([SHIFTED('A', 12)], opts);
    const a = plain.groups.find((g) => g.source === 'outline')!.glyphs[0];
    const b = raised.groups.find((g) => g.source === 'outline')!.glyphs[0];
    expect(a.baselineY - b.baselineY).toBeCloseTo(12, 6);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.scale).toBe(a.scale);
  });
});

describe('layoutRuns — a run built without a baselineShift', () => {
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };

  // `resolveRuns` always sets the field, but `layoutRuns` takes `ResolvedRun[]`
  // and callers do hand-build them. Absent it the subtraction went NaN, and
  // only on the vertical axis: x and the UVs stayed correct, so the glyphs drew
  // as zero-area quads and the text reported as "rendered nothing" with no GL
  // error and nothing in the console. The perf suite ran that way for a week.
  it('lays the run out on the baseline rather than at NaN', async () => {
    await registerFixture('inter', [{ weight: 400 }]);
    const run = {
      text: 'AB', fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
      fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
      underline: false, strikethrough: false, overline: false,
    } as unknown as ResolvedRun;

    const quads = layoutAndPaint([run], OPTS).groups.flatMap((g) => g.quads);
    expect(quads.length).toBeGreaterThan(0);
    for (const q of quads) {
      expect(Number.isFinite(q.y0)).toBe(true);
      expect(Number.isFinite(q.y1)).toBe(true);
      expect(Number.isFinite(q.baselineY)).toBe(true);
      expect(q.y1).toBeGreaterThan(q.y0);
    }
  });
});

// A face's stated ascent and descent place its baseline the way CSS does:
// half the line box's leading above the ascent, and when ascent plus descent
// outgrow the line box the leading goes negative rather than the box growing.
describe('layoutRuns — baseline from the face ascent and descent', () => {
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
  /** CSS's baseline for a line box `lh` tall around a face of ascent `a` and descent `d`. */
  const cssBaseline = (lh: number, a: number, d: number) => (lh - a - d) / 2 + a;

  async function registerAtlas(family: string, faceMetrics: object): Promise<void> {
    const prior = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => url.endsWith(`${family}.json`)
      ? Promise.resolve({ ok: true, json: () => Promise.resolve({ ...FIXTURE_FONT, faceMetrics }) })
      : (prior as unknown as (u: string) => unknown)(url)) as typeof fetch;
    await registerFont(family, {}, `/fonts/${family}.json`, `/fonts/${family}.png`);
    global.fetch = prior;
  }

  it('puts an atlas face at half-leading plus its ascent', async () => {
    await registerAtlas('stated', { ascent: 0.9, descent: 0.2 });
    const out = layoutAndPaint([{ ...RUN_PLAIN('AB'), fontFamily: 'stated' }], OPTS);
    expect(out.lines[0].baselineY).toBeCloseTo(32 * cssBaseline(1.2, 0.9, 0.2), 6);
    // The glyph quads hang off that baseline, in the atlas's own frame.
    expect(out.groups[0].quads[0].baselineY).toBeCloseTo(out.lines[0].baselineY, 6);
    expect(out.groups[0].quads[0].y0).toBeCloseTo(out.lines[0].baselineY + (4 - 29), 6);
  });

  it('lets the leading go negative when ascent and descent outgrow the line box', async () => {
    // Papyrus on macOS: 0.938 + 0.604 = 1.542 em in a 1.2 em line.
    await registerAtlas('papyrus', { ascent: 0.938, descent: 0.604 });
    const out = layoutAndPaint([{ ...RUN_PLAIN('AB\nAB'), fontFamily: 'papyrus' }], OPTS);
    expect(out.lines[0].baselineY).toBeCloseTo(32 * cssBaseline(1.2, 0.938, 0.604), 6);
    expect(out.lines[0].baselineY).toBeLessThan(32 * 0.938);
    // The line box keeps its height; the glyphs overflow it instead.
    expect(out.lines[0].y1 - out.lines[0].y0).toBeCloseTo(32 * 1.2, 6);
    expect(out.lines[1].baselineY - out.lines[0].baselineY).toBeCloseTo(32 * 1.2, 6);
  });

  it('shares one baseline across sizes, set by the run reaching highest above it', async () => {
    await registerAtlas('stated', { ascent: 0.9, descent: 0.2 });
    const small = { ...RUN_PLAIN('A'), fontFamily: 'stated', fontSize: 16 };
    const big = { ...RUN_PLAIN('B'), fontFamily: 'stated', fontSize: 40 };
    const out = layoutAndPaint([small, big], OPTS);
    expect(out.lines[0].baselineY).toBeCloseTo(40 * cssBaseline(1.2, 0.9, 0.2), 6);
    expect(new Set(out.groups.flatMap((g) => g.quads).map((q) => q.baselineY)).size).toBe(1);
  });

  it('puts an outline face on the same baseline as an atlas stating the same metrics', async () => {
    await registerAtlas('stated', { ascent: 0.9, descent: 0.2 });
    registerFontOutlines('outlined', {}, new ArrayBuffer(4), {
      parser: () => ({
        unitsPerEm: 1000, ascender: 0.9, faceMetrics: { ascent: 0.9, descent: 0.2 },
        advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 0L1 0L1 -1Z',
      }),
    });
    glyphOutline('outlined', 400, 'normal', 65);
    await new Promise<void>((r) => setTimeout(r, 0));
    const outline = layoutAndPaint([{ ...RUN_PLAIN('AB'), fontFamily: 'outlined' }], { ...OPTS, outlineMinSize: 20 });
    const atlas = layoutAndPaint([{ ...RUN_PLAIN('AB'), fontFamily: 'stated' }], OPTS);
    expect(outline.groups[0].source).toBe('outline');
    expect(outline.lines[0].baselineY).toBeCloseTo(atlas.lines[0].baselineY, 6);
  });

  it('places a canvas face by the browser ascent and descent', () => {
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({ width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: 0, top: 26, advance: 22 }),
    });
    registerCanvasFont('DynMetrics');
    const out = layoutAndPaint([{ ...RUN_PLAIN('A'), fontFamily: 'DynMetrics', fontSize: 24 }], OPTS);
    // 40 and 8 at the 48px bake size.
    expect(out.lines[0].baselineY).toBeCloseTo(24 * cssBaseline(1.2, 40 / 48, 8 / 48), 6);
  });
});
