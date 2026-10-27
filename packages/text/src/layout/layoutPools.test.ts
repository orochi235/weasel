/** Layout and painting reuse their lines, sums, entry lists and group slots from one call to
 *  the next: a result must come out the same whatever came before it, and stay as it was when
 *  the next call runs. */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutRuns, type LaidOutRuns } from './layoutRuns';
import type { LayoutRunsOpts } from './layoutOpts';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { PaintedRuns } from './paintRuns';
import type { ResolvedRun } from '../runs/resolveRuns';
import { stubFetch, registerFixture, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(async () => {
  _resetFontRegistryForTests();
  stubFetch();
  await registerFixture('inter', [{}]);
});

const WRAPPED: LayoutRunsOpts = { maxWidth: 120, lineHeight: 1.2, align: 'left', justify: true };

/** Everything a layout says, its views built. */
function read(laid: LaidOutRuns) {
  return {
    bounds: laid.bounds,
    lines: laid.lines.map((l) => ({
      box: [l.x0, l.y0, l.x1, l.y1, l.baselineY, l.srcEnd, l.justified],
      cells: l.cells.map((c) => ({ ...c })),
      glyphs: l.glyphs.map((g) => [g.cp, g.x, g.baselineY, g.advance, g.step, g.cell]),
    })),
  };
}

describe('layout pools', () => {
  it('lays a text out the same before and after a longer one', () => {
    const text = 'AB BA\tAB AB BBA A\nAB';
    const first = read(layoutRuns([RUN_PLAIN(text)], WRAPPED));
    layoutRuns([RUN_PLAIN('A B AB\tBA BB AA AB B A BA\n\n\tAB BA AB A B AB BA')], WRAPPED);
    expect(read(layoutRuns([RUN_PLAIN(text)], WRAPPED))).toEqual(first);
  });

  it('leaves a finished layout as it was when the next one runs', () => {
    const laid = layoutRuns([RUN_PLAIN('AB AB\tBA AB')], WRAPPED);
    const lines = laid.lines.length;
    const box = laid.lines.map((l) => [l.x0, l.x1, l.y0, l.y1, l.baselineY]);
    layoutRuns([RUN_PLAIN('BA\nAB\nA B A B A B')], { maxWidth: 40, lineHeight: 2, align: 'right' });
    expect(laid.lines).toHaveLength(lines);
    expect(laid.lines.map((l) => [l.x0, l.x1, l.y0, l.y1, l.baselineY])).toEqual(box);
  });

  it('paints a text the same before and after one with more groups, and leaves a painting as it was', () => {
    const red = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fill: { paint: { kind: 'solid', color: '#f00' } } });
    const runs = [RUN_PLAIN('AB '), red('BA'), RUN_PLAIN(' AB')];
    const paint = (p: PaintedRuns) => p.groups.map((g) => [g.fill, g.quadData.slice(), g.glyphs.length]);
    const first = layoutAndPaint(runs, WRAPPED);
    const before = paint(first);
    expect(before).toHaveLength(2);
    layoutAndPaint([red('A'), RUN_PLAIN('B'), red('AB'), RUN_PLAIN('BA\nAB')], WRAPPED);
    expect(paint(first)).toEqual(before);
    expect(paint(layoutAndPaint(runs, WRAPPED))).toEqual(before);
  });
});
