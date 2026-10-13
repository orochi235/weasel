import { describe, expect, it } from 'vitest';
import { hasOpenSubpath, splitByClosure } from './splitByClosure';
import { pathFromD } from './pathFromD';
import { PATH_L, PATH_M, PATH_Z } from '../commands';
import type { PolygonPath } from '../path';

const poly = (d: string): PolygonPath => pathFromD(d) as PolygonPath;

describe('splitByClosure', () => {
  it('sorts subpaths by whether a Z ends them, in order', () => {
    const path = { ...poly('M0 0L10 0L10 10Z M20 0L30 0L30 10 M40 0L50 0L50 10Z M60 0L70 0'), openFill: 'none' as const };
    const { closed, open } = splitByClosure(path);
    expect(Array.from(closed!.commands)).toEqual([
      PATH_M, PATH_L, PATH_L, PATH_Z, PATH_M, PATH_L, PATH_L, PATH_Z,
    ]);
    expect(Array.from(closed!.coords)).toEqual([0, 0, 10, 0, 10, 10, 40, 0, 50, 0, 50, 10]);
    expect(Array.from(open!.commands)).toEqual([PATH_M, PATH_L, PATH_L, PATH_M, PATH_L]);
    expect(Array.from(open!.coords)).toEqual([20, 0, 30, 0, 30, 10, 60, 0, 70, 0]);
    expect(closed!.openFill).toBe('none');
    expect(open!.fillRule).toBe(path.fillRule);
  });

  it('answers null for the side with no subpaths', () => {
    expect(splitByClosure(poly('M0 0L10 0L10 10Z')).open).toBeNull();
    expect(splitByClosure(poly('M0 0L10 0L10 10')).closed).toBeNull();
  });
});

describe('hasOpenSubpath', () => {
  it('is true when any subpath lacks its Z', () => {
    expect(hasOpenSubpath(poly('M0 0L10 0L10 10Z'))).toBe(false);
    expect(hasOpenSubpath(poly('M0 0L10 0L10 10Z M20 0L30 0'))).toBe(true);
    expect(hasOpenSubpath({ kind: 'rect', x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });
});
