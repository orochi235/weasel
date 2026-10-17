import { describe, expect, it } from 'vitest';
import { measureDistances } from './distance';

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe('measureDistances', () => {
  it('measures a horizontal gap through the rows the two boxes share', () => {
    const r = measureDistances(box(0, 0, 10, 20), box(30, 10, 10, 20));
    expect(r.gaps).toEqual([{ axis: 'x', min: 10, max: 30, at: 15 }]);
    expect(r.leaders).toEqual([]);
  });

  it('measures from either side, and on the vertical axis', () => {
    expect(measureDistances(box(30, 0, 10, 10), box(0, 0, 10, 10)).gaps)
      .toEqual([{ axis: 'x', min: 10, max: 30, at: 5 }]);
    expect(measureDistances(box(0, 0, 10, 10), box(2, 25, 4, 5)).gaps)
      .toEqual([{ axis: 'y', min: 10, max: 25, at: 4 }]);
  });

  it('measures both axes for a diagonal neighbor, from the selection\'s center, with leaders to the target', () => {
    const r = measureDistances(box(0, 0, 10, 10), box(40, 30, 10, 10));
    expect(r.gaps).toEqual([
      { axis: 'x', min: 10, max: 40, at: 5 },
      { axis: 'y', min: 10, max: 30, at: 5 },
    ]);
    // The x readout runs at y = 5, above the target: a leader drops from it to
    // the target's top along its left edge, and one runs across to its left.
    expect(r.leaders).toEqual([
      { id: 'distance:x', axis: 'x', offset: 40, span: { min: 5, max: 30 } },
      { id: 'distance:y', axis: 'y', offset: 30, span: { min: 5, max: 40 } },
    ]);
  });

  it('measures the four inner distances when one box holds the other', () => {
    const inner = box(10, 20, 30, 40);
    const outer = box(0, 0, 100, 100);
    const expected = [
      { axis: 'x', min: 0, max: 10, at: 40 },
      { axis: 'x', min: 40, max: 100, at: 40 },
      { axis: 'y', min: 0, max: 20, at: 25 },
      { axis: 'y', min: 60, max: 100, at: 25 },
    ];
    expect(measureDistances(inner, outer).gaps).toEqual(expected);
    expect(measureDistances(outer, inner).gaps).toEqual(expected);
  });

  it('measures nothing on an axis where the boxes partly overlap, or for a flush edge', () => {
    expect(measureDistances(box(0, 0, 20, 20), box(10, 10, 20, 20)).gaps).toEqual([]);
    expect(measureDistances(box(0, 0, 10, 10), box(10, 0, 10, 10)).gaps).toEqual([]);
    expect(measureDistances(box(0, 0, 10, 10), box(0, 0, 10, 10)).gaps).toEqual([]);
  });
});
