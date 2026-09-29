import { describe, expect, it } from 'vitest';
import { unionBoundsPath } from './unionBoundsPath';
import { polygonFromPoints, rectPath } from './builder';

describe('unionBoundsPath', () => {
  it('returns null for an empty iterable', () => {
    expect(unionBoundsPath([])).toBeNull();
  });

  it('returns the rect itself for a single RectPath input', () => {
    const r = rectPath(10, 20, 30, 40);
    expect(unionBoundsPath([r])).toEqual({ kind: 'rect', x: 10, y: 20, width: 30, height: 40 });
  });

  it('envelopes mixed rect and polygon inputs', () => {
    const r = rectPath(0, 0, 10, 10);
    const p = polygonFromPoints([{ x: 50, y: 50 }, { x: 100, y: 80 }, { x: 70, y: 120 }]);
    expect(unionBoundsPath([r, p])).toEqual({
      kind: 'rect', x: 0, y: 0, width: 100, height: 120,
    });
  });
});
