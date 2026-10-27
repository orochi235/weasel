import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import { resolveRuns, type ResolvedRun } from '../runs/resolveRuns';
import { DEFAULT_TEXT_FILL, resolveTextStyle } from '../textStyle';
import { stubFetch, registerFixture, registerTallFont, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
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
    const out = layoutAndPaint([RUN_PLAIN('AB')], OPTS);
    expect(out.decorations).toEqual([]);
  });

  it('places an underline rule below the baseline, spanning the run advance', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([UNDERLINED('A')], OPTS);
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
    const out = layoutAndPaint([{ ...RUN_PLAIN('A'), strikethrough: true }], OPTS);
    expect(out.decorations).toHaveLength(1);
    const d = out.decorations[0];
    expect(d.kind).toBe('strikethrough');
    expect(d.y0).toBeCloseTo(STRIKE_Y0, 6);
    expect(d.y1 - d.y0).toBeCloseTo(THICKNESS, 6);
    expect(d.y1).toBeLessThan(BASELINE);
  });

  it('emits both rules for a run carrying both flags', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([{ ...RUN_PLAIN('A'), underline: true, strikethrough: true }], OPTS);
    expect(out.decorations.map((d) => d.kind)).toEqual(['underline', 'strikethrough']);
    // One span, two rules: same horizontal extent.
    expect(out.decorations[0].x1).toBe(out.decorations[1].x1);
  });

  it('runs continuously across interior spaces, which emit no glyph quads', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([UNDERLINED('A B')], OPTS);
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
    const out = layoutAndPaint([{ ...UNDERLINED('A'), letterSpacing: 10 }], OPTS);
    // Tracking is applied after every glyph including the last (see the
    // layoutRuns header), so the rule is 23 + 10 wide, not 23.
    expect(out.decorations[0].x1).toBeCloseTo(33, 6);
  });

  it('covers trailing letter-spacing on every glyph of a merged span', async () => {
    await registerFixture('inter', [{}]);
    // The single-glyph case above only ever takes the branch that *opens* a
    // span. Tracking has to reach the branch that *extends* one too, which
    // needs a second glyph: A(23)+10 + kern(-1) + B(22)+10 = 64.
    const out = layoutAndPaint([{ ...UNDERLINED('AB'), letterSpacing: 10 }], OPTS);
    expect(out.decorations).toHaveLength(1);
    expect(out.decorations[0].x1).toBeCloseTo(64, 6);
  });

  it('merges adjacent runs that agree on decoration and fill into one rule', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([UNDERLINED('A'), UNDERLINED('B')], OPTS);
    expect(out.decorations).toHaveLength(1);
    // A(23) + kern(-1) + B(22) = 44. A seam at the run join would show as two
    // rects, or as one rect that skipped the kerning gap.
    expect(out.decorations[0].x0).toBeCloseTo(0, 6);
    expect(out.decorations[0].x1).toBeCloseTo(44, 6);
  });

  it('breaks the rule where the fill changes, so each piece takes its run colour', async () => {
    await registerFixture('inter', [{}]);
    const RED: ResolvedRun = { ...UNDERLINED('B'), fill: { paint: { kind: 'solid', color: '#f00' } } };
    const out = layoutAndPaint([UNDERLINED('A'), RED], OPTS);
    expect(out.decorations).toHaveLength(2);
    expect(out.decorations.map((d) => d.fill)).toEqual([
      { paint: { kind: 'solid', color: '#000' } },
      { paint: { kind: 'solid', color: '#f00' } },
    ]);
    // A's step takes the -1 kerning before B, so the pieces abut at B's pen.
    expect(out.decorations[0].x1).toBeCloseTo(22, 6);
    expect(out.decorations[1].x0).toBeCloseTo(22, 6);
  });

  it('does not merge across a font-size change, since offset and thickness scale', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint(
      [UNDERLINED('A'), { ...UNDERLINED('B'), fontSize: 16 }],
      OPTS,
      );
    expect(out.decorations).toHaveLength(2);
    expect(out.decorations[0].y1 - out.decorations[0].y0).toBeCloseTo(0.05 * 32, 6);
    expect(out.decorations[1].y1 - out.decorations[1].y0).toBeCloseTo(0.05 * 16, 6);
    // Mixed sizes share a line but not a baseline: base is 29 at scale 1,
    // 14.5 at scale 0.5.
    expect(out.decorations[0].y0).not.toBeCloseTo(out.decorations[1].y0, 3);
  });

  it('stops the rule at an undecorated run and starts a new one after it', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([UNDERLINED('A'), RUN_PLAIN('B'), UNDERLINED('A')], OPTS);
    expect(out.decorations).toHaveLength(2);
    expect(out.decorations[0].x1).toBeLessThan(out.decorations[1].x0);
  });

  it('emits one rule per line when a decorated span wraps', async () => {
    await registerFixture('inter', [{}]);
    // maxWidth 30: 'A' (23) fits; the trailing space takes the line to 31;
    // 'B' (22) would take it to 53, so it wraps.
    const out = layoutAndPaint([UNDERLINED('A B')], { ...OPTS, maxWidth: 30 });
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
    const out = layoutAndPaint([UNDERLINED('A')], { ...OPTS, maxWidth: 100, align: 'right' });
    expect(out.decorations[0].x0).toBeCloseTo(100 - 23, 6);
    expect(out.decorations[0].x1).toBeCloseTo(100, 6);
  });

  it('decorates a whitespace-only run, which contributes no glyph quads at all', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([UNDERLINED('A'), UNDERLINED(' ')], OPTS);
    expect(out.groups.flatMap((g) => g.quads)).toHaveLength(1);
    expect(out.decorations[0].x1).toBeCloseTo(31, 6);
  });

  it('does not merge an underlined run into an adjacent struck-through one', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint(
      [UNDERLINED('A'), { ...RUN_PLAIN('B'), strikethrough: true }],
      OPTS,
      );
    expect(out.decorations.map((d) => d.kind)).toEqual(['underline', 'strikethrough']);
    // The underline stops where B starts; it does not run on under B.
    expect(out.decorations[0].x1).toBeCloseTo(22, 6);
    expect(out.decorations[1].x0).toBeCloseTo(22, 6);
  });

  it('merges across a face whose ascent differs, now that the line shares a baseline', async () => {
    await registerFixture('inter', [{}]);
    await registerTallFont();
    // base 29 vs 58 at equal size: both runs sit on the deeper baseline, so
    // the rule runs on under the join instead of stepping 29 units down.
    const out = layoutAndPaint(
      [UNDERLINED('A'), { ...UNDERLINED('B'), fontFamily: 'tall' }],
      OPTS,
      );
    expect(out.decorations).toHaveLength(1);
    // Shared baseline 58, plus the 0.10-em underline offset at fontSize 32.
    expect(out.decorations[0].y0).toBeCloseTo(58 + 32 * 0.1, 6);
  });

  it('emits nothing for a span that advances nowhere', async () => {
    await registerFixture('inter', [{}]);
    // Tracking exactly cancels the advance, so the span is zero-width. A rect
    // with x1 === x0 rasterizes nothing; don't pay a draw call for it.
    const out = layoutAndPaint([{ ...UNDERLINED('A'), letterSpacing: -23 }], OPTS);
    expect(out.decorations).toEqual([]);
  });

  it('reaches layout through resolveRuns, additively over the node style', async () => {
    await registerFixture('inter', [{}]);
    const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 32, underline: true }, { fill: DEFAULT_TEXT_FILL });
    const out = layoutAndPaint(resolveRuns([{ text: 'A' }], style), OPTS);
    expect(out.decorations.map((d) => d.kind)).toEqual(['underline']);
  });
});

describe('layoutRuns — overline', () => {
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };

  it('places a rule above the ascent, spanning the run advance', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([{ ...RUN_PLAIN('A'), overline: true }], OPTS);
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
    const out = layoutAndPaint(
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
    const out = layoutAndPaint(
      [{ ...RUN_PLAIN('A'), underline: true },
       { ...RUN_PLAIN('B'), underline: true, overline: true }],
      OPTS,
    );
    expect(out.decorations.map((d) => d.kind))
      .toEqual(['underline', 'underline', 'overline']);
  });
});
