import { describe, expect, it } from 'vitest';
import { polygonFromPoints, withCorner, type PolygonPath } from '@weasel-js/geom';
import { filletControlsParams, filletControlsState } from './filletControls';

const square = (): PolygonPath =>
  polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);

const path = () => withCorner(withCorner(withCorner(square(),
  0, { shape: 'squircle', radius: 10 }),
  1, { shape: 'squircle', radius: 20 }),
  2, { shape: 0.5, radius: 20 });

describe('filletControlsState', () => {
  it('shows a keyword corner by its keyword and parameter', () => {
    expect(filletControlsState(path(), new Set([0]))).toEqual({
      values: { count: 1, shape: 'squircle', k: 2, radius: 10 }, mixed: new Set(),
    });
  });

  it('shows a parameter between the keywords with no keyword pressed', () => {
    expect(filletControlsState(path(), new Set([2])).values).toEqual({ count: 1, shape: 'none', k: 0.5, radius: 20 });
  });

  it('marks the fields the selected corners disagree on', () => {
    expect(filletControlsState(path(), new Set([0, 1])).mixed).toEqual(new Set(['radius']));
    expect(filletControlsState(path(), new Set([1, 2])).mixed).toEqual(new Set(['shape', 'k']));
  });

  it('counts no corners for no selection, and shows a sharp corner with no shape', () => {
    expect(filletControlsState(path(), new Set()).values.count).toBe(0);
    expect(filletControlsState(path(), new Set([3])).values).toEqual({ count: 1, shape: 'none', radius: 0 });
  });

  it('pins square and notch to the ends of the parameter slider', () => {
    const p = withCorner(square(), 1, { shape: 'notch', radius: 5 });
    expect(filletControlsState(p, new Set([1])).values.k).toBe(-4);
  });
});

describe('filletControlsParams', () => {
  it('maps a keyword, a parameter, and a radius to setFillets params', () => {
    expect(filletControlsParams('shape', 'scoop')).toEqual({ shape: 'scoop' });
    expect(filletControlsParams('k', -1.5)).toEqual({ shape: -1.5 });
    expect(filletControlsParams('radius', 12)).toEqual({ radius: 12 });
    expect(filletControlsParams('shape', 'blob')).toBeNull();
  });
});
