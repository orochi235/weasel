import { describe, expect, it } from 'vitest';
import { polygonFromPoints, withCorner, type PolygonPath } from '@weasel-js/geom';
import { cornerControlsParams, cornerControlsState } from './cornerControls';

const square = (): PolygonPath =>
  polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);

const path = () => withCorner(withCorner(withCorner(square(),
  0, { shape: 'squircle', radius: 10 }),
  1, { shape: 'squircle', radius: 20 }),
  2, { shape: 0.5, radius: 20 });

describe('cornerControlsState', () => {
  it('shows a keyword corner by its keyword and parameter', () => {
    expect(cornerControlsState(path(), new Set([0]))).toEqual({
      values: { count: 1, shape: 'squircle', k: 2, radius: 10 }, mixed: new Set(),
    });
  });

  it('shows a parameter between the keywords with no keyword pressed', () => {
    expect(cornerControlsState(path(), new Set([2])).values).toEqual({ count: 1, shape: 'none', k: 0.5, radius: 20 });
  });

  it('marks the fields the selected corners disagree on', () => {
    expect(cornerControlsState(path(), new Set([0, 1])).mixed).toEqual(new Set(['radius']));
    expect(cornerControlsState(path(), new Set([1, 2])).mixed).toEqual(new Set(['shape', 'k']));
  });

  it('counts no corners for no selection, and shows a sharp corner with no shape', () => {
    expect(cornerControlsState(path(), new Set()).values.count).toBe(0);
    expect(cornerControlsState(path(), new Set([3])).values).toEqual({ count: 1, shape: 'none', radius: 0 });
  });

  it('pins square and notch to the ends of the parameter slider', () => {
    const p = withCorner(square(), 1, { shape: 'notch', radius: 5 });
    expect(cornerControlsState(p, new Set([1])).values.k).toBe(-4);
  });
});

describe('cornerControlsParams', () => {
  it('maps a keyword, a parameter, and a radius to setCorners params', () => {
    expect(cornerControlsParams('shape', 'scoop')).toEqual({ shape: 'scoop' });
    expect(cornerControlsParams('k', -1.5)).toEqual({ shape: -1.5 });
    expect(cornerControlsParams('radius', 12)).toEqual({ radius: 12 });
    expect(cornerControlsParams('shape', 'blob')).toBeNull();
  });
});
