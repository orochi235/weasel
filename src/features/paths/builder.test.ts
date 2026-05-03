import { describe, expect, it } from 'vitest';
import { PathBuilder, polygonFromPoints, rectPath } from './builder';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from './types';

describe('PathBuilder', () => {
  it('encodes commands and coords into typed arrays', () => {
    const p = new PathBuilder()
      .moveTo(10, 20)
      .lineTo(30, 40)
      .quadTo(50, 0, 60, 40)
      .curveTo(70, 0, 80, 0, 90, 40)
      .close()
      .build();
    expect(Array.from(p.commands)).toEqual([PATH_M, PATH_L, PATH_Q, PATH_C, PATH_Z]);
    expect(Array.from(p.coords)).toEqual([10, 20, 30, 40, 50, 0, 60, 40, 70, 0, 80, 0, 90, 40]);
    expect(p.fillRule).toBe('nonzero');
  });

  it('respects fillRule override', () => {
    const p = new PathBuilder().setFillRule('evenodd').moveTo(0, 0).lineTo(1, 0).close().build();
    expect(p.fillRule).toBe('evenodd');
  });
});

describe('polygonFromPoints', () => {
  it('builds a closed polygon from a list of points', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(Array.from(p.commands)).toEqual([PATH_M, PATH_L, PATH_L, PATH_Z]);
    expect(Array.from(p.coords)).toEqual([0, 0, 10, 0, 10, 10]);
  });

  it('returns an empty polygon when given no points', () => {
    const p = polygonFromPoints([]);
    expect(p.commands.length).toBe(0);
    expect(p.coords.length).toBe(0);
  });
});

describe('rectPath', () => {
  it('returns a RectPath subtype', () => {
    const r = rectPath(1, 2, 3, 4);
    expect(r).toEqual({ kind: 'rect', x: 1, y: 2, width: 3, height: 4 });
  });
});
