import { describe, expect, it } from 'vitest';
import type { PolygonPath } from '../path';
import { PATH_C, PATH_L, PATH_M } from '../commands';
import { pathFromD } from './pathFromD';
import { extendToMeet, lengthenOpenEnd, openEndRay, openPathEnds } from './extendPath';

const coords = (p: PolygonPath) => Array.from(p.coords);
const cmds = (p: PolygonPath) => Array.from(p.commands);
const walls = [pathFromD('M10 -10 V10'), pathFromD('M20 -10 V10')];

describe('extendToMeet', () => {
  it('lengthens a straight end to the stroke it points at', () => {
    const r = extendToMeet(pathFromD('M0 0 H5'), walls, { sub: 0, end: 'last' })!;
    expect(r.distance).toBeCloseTo(5, 9);
    expect(coords(r.path)).toEqual([0, 0, 10, 0]);
  });

  it('extends the first end backward', () => {
    const r = extendToMeet(pathFromD('M14 0 H16'), walls, { sub: 0, end: 'first' })!;
    expect(coords(r.path)).toEqual([10, 0, 16, 0]);
  });

  it('carries a curved end on along its tangent with a new straight segment', () => {
    const r = extendToMeet(pathFromD('M0 -5 C0 0 2 0 5 0'), walls, { sub: 0, end: 'last' })!;
    expect(cmds(r.path)).toEqual([PATH_M, PATH_C, PATH_L]);
    expect(coords(r.path).slice(-2)).toEqual([10, 0]);
  });

  it('declines when the tangent meets nothing', () => {
    expect(extendToMeet(pathFromD('M0 0 H5'), [pathFromD('M0 10 H30')], { sub: 0, end: 'last' })).toBeNull();
  });
});

describe('lengthenOpenEnd and openPathEnds', () => {
  it('lists both ends of each open subpath, none of a closed one', () => {
    expect(openPathEnds(pathFromD('M0 0 H5 M0 10 H5 V20 Z'))).toEqual([
      { sub: 0, end: 'first' }, { sub: 0, end: 'last' },
    ]);
  });

  it('grows an end by a distance', () => {
    expect(coords(lengthenOpenEnd(pathFromD('M0 0 V5'), { sub: 0, end: 'last' }, 3)!)).toEqual([0, 0, 0, 8]);
    expect(lengthenOpenEnd(pathFromD('M0 0 V5'), { sub: 0, end: 'last' }, 0)).toBeNull();
  });
});

describe('an empty subpath (a bare M)', () => {
  // The anchor set counts the bare M as subpath 0, so the first line is subpath 1.
  const path = pathFromD('M50 50 M0 0 H5 M0 10 H5');

  it('numbers ends as the anchor set does', () => {
    expect(openPathEnds(path)).toEqual([
      { sub: 1, end: 'first' }, { sub: 1, end: 'last' },
      { sub: 2, end: 'first' }, { sub: 2, end: 'last' },
    ]);
  });

  it('extends the end it was handed', () => {
    const r = extendToMeet(path, walls, { sub: 2, end: 'last' })!;
    expect(r.at).toEqual({ x: 10, y: 10 });
    expect(coords(r.path)).toEqual([50, 50, 0, 0, 5, 0, 0, 10, 10, 10]);
  });

  it('reads the ray of the end it was handed', () => {
    expect(openEndRay(path, { sub: 1, end: 'first' })).toEqual({ at: { x: 0, y: 0 }, dir: { x: -1, y: 0 } });
  });
});
