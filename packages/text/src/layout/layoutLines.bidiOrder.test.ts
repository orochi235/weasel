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
    // 'AA' rather than 'AB': the fixture kerns A→B, and kerning is a gap
    // *between* cells rather than part of either one's width.
    const out = layoutAndPaint([RUN_PLAIN('AA')], OPTS);
    const cells = out.lines[0].cells;
    expect(cells[0].advance).toBeGreaterThan(0);
    expect(cells[0].x + cells[0].advance).toBeCloseTo(cells[1].x, 10);
  });

  it('leaves kerning between cells rather than inside one', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AB')], OPTS);
    const [a, b] = out.lines[0].cells;
    // The fixture kerns A→B by -1, so B starts a unit before A's extent ends.
    expect(b.x).toBeCloseTo(a.x + a.advance - 1, 10);
  });

  it('reports the resolved level per cell', async () => {
    await registerFixture('inter', [{}]);
    const plain = layoutAndPaint([RUN_PLAIN('AB')], OPTS);
    expect(plain.lines[0].cells.map((c) => c.level)).toEqual([0, 0]);
    const rev = layoutAndPaint([RUN_PLAIN('AB')], { ...OPTS, bidi: REVERSING });
    expect(rev.lines[0].cells.map((c) => c.level)).toEqual([1, 1]);
  });
});
