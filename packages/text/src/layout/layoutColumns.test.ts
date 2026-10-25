/**
 * A layout and its painting hold their numbers in typed arrays, and the
 * object views — a line's `cells` and `glyphs`, a group's `quads` — are built
 * only when something reads them. Painting must not be what reads them: it
 * runs every frame for text that changes every frame, and the views are one
 * object a glyph with every number boxed.
 *
 * Whether a view was built is asked of its property descriptor, a proxy for
 * the allocation this exists to avoid: an accessor is a view nobody read.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests, _resetFallbackForTests } from '@weasel-js/font/test-seams';
import { registerFixture, stubFetch, RUN_PLAIN } from './testing/fontFixtures';
import { layoutRuns } from './layoutRuns';
import { paintRuns, QUAD_STRIDE } from './paintRuns';

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  stubFetch();
  await registerFixture('inter', [{}]);
});

const OPTS = { maxWidth: 400, lineHeight: 1.2, align: 'left' as const };
const unread = (o: object, key: string) => typeof Object.getOwnPropertyDescriptor(o, key)?.get === 'function';

describe('layout columns', () => {
  it('paints a layout without building its cells or glyphs', () => {
    const runs = [RUN_PLAIN('AB A')];
    const laid = layoutRuns(runs, OPTS);
    const { groups } = paintRuns(laid, runs);
    expect(groups.length).toBeGreaterThan(0);
    for (const line of laid.lines) {
      expect(unread(line, 'cells')).toBe(true);
      expect(unread(line, 'glyphs')).toBe(true);
    }
    for (const g of groups) expect(unread(g, 'quads')).toBe(true);
  });

  it('holds a group\'s quads packed, the view reading the same numbers', () => {
    const runs = [RUN_PLAIN('AB')];
    const laid = layoutRuns(runs, OPTS);
    const [group] = paintRuns(laid, runs).groups;
    expect(group.quadData).toBeInstanceOf(Float64Array);
    expect(group.quadData.length).toBe(2 * QUAD_STRIDE);
    const { x0, y0, x1, y1, u0, v0, u1, v1, baselineY } = group.quads[1];
    expect([...group.quadData.subarray(QUAD_STRIDE)]).toEqual([x0, y0, x1, y1, u0, v0, u1, v1, baselineY]);
  });

  it('builds a view once and keeps it as a plain value', () => {
    const laid = layoutRuns([RUN_PLAIN('AB')], OPTS);
    const [line] = laid.lines;
    expect(line.cells).toBe(line.cells);
    expect(line.glyphs).toBe(line.glyphs);
    expect(unread(line, 'cells')).toBe(false);
    expect(line.glyphs.map((g) => g.cell)).toEqual([0, 1]);
    expect(line.glyphs.map((g) => g.x)).toEqual(line.cells.map((c) => c.x));
  });

  it('shows its views to a spread and to deep equality', () => {
    const a = layoutRuns([RUN_PLAIN('AB')], OPTS);
    const b = layoutRuns([RUN_PLAIN('AC')], OPTS);
    expect({ ...a.lines[0] }.cells).toHaveLength(2);
    expect(a).not.toEqual(b);
    expect(a).toEqual(layoutRuns([RUN_PLAIN('AB')], OPTS));
  });
});
