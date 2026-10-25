import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetBakeBudget, registerFontOutlines, glyphOutline, setFontFallbackPolicy, syntheticBoldGrowth,
} from '@weasel-js/font';
import { boundsOfPath, pathFromD } from '@weasel-js/geom';
import {
  _resetFontRegistryForTests,
  _resetFallbackForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
  _resetFontOutlinesForTests,
} from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { ResolvedRun } from '../runs/resolveRuns';
import { stubFetch, registerFixture, RUN_PLAIN, RUN_BOLD, RUN_ITALIC } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
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

    const out = layoutAndPaint([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
    expect(out.groups[0].glyphs).toEqual([]);
  });

  it('emits an outline group at or above the threshold', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutAndPaint([RUN_PLAIN('AB')], OPTS_OUT);
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].source).toBe('outline');
    expect(out.groups[0].quads).toEqual([]);
    expect(out.groups[0].glyphs).toHaveLength(2);
    expect(out.groups[0].glyphs[0].d).toBe(OUTLINE_D);
    // Em space is unit-scale, so world units per em is the run's own size.
    expect(out.groups[0].glyphs[0].scale).toBe(32);
  });

  it('draws a character an outline-only face lacks from the dynamic tier, as an atlas run does', async () => {
    _resetDynamicFontsForTests();
    _resetFallbackForTests();
    resetBakeBudget();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
        left: -8, top: 26, advance: 24,
      }),
    });
    registerFontOutlines('solo', { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
      parser: () => ({
        unitsPerEm: 1000, ascender: 0.8, kernOf: () => 0,
        advanceOf: (cp: number) => (cp === 65 ? 0.6 : null),
        glyphD: (cp: number) => (cp === 65 ? OUTLINE_D : null),
      }),
    });
    glyphOutline('solo', 400, 'normal', 65);
    await new Promise<void>((r) => setTimeout(r, 0));

    const out = layoutAndPaint([{ ...RUN_PLAIN('A\u2014'), fontFamily: 'solo' }], OPTS_OUT);
    expect(out.groups.map((g) => [g.source, g.glyphs.length, g.quads.length]))
      .toEqual([['outline', 1, 0], ['canvas', 0, 1]]);
    const [a, dash] = out.lines[0].cells;
    // Baked at 48px and set at 32.
    expect(dash.advance).toBeCloseTo(24 * (32 / 48), 10);
    expect(dash.x).toBeCloseTo(a.x + a.advance, 10);
    const quad = out.groups[1].quads[0];
    expect(quad.baselineY - quad.y0).toBeCloseTo(26 * (32 / 48), 10);
  });

  it('draws a color cluster as its one quad, not the outlines of the code points leading it', async () => {
    _resetDynamicFontsForTests();
    _resetFallbackForTests();
    resetBakeBudget();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
        left: -8, top: 26, advance: 24,
      }),
      rasterizeColor: () => ({
        width: 60, height: 60, rgba: new Uint8ClampedArray(60 * 60 * 4).fill(255), left: -6, top: 50, advance: 48,
      }),
    });
    registerFontOutlines('solo', { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
      parser: () => ({
        unitsPerEm: 1000, ascender: 0.8, kernOf: () => 0,
        advanceOf: () => 0.6, glyphD: () => OUTLINE_D,
      }),
    });
    glyphOutline('solo', 400, 'normal', 65);
    await new Promise<void>((r) => setTimeout(r, 0));

    // A keycap: the digit, VS16, then the enclosing keycap mark.
    const out = layoutAndPaint([{ ...RUN_PLAIN('A1️⃣'), fontFamily: 'solo' }], OPTS_OUT);
    expect(out.lines[0].cells.map((c) => c.drawsInk)).toEqual([true, false, false, true]);
    expect(out.groups.map((g) => [g.source, g.glyphs.length, g.quads.length]))
      .toEqual([['outline', 1, 0], ['color', 0, 1]]);
    expect(out.groups[0].glyphs[0].key.split('|').at(-1)).toBe('65');
  });

  it('draws nothing in a slot the layout left empty, though the outline face has the glyph', async () => {
    _resetFallbackForTests();
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');
    // The atlas has no em dash and nothing may stand in for it, so its slot is empty and zero wide.
    setFontFallbackPolicy('none');

    const out = layoutAndPaint([RUN_PLAIN('A\u2014B')], OPTS_OUT);
    _resetFallbackForTests();
    expect(out.lines[0].cells.map((c) => c.drawsInk)).toEqual([true, false, true]);
    expect(out.groups.flatMap((g) => g.glyphs).map((g) => g.key.split('|').at(-1))).toEqual(['65', '66']);
  });

  it('stays on the SDF tier below the threshold', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutAndPaint([RUN_PLAIN('AB')], { ...OPTS_OUT, outlineMinSize: 48 });
    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
  });

  it('escalates a stroked run below the threshold, since the SDF tiers cannot stroke', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const stroked: ResolvedRun = {
      ...RUN_PLAIN('AB'),
      stroke: { paint: { kind: 'solid', color: '#f00' }, width: 2 },
    };
    const out = layoutAndPaint([stroked], { ...OPTS_OUT, outlineMinSize: 48 });

    expect(out.groups.map((g) => g.source)).toEqual(['outline']);
    expect(out.groups[0].stroke).toMatchObject({ width: 2 });
  });

  it('carries an unfilled run to the outline tier with its geometry and no fill', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const outlineOnly: ResolvedRun = {
      ...RUN_PLAIN('AB'),
      fill: null,
      stroke: { paint: { kind: 'solid', color: '#f00' }, width: 2 },
    };
    const out = layoutAndPaint([outlineOnly], OPTS_OUT);

    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].source).toBe('outline');
    expect(out.groups[0].fill).toBeNull();
    expect(out.groups[0].glyphs).toHaveLength(2);
    expect(out.groups[0].stroke).toMatchObject({ width: 2 });
  });

  it('emits nothing for a run with neither fill nor stroke', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    // Above the threshold there is geometry to be had, and below it there are
    // quads — an unpainted run must allocate neither.
    for (const opts of [OPTS_OUT, { ...OPTS_OUT, outlineMinSize: 48 }]) {
      const out = layoutAndPaint([{ ...RUN_PLAIN('AB'), fill: null }], opts);
      expect(out.groups).toEqual([]);
      // The line still measures the same: paint does not move a glyph.
      expect(out.bounds).toEqual(layoutAndPaint([RUN_PLAIN('AB')], opts).bounds);
    }
  });

  it('emits nothing for a fill that holds no paint, which paints nothing', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    for (const opts of [OPTS_OUT, { ...OPTS_OUT, outlineMinSize: 48 }]) {
      const out = layoutAndPaint([{ ...RUN_PLAIN('AB'), fill: {}, underline: true }], opts);
      expect(out.groups).toEqual([]);
      expect(out.decorations).toEqual([]);
    }
  });

  it('emits no quads for an unfilled run the outline tier cannot serve', async () => {
    await registerFixture('inter', [{}]);

    // No outlines registered, so the stroke has no geometry to ride — and a
    // textured quad would paint the fill that was refused.
    const out = layoutAndPaint([{
      ...RUN_PLAIN('AB'),
      fill: null,
      stroke: { paint: { kind: 'solid', color: '#f00' }, width: 2 },
    }], OPTS_OUT);
    expect(out.groups).toEqual([]);
  });

  it('drops an unfilled run\'s decoration rules, which have only a fill to paint', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutAndPaint([{
      ...RUN_PLAIN('AB'),
      fill: null,
      underline: true,
      strikethrough: true,
      stroke: { paint: { kind: 'solid', color: '#f00' }, width: 2 },
    }], OPTS_OUT);
    expect(out.decorations).toEqual([]);
    // Still the same underlined-run shape otherwise: filled text keeps both.
    expect(layoutAndPaint([{ ...RUN_PLAIN('AB'), underline: true }], OPTS_OUT).decorations)
      .toHaveLength(1);
  });

  it('leaves a zero-width stroke below the threshold on the SDF tier', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const hairless: ResolvedRun = {
      ...RUN_PLAIN('AB'),
      stroke: { paint: { kind: 'solid', color: '#f00' }, width: 0 },
    };
    const out = layoutAndPaint([hairless], { ...OPTS_OUT, outlineMinSize: 48 });

    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
  });

  it('does not escalate a stroked run when the caller opted out of outlines', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const stroked: ResolvedRun = {
      ...RUN_PLAIN('AB'),
      stroke: { paint: { kind: 'solid', color: '#f00' }, width: 2 },
    };
    const out = layoutAndPaint([stroked], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });

    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
  });

  it('places outline glyphs at the pen and the baseline, not the quad corner', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const atlas = layoutAndPaint([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const outline = layoutAndPaint([RUN_PLAIN('AB')], OPTS_OUT);

    // The atlas quad carries the glyph's own baseline; an outline glyph's
    // origin IS that baseline, and its x is the pen — which for the first
    // glyph of a left-aligned line is 0.
    expect(outline.groups[0].glyphs[0].x).toBe(0);
    expect(outline.groups[0].glyphs[0].baselineY).toBe(atlas.groups[0].quads[0].baselineY);
  });

  it('is metric-neutral: bounds, lines and advances are identical either way', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const atlas = layoutAndPaint([RUN_PLAIN('Away we go')], { maxWidth: 200, lineHeight: 1.2, align: 'left' });
    const outline = layoutAndPaint([RUN_PLAIN('Away we go')], { ...OPTS_OUT, maxWidth: 200 });

    // This is what lets the threshold depend on zoom: crossing it must not
    // move a single glyph, or text reflows under the user's cursor.
    expect(outline.bounds).toEqual(atlas.bounds);
    expect(outline.lines).toEqual(atlas.lines);
    expect(outline.decorations).toEqual(atlas.decorations);
  });

  it('advances the pen by the same step on either tier', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const atlas = layoutAndPaint([RUN_PLAIN('AAA')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const outline = layoutAndPaint([RUN_PLAIN('AAA')], OPTS_OUT);

    // The absolute numbers differ by the glyph's left side bearing — an atlas
    // quad starts at the ink, an outline starts at the pen — but the step
    // between two of the same glyph is the advance, and that must match.
    const step = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i]);
    expect(step(outline.groups[0].glyphs.map((g) => g.x)))
      .toEqual(step(atlas.groups[0].quads.map((q) => q.x0)));
  });

  it('draws a synthetically emboldened run on the outline tier, grown as the field draws it', async () => {
    // The atlas thickens a faked bold by a threshold shift, so the face's own
    // outline would get lighter past the threshold: the tier grows it first.
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutAndPaint([RUN_BOLD('A')], OPTS_OUT);
    expect(out.groups.map((g) => g.source)).toEqual(['outline']);
    expect(out.groups[0].synthetic.bold).toBe(true);
    const glyph = out.groups[0].glyphs[0];
    const growth = syntheticBoldGrowth('atlas', 'inter', 400, 'normal')!;
    expect(growth).toBeGreaterThan(0);
    // The stub's base runs along the baseline, so a grown edge sits `growth` below it.
    const b = boundsOfPath(pathFromD(glyph.d));
    expect(b.y + b.height).toBeCloseTo(growth, 9);
    // Placement is the regular glyph's: growing paints, it does not move.
    const regular = layoutAndPaint([RUN_PLAIN('A')], OPTS_OUT).groups[0].glyphs[0];
    expect([glyph.x, glyph.baselineY, glyph.scale]).toEqual([regular.x, regular.baselineY, regular.scale]);
  });

  it('keys a grown glyph apart from the face\'s own, so neither tessellation serves the other', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const bold = layoutAndPaint([RUN_BOLD('A')], OPTS_OUT).groups[0].glyphs[0];
    const regular = layoutAndPaint([RUN_PLAIN('A')], OPTS_OUT).groups[0].glyphs[0];
    expect(bold.key).not.toBe(regular.key);
    expect(bold.key.startsWith('inter|400|normal|65|')).toBe(true);
  });

  it('keeps a synthetically emboldened run below the threshold on the SDF tier', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutAndPaint([{ ...RUN_BOLD('A'), fontSize: 10 }], OPTS_OUT);
    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
  });

  it('strokes a synthetically emboldened run on the outline tier at any size', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const stroked: ResolvedRun = {
      ...RUN_BOLD('A'),
      fontSize: 10,
      stroke: { paint: { kind: 'solid', color: '#f00' }, width: 2 },
    };
    const out = layoutAndPaint([stroked], OPTS_OUT);
    expect(out.groups.map((g) => g.source)).toEqual(['outline']);
    expect(out.groups[0].stroke).toMatchObject({ width: 2 });
    expect(out.groups[0].glyphs[0].d).toBe(layoutAndPaint([RUN_BOLD('A')], OPTS_OUT).groups[0].glyphs[0].d);
  });

  it('accepts outlines for a synthetically obliqued run — a shear is exact', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutAndPaint([RUN_ITALIC('A')], OPTS_OUT);
    expect(out.groups[0].source).toBe('outline');
    expect(out.groups[0].synthetic).toEqual({ bold: false, italic: true });
  });

  it('falls back to the SDF tier when the face has no outlines registered', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AB')], OPTS_OUT);
    expect(out.groups.map((g) => g.source)).toEqual(['atlas']);
  });

  it('keys each glyph tessellation by face and codepoint', async () => {
    await registerFixture('inter', [{}]);
    await registerOutlines('inter');

    const out = layoutAndPaint([RUN_PLAIN('AA B')], OPTS_OUT);
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
    const out = layoutAndPaint([small, RUN_PLAIN('B')], OPTS_OUT);
    expect(out.groups.map((g) => g.source).sort()).toEqual(['atlas', 'outline']);
  });
});
