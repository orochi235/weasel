import { describe, it, expect } from 'vitest';
import { serialize, serializedNumber, unescapeKey } from './serialize';

describe('serialize', () => {
  it('passes plain data through', () => {
    expect(serialize({ a: 1, b: ['x', true, null] })).toEqual({ a: 1, b: ['x', true, null] });
  });

  it('tags functions, typed arrays, maps, sets, dates, odd numbers, bigints and symbols', () => {
    function draw() {}
    expect(serialize({
      draw,
      anon: (() => () => {})(),
      coords: new Float32Array(6),
      m: new Map([['k', 1]]),
      s: new Set([2]),
      d: new Date(0),
      n: NaN,
      low: -Infinity,
      big: 10n,
      sym: Symbol('id'),
    })).toEqual({
      draw: { $type: 'function', name: 'draw' },
      anon: { $type: 'function', name: 'anonymous' },
      coords: { $type: 'Float32Array', length: 6 },
      m: { $type: 'Map', size: 1, entries: [['k', 1]] },
      s: { $type: 'Set', size: 1, entries: [2] },
      d: { $type: 'Date', value: '1970-01-01T00:00:00.000Z' },
      n: { $type: 'number', value: 'NaN' },
      low: { $type: 'number', value: '-Infinity' },
      big: { $type: 'bigint', value: '10' },
      sym: { $type: 'symbol', value: 'Symbol(id)' },
    });
  });

  it('writes strings that look like its own markers as the strings they are', () => {
    const strings = ['[cycle]', 'NaN', '10n', 'ƒ draw', '…', '… 2 more', '[threw: x]'];
    expect(serialize(strings)).toEqual(strings);
  });

  it('marks a cycle but writes a shared reference out twice', () => {
    const shared = { v: 1 };
    const loop: Record<string, unknown> = { shared, again: shared };
    loop.self = loop;
    expect(serialize(loop)).toEqual({ shared: { v: 1 }, again: { v: 1 }, self: { $type: 'cycle' } });
  });

  it('escapes an object’s own $ keys, so a $type of its own stays data', () => {
    const out = serialize({ $type: 'circle', $$x: 1, $class: 'mine', r: 5 });
    expect(out).toEqual({ $$type: 'circle', $$$x: 1, $$class: 'mine', r: 5 });
    expect(Object.keys(out as object).map(unescapeKey)).toEqual(['$type', '$$x', '$class', 'r']);
    expect(unescapeKey('$class')).toBeNull();
  });

  it('caps depth, collection length and string length', () => {
    expect(serialize({ a: { b: { c: 1 } } }, { depth: 2 })).toEqual({ a: { b: { $type: 'depth' } } });
    expect(serialize([1, 2, 3, 4], { items: 2 })).toEqual([1, 2, { $type: 'more', count: 2 }]);
    expect(serialize({ a: 1, b: 2, c: 3 }, { items: 1 })).toEqual({ a: 1, $more: 2 });
    expect(serialize('abcdef', { chars: 3 })).toBe('abc…');
  });

  it('writes an invalid date rather than throwing on it', () => {
    expect(serialize({ d: new Date(NaN) })).toEqual({ d: { $type: 'Date', value: 'Invalid Date' } });
  });

  it('notes the class of an instance', () => {
    class Pose { x = 1; }
    expect(serialize(new Pose())).toEqual({ $class: 'Pose', x: 1 });
  });

  it('writes a getter that throws as what it threw, and keeps the other keys', () => {
    const node = { a: 1, get broken(): number { throw new Error('not ready'); }, b: 2 };
    expect(serialize(node)).toEqual({ a: 1, broken: { $type: 'threw', value: 'Error: not ready' }, b: 2 });
  });
});

describe('serializedNumber', () => {
  it('reads a number back, finite or not', () => {
    expect(serializedNumber(serialize(2.5))).toBe(2.5);
    expect(serializedNumber(serialize(-Infinity))).toBe(-Infinity);
    expect(serializedNumber(serialize(NaN))).toBeNaN();
    expect(serializedNumber('7')).toBeNaN();
  });
});
