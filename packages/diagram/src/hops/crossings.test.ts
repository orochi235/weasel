import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@weasel-js/core/math';
import { edgeHops } from './crossings';

const line = (...xy: number[]): Vec2[] => xy.flatMap((v, i) => (i % 2 === 0 ? [{ x: v, y: xy[i + 1]! }] : []));

describe('edgeHops', () => {
  it('puts a hop on the later connector in render order, where the two cross', () => {
    const polylines = new Map([['h', line(0, 50, 200, 50)], ['v', line(100, 0, 100, 200)]]);
    expect(edgeHops(polylines, ['h', 'v'], 5)).toEqual(new Map([
      ['h', []],
      ['v', [{ at: { x: 100, y: 50 }, over: ['h'], r: 5 }]],
    ]));
    expect(edgeHops(polylines, ['v', 'h'], 5).get('h')).toEqual([{ at: { x: 100, y: 50 }, over: ['v'], r: 5 }]);
  });

  it('finds crossings between diagonal segments', () => {
    const polylines = new Map([['a', line(0, 0, 100, 100)], ['b', line(0, 100, 100, 0)]]);
    expect(edgeHops(polylines, ['a', 'b'], 5).get('b')).toEqual([{ at: { x: 50, y: 50 }, over: ['a'], r: 5 }]);
  });

  it('skips a touch at an end and a crossing within 2r of either connector\'s ends', () => {
    const polylines = new Map([
      ['h', line(0, 50, 200, 50)],
      ['t', line(100, 0, 100, 50)],
      ['near', line(8, 0, 8, 200)],
      ['nearOther', line(150, 0, 150, 57)],
    ]);
    const hops = edgeHops(polylines, ['h', 't', 'near', 'nearOther'], 5);
    expect([...hops.values()].flat()).toEqual([]);
  });

  it('skips collinear overlaps', () => {
    const polylines = new Map([['a', line(0, 50, 200, 50)], ['b', line(50, 50, 150, 50)]]);
    expect(edgeHops(polylines, ['a', 'b'], 5).get('b')).toEqual([]);
  });

  it('skips a crossing too close to a bend for the hop to fit on its segment', () => {
    const polylines = new Map([['h', line(0, 50, 200, 50)], ['l', line(103, 0, 103, 100, 300, 100)]]);
    expect(edgeHops(polylines, ['h', 'l'], 5).get('l')).toEqual([{ at: { x: 103, y: 50 }, over: ['h'], r: 5 }]);
    const tight = new Map([['h', line(0, 50, 200, 50)], ['l', line(100, 0, 100, 53, 300, 53)]]);
    expect(edgeHops(tight, ['h', 'l'], 5).get('l')).toEqual([]);
  });

  it('merges hops closer than 2r into one longer hop over both', () => {
    const polylines = new Map([
      ['a', line(100, 0, 100, 200)],
      ['b', line(106, 0, 106, 200)],
      ['h', line(0, 50, 300, 50)],
    ]);
    expect(edgeHops(polylines, ['a', 'b', 'h'], 5).get('h')).toEqual([{ at: { x: 103, y: 50 }, over: ['a', 'b'], r: 8 }]);
  });

  it('keeps hops 2r apart or more separate, in route order', () => {
    const polylines = new Map([
      ['a', line(110, 0, 110, 200)],
      ['b', line(100, 0, 100, 200)],
      ['h', line(300, 50, 0, 50)],
    ]);
    expect(edgeHops(polylines, ['a', 'b', 'h'], 5).get('h')).toEqual([
      { at: { x: 110, y: 50 }, over: ['a'], r: 5 },
      { at: { x: 100, y: 50 }, over: ['b'], r: 5 },
    ]);
  });

  it('answers only the connectors asked for', () => {
    const polylines = new Map([['h', line(0, 50, 200, 50)], ['v', line(100, 0, 100, 200)], ['w', line(150, 0, 150, 200)]]);
    const hops = edgeHops(polylines, ['h', 'v', 'w'], 5, new Set(['w']));
    expect([...hops.keys()]).toEqual(['w']);
    expect(hops.get('w')).toEqual([{ at: { x: 150, y: 50 }, over: ['h'], r: 5 }]);
  });
});
