import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutRuns, type LayoutRunsOpts } from './layoutRuns';
import { cachedLayoutRuns } from './layoutCache';
import { layoutTextPose } from './textPoseLayout';
import type { ResolvedRun } from '../runs/resolveRuns';

// FIXTURE_FONT at fontSize 32 (scale 1): A xadvance 23 / xoffset 1,
// B xadvance 22 / xoffset 2, kerning A→B = -1, and no space glyph, so a space
// advances fontSize * 0.25 = 8. 'AB' is 44 wide; 'AB AB' is 96.

beforeEach(async () => {
  _resetFontRegistryForTests();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) }))) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

const RUN = (text: string): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { fill: 'solid', color: '#000' }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});
const OPTS: LayoutRunsOpts = { maxWidth: 100, lineHeight: 1.2, align: 'justify' };

/** Each line's quad x0s, in emission order. */
function lineXs(out: ReturnType<typeof layoutRuns>): number[][] {
  const quads = out.groups.flatMap((g) => g.quads);
  const ys = [...new Set(quads.map((q) => q.y0))].sort((a, b) => a - b);
  return ys.map((y) => quads.filter((q) => q.y0 === y).map((q) => q.x0));
}

describe('layoutRuns — justify', () => {
  it('spreads a wrapped line’s slack across its word gaps', () => {
    // 'AB AB ' wraps before the third word; 96 of ink leaves 4 of slack for
    // its one gap, so the second word starts at 44 + 8 + 4.
    const out = layoutRuns([RUN('AB AB AB')], OPTS);
    expect(lineXs(out)[0]).toEqual([1, 24, 57, 80]);
    expect(out.lines[0].cells[2].advance).toBeCloseTo(12);
    expect(out.bounds.width).toBeCloseTo(100);
  });

  it('shares the slack equally between several gaps', () => {
    // 'A A A B' → A(23) sp A sp A sp: 'A A A' = 23*3 + 16 = 85, + ' B' = 115 > 100.
    const out = layoutRuns([RUN('A A A B')], OPTS);
    // 15 of slack over two gaps: each space grows by 7.5.
    expect(lineXs(out)[0]).toEqual([1, 1 + 23 + 15.5, 1 + 2 * (23 + 15.5)]);
  });

  it('leaves the last line of a paragraph at the start edge', () => {
    const out = layoutRuns([RUN('AB AB AB\nAB AB')], OPTS);
    const xs = lineXs(out);
    expect(xs[1]).toEqual([1, 24]);
    // Ends at a hard break, not a wrap: ragged, like the text's last line.
    expect(xs[2]).toEqual([1, 24, 53, 76]);
  });

  it('falls back to the right edge under rtl', () => {
    const out = layoutRuns([RUN('AB AB AB')], { ...OPTS, direction: 'rtl' });
    const xs = lineXs(out);
    expect(xs[0]).toEqual([1, 24, 57, 80]);
    expect(xs[1]).toEqual([100 - 44 + 1, 100 - 44 + 24]);
  });

  it('justifies an absolute edge on request, which then sets the last line', () => {
    const out = layoutRuns([RUN('AB AB AB')], { ...OPTS, align: 'center', justify: true });
    const xs = lineXs(out);
    expect(xs[0]).toEqual([1, 24, 57, 80]);
    expect(xs[1]).toEqual([28 + 1, 28 + 24]);
  });

  it('does not justify a line that never wrapped', () => {
    const out = layoutRuns([RUN('AB AB')], { ...OPTS, maxWidth: Infinity, alignWidth: 200 });
    expect(lineXs(out)[0]).toEqual([1, 24, 53, 76]);
  });

  it('leaves a line with no gap to spread into at the start edge', () => {
    const out = layoutRuns([RUN('ABABABAB AB')], { ...OPTS, maxWidth: 150 });
    expect(lineXs(out)[0][0]).toBe(1);
  });

  it('keys the layout cache on justification', () => {
    const runs = [RUN('AB AB AB')];
    const ragged = cachedLayoutRuns(runs, { ...OPTS, align: 'left' });
    const justified = cachedLayoutRuns(runs, { ...OPTS, align: 'left', justify: true });
    expect(lineXs(justified)[0]).not.toEqual(lineXs(ragged)[0]);
  });

  it('reaches a text pose that wraps', () => {
    const pose = {
      x: 0, y: 0, width: 100, height: 100, text: 'AB AB AB',
      style: { fontFamily: 'inter', fontSize: 32, align: 'justify' as const, wrap: true },
    };
    expect(lineXs(layoutTextPose(pose).laid)[0]).toEqual([1, 24, 57, 80]);
  });
});
