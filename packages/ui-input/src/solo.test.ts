import { describe, expect, it } from 'vitest';
import { soloChanges } from './solo';

const states = (entries: Record<string, boolean>) => new Map(Object.entries(entries));

describe('soloChanges', () => {
  it('turns the kept switch on and every other one off', () => {
    expect(soloChanges(states({ a: true, b: false, c: true }), new Set(['b']))).toEqual({ a: false, b: true, c: false });
  });

  it('switches every one back on when the kept switch is already alone', () => {
    expect(soloChanges(states({ a: false, b: true, c: false }), new Set(['b']))).toEqual({ a: true, c: true });
  });

  it('keeps several on at once, and leaves alone what states omits', () => {
    expect(soloChanges(states({ g: false, x: true, y: true }), new Set(['g', 'x']))).toEqual({ g: true, y: false });
  });

  it('returns nothing for an empty list', () => {
    expect(soloChanges(new Map(), new Set(['a']))).toEqual({});
  });

  it('returns a switch whose id is __proto__ as its own entry', () => {
    const out = soloChanges(new Map([['__proto__', true], ['a', true]]), new Set(['a']));
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.entries(out)).toEqual([['__proto__', false]]);
  });
});
