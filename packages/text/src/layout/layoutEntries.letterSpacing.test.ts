import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import { resolveRuns, type ResolvedRun } from '../runs/resolveRuns';
import { DEFAULT_TEXT_FILL, resolveTextStyle } from '../textStyle';
import { stubFetch, registerFixture, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — letterSpacing', () => {
  // FIXTURE_FONT at fontSize 32 (scale 1): A xadvance 23 / xoffset 1,
  // B xadvance 22 / xoffset 2, kerning A→B = -1.
  //   untracked 'AB': width 44, quad x0s [1, 24].
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
  // Emission order, deliberately unsorted — sorting would hide a bug that
  // reorders quads, and every case here lays out into a single group.
  const xs = (o: ReturnType<typeof layoutAndPaint>) =>
    o.groups.flatMap((g) => g.quads.map((q) => q.x0));

  it('adds tracking after every glyph, including the last', async () => {
    await registerFixture('inter', [{}]);
    const plain = layoutAndPaint([RUN_PLAIN('AB')], OPTS);
    const tracked = layoutAndPaint([{ ...RUN_PLAIN('AB'), letterSpacing: 4 }], OPTS);
    // Trailing tracking counts toward the measured width (matches CSS).
    expect(plain.bounds.width).toBeCloseTo(44);
    expect(tracked.bounds.width).toBeCloseTo(plain.bounds.width + 4 * 2);
    // ...and the glyphs actually move: the Nth glyph shifts by N * spacing.
    expect(xs(plain)).toEqual([1, 24]);
    expect(xs(tracked)).toEqual([1, 28]);
  });

  it('is a no-op at 0', async () => {
    await registerFixture('inter', [{}]);
    const a = layoutAndPaint([RUN_PLAIN('AB')], OPTS);
    const b = layoutAndPaint([{ ...RUN_PLAIN('AB'), letterSpacing: 0 }], OPTS);
    expect(b.bounds.width).toBe(a.bounds.width);
    expect(xs(b)).toEqual(xs(a));
  });

  it('is in world units — the same tracking shifts glyphs equally at any fontSize', async () => {
    await registerFixture('inter', [{}]);
    const at = (fontSize: number, letterSpacing: number) =>
      layoutAndPaint([{ ...RUN_PLAIN('AB'), fontSize, letterSpacing }], OPTS);
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
    const tight = layoutAndPaint([{ ...RUN_PLAIN('AB'), letterSpacing: -4 }], OPTS);
    expect(xs(tight)).toEqual([1, 20]);
    expect(tight.bounds.width).toBeCloseTo(36);
  });

  it('tracks spaces like any other character', async () => {
    await registerFixture('inter', [{}]);
    // Fixture has no space glyph → synthesized advance fontSize * 0.25 = 8.
    const plain = layoutAndPaint([RUN_PLAIN('A B')], OPTS);
    const tracked = layoutAndPaint([{ ...RUN_PLAIN('A B'), letterSpacing: 4 }], OPTS);
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
    const trackedFirst = layoutAndPaint(
      [{ ...RUN_PLAIN('A'), letterSpacing: 10 }, RUN_PLAIN('B')],
      OPTS,
      );
    const trackedSecond = layoutAndPaint(
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

  const lineCount = (o: ReturnType<typeof layoutAndPaint>) =>
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
      layoutAndPaint([{ ...RUN_PLAIN('AB AB'), letterSpacing }], wrapOpts);
    expect(lineCount(at(0))).toBe(1);
    expect(lineCount(at(10))).toBe(2);
  });

  it('counts toward wrapping, so tracked text breaks into more lines', async () => {
    await registerFixture('inter', [{}]);
    const wrapOpts = { maxWidth: 150, lineHeight: 1.2, align: 'left' as const };
    const text = 'AB AB AB AB AB AB';
    const plain = layoutAndPaint([RUN_PLAIN(text)], wrapOpts);
    const tracked = layoutAndPaint([{ ...RUN_PLAIN(text), letterSpacing: 10 }], wrapOpts);
    expect(lineCount(plain)).toBe(2);
    expect(lineCount(tracked)).toBe(3);
  });

  // A face with a zero-advance combining acute and two astral glyphs, so a
  // cluster of several code points can be measured end to end.
  const MARKS_FONT = {
    ...FIXTURE_FONT,
    chars: [
      ...FIXTURE_FONT.chars,
      { id: 0x301, x: 50, y: 0, width: 6, height: 6, xoffset: -8, yoffset: 0, xadvance: 0, page: 0 },
      { id: 0x1f468, x: 60, y: 0, width: 28, height: 28, xoffset: 1, yoffset: 4, xadvance: 30, page: 0 },
      { id: 0x1f469, x: 90, y: 0, width: 28, height: 28, xoffset: 1, yoffset: 4, xadvance: 30, page: 0 },
      { id: 0x200d, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0, page: 0 },
    ],
  };
  async function registerMarksFont(): Promise<void> {
    const prior = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('marks.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MARKS_FONT) });
      }
      return (prior as unknown as (u: string) => unknown)(url);
    }) as typeof fetch;
    await registerFont('marks', {}, '/fonts/marks/marks.json', '/fonts/marks/marks.png');
    global.fetch = prior;
  }
  const MARKS = (text: string, letterSpacing: number): ResolvedRun =>
    ({ ...RUN_PLAIN(text), fontFamily: 'marks', letterSpacing });

  it('tracks a base and its combining mark once, as CSS does', async () => {
    await registerMarksFont();
    // A(23) + U+0301(0) + B(22), kerned -1 as the pair A, B: two clusters.
    const out = layoutAndPaint([MARKS('A\u0301B', 4)], OPTS);
    expect(out.bounds.width).toBeCloseTo(44 + 2 * 4);
    // The mark sits against its base, before the tracking gap, not after it.
    const cells = out.lines[0].cells;
    expect(cells.map((c) => c.x)).toEqual([0, 23, 26]);
  });

  it('kerns a base against the next base, through the mark between them', async () => {
    await registerMarksFont();
    const width = (text: string) => layoutAndPaint([MARKS(text, 0)], OPTS).bounds.width;
    expect(width('A\u0301B')).toBeCloseTo(width('AB'));
    // A mark with no base before it kerns against nothing.
    expect(width('\u0301B')).toBeCloseTo(22);
  });

  it('tracks a ZWJ sequence once', async () => {
    await registerMarksFont();
    const out = layoutAndPaint([MARKS('\u{1F468}\u200D\u{1F469}', 4)], OPTS);
    expect(out.bounds.width).toBeCloseTo(60 + 4);
  });

  it('reaches layout through resolveRuns (run value wins, style value inherited)', async () => {
    await registerFixture('inter', [{}]);
    const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 32, letterSpacing: 4 }, { fill: DEFAULT_TEXT_FILL });
    const fromStyle = layoutAndPaint(resolveRuns([{ text: 'AB' }], style), OPTS);
    const fromRun = layoutAndPaint(
      resolveRuns([{ text: 'AB', letterSpacing: 10 }], style),
      OPTS,
      );
    expect(xs(fromStyle)).toEqual([1, 28]);
    expect(xs(fromRun)).toEqual([1, 34]);
  });
});
