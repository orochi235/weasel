import { describe, it, expect } from 'vitest';
import { serialize } from './serialize';

describe('serialize', () => {
  it('passes plain data through', () => {
    expect(serialize({ a: 1, b: ['x', true, null] })).toEqual({ a: 1, b: ['x', true, null] });
  });

  it('names functions, tags typed arrays, maps, sets and dates, and spells out odd numbers', () => {
    function draw() {}
    expect(serialize({
      draw,
      anon: (() => () => {})(),
      coords: new Float32Array(6),
      m: new Map([['k', 1]]),
      s: new Set([2]),
      d: new Date(0),
      n: NaN,
      big: 10n,
    })).toEqual({
      draw: 'ƒ draw',
      anon: 'ƒ anonymous',
      coords: { $type: 'Float32Array', length: 6 },
      m: { $type: 'Map', size: 1, entries: [['k', 1]] },
      s: { $type: 'Set', size: 1, entries: [2] },
      d: { $type: 'Date', value: '1970-01-01T00:00:00.000Z' },
      n: 'NaN',
      big: '10n',
    });
  });

  it('marks a cycle but writes a shared reference out twice', () => {
    const shared = { v: 1 };
    const loop: Record<string, unknown> = { shared, again: shared };
    loop.self = loop;
    expect(serialize(loop)).toEqual({ shared: { v: 1 }, again: { v: 1 }, self: '[cycle]' });
  });

  it('caps depth, collection length and string length', () => {
    expect(serialize({ a: { b: { c: 1 } } }, { depth: 2 })).toEqual({ a: { b: '…' } });
    expect(serialize([1, 2, 3, 4], { items: 2 })).toEqual([1, 2, '… 2 more']);
    expect(serialize({ a: 1, b: 2, c: 3 }, { items: 1 })).toEqual({ a: 1, '…': '… 2 more' });
    expect(serialize('abcdef', { chars: 3 })).toBe('abc…');
  });

  it('notes the class of an instance', () => {
    class Pose { x = 1; }
    expect(serialize(new Pose())).toEqual({ $class: 'Pose', x: 1 });
  });
});
