import { describe, expect, it } from 'vitest';
import type { PolygonPath } from '../path';
import { PATH_C, PATH_L, PATH_M, PATH_Z } from '../commands';
import { pathFromD } from './pathFromD';
import { trimPathAt } from './trimPath';
import { extendToMeet, lengthenOpenEnd, openPathEnds } from './extendPath';

const coords = (p: PolygonPath) => Array.from(p.coords);
const cmds = (p: PolygonPath) => Array.from(p.commands);
const walls = [pathFromD('M10 -10 V10'), pathFromD('M20 -10 V10')];

describe('trimPathAt', () => {
  const line = pathFromD('M0 0 H30');

  it('removes the piece between the two crossings around the probe', () => {
    const r = trimPathAt(line, walls, { x: 15, y: 1 })!;
    expect(coords(r.path)).toEqual([0, 0, 10, 0, 20, 0, 30, 0]);
    expect(cmds(r.path)).toEqual([PATH_M, PATH_L, PATH_M, PATH_L]);
    expect(coords(r.removed)).toEqual([10, 0, 20, 0]);
  });

  it('removes from an end to the first crossing', () => {
    expect(coords(trimPathAt(line, walls, { x: 4, y: 0 })!.path)).toEqual([10, 0, 30, 0]);
  });

  it('removes a subpath touched only at its ends whole', () => {
    const r = trimPathAt(pathFromD('M10 0 H20'), walls, { x: 15, y: 0 })!;
    expect(r.path.commands).toHaveLength(0);
  });

  it('declines when nothing crosses, or the probe is out of reach', () => {
    expect(trimPathAt(line, [], { x: 15, y: 0 })).toBeNull();
    expect(trimPathAt(line, walls, { x: 15, y: 6 }, { radius: 5 })).toBeNull();
  });

  it('opens a closed subpath, keeping the rest of the loop', () => {
    const square = pathFromD('M0 0 H30 V30 H0 Z');
    const cut = pathFromD('M15 -10 V40');
    const r = trimPathAt(square, [cut], { x: 25, y: 15 })!;
    expect(cmds(r.path)).not.toContain(PATH_Z);
    expect(coords(r.path)).toEqual([15, 30, 0, 30, 0, 0, 15, 0]);
  });

  it('splits a curve where it is cut, keeping it a curve', () => {
    const arc = pathFromD('M0 0 C0 20 30 20 30 0');
    const r = trimPathAt(arc, [pathFromD('M15 -10 V30')], { x: 25, y: 10 })!;
    expect(cmds(r.path)).toEqual([PATH_M, PATH_C]);
    expect(r.path.coords[6]).toBeCloseTo(15, 5);
  });
});

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
