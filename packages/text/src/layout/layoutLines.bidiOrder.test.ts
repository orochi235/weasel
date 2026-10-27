import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import { stubFetch, registerFixture, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — bidi seam', () => {
  const OPTS = { maxWidth: 200, lineHeight: 1.2, align: 'left' as const };
  /** A stand-in engine: reverses everything, so "did the seam run" is visible
   *  without pulling the real algorithm into a unit test. */
  const REVERSING = {
    analyze: (cps: readonly number[]) => ({ codePoints: [...cps] }),
    reorder: (_a: unknown, start: number, end: number) => {
      const order: number[] = [];
      for (let i = end - 1; i >= start; i--) order.push(i);
      return { order, levels: new Int16Array(end - start).fill(1) };
    },
    mirror: () => null,
    baseLevel: () => 0,
  };

  it('lays out in logical order when no engine is supplied', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AB')], OPTS);
    const cells = out.lines[0].cells;
    expect(cells[0].x).toBeLessThan(cells[1].x);
  });

  it('positions cells in the order the engine gives', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AB')], { ...OPTS, bidi: REVERSING });
    const cells = out.lines[0].cells;
    // Reversed: 'B' is painted first, so 'A' now sits to its right.
    expect(cells[0].x).toBeGreaterThan(cells[1].x);
  });

  it('keeps cells in logical order even when x is not monotonic', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AB')], { ...OPTS, bidi: REVERSING });
    // Slot i is still character i — the whole cell contract depends on this.
    expect(out.lines[0].cells.map((c) => c.cp)).toEqual([65, 66]);
  });

  it('gives every cell its advance so a consumer can find its extent', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AA')], OPTS);
    const cells = out.lines[0].cells;
    expect(cells[0].advance).toBeGreaterThan(0);
    expect(cells[0].x + cells[0].advance).toBeCloseTo(cells[1].x, 10);
  });

  it('counts the kerning before the next glyph in a cell\'s advance', async () => {
    await registerFixture('inter', [{}]);
    // The fixture kerns A→B by -1: A advances 23 and B starts at 22.
    for (const runs of [[RUN_PLAIN('AB')], [RUN_PLAIN('A'), RUN_PLAIN('B')]]) {
      const line = layoutAndPaint(runs, OPTS).lines[0];
      const [a, b] = line.cells;
      expect(b.x).toBeCloseTo(22, 10);
      expect(a.x + a.advance).toBeCloseTo(b.x, 10);
      // The pen step is the same gap, so a decoration rule ends where the next starts.
      expect(line.glyphs[0].step).toBeCloseTo(22, 10);
      expect(line.glyphs[0].advance).toBe(23);
    }
  });

  it('gives the kerning to the visually left cell once the engine reverses a line', async () => {
    await registerFixture('inter', [{}]);
    // Reversed, B is painted first and A after it; the gap the wrap measured
    // for A→B still sits between them, and belongs to B, now on the left.
    const out = layoutAndPaint([RUN_PLAIN('AB')], { ...OPTS, bidi: REVERSING });
    const [a, b] = out.lines[0].cells;
    expect(b.x).toBeCloseTo(0, 10);
    expect(b.x + b.advance).toBeCloseTo(a.x, 10);
    expect(out.lines[0].x1).toBeCloseTo(a.x + a.advance, 10);
  });

  it('reports the resolved level per cell', async () => {
    await registerFixture('inter', [{}]);
    const plain = layoutAndPaint([RUN_PLAIN('AB')], OPTS);
    expect(plain.lines[0].cells.map((c) => c.level)).toEqual([0, 0]);
    const rev = layoutAndPaint([RUN_PLAIN('AB')], { ...OPTS, bidi: REVERSING });
    expect(rev.lines[0].cells.map((c) => c.level)).toEqual([1, 1]);
  });
});
