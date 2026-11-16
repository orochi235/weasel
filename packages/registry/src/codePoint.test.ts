import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { codePointFloor, isOneChar } from './codePoint';

describe('codePointFloor', () => {
  it('steps back off the middle of a surrogate pair and leaves any other offset', () => {
    expect(codePointFloor('ab😀cd', 3)).toBe(2);
    expect(codePointFloor('ab😀cd', 2)).toBe(2);
    expect(codePointFloor('ab😀cd', 4)).toBe(4);
    expect(codePointFloor('\uD83D', 1)).toBe(1);
    expect(codePointFloor('', 0)).toBe(0);
  });

  it('cuts a prefix whose code points begin the string\'s own, at most one unit short', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary' }), fc.nat(), (s, n) => {
      const at = Math.min(n, s.length);
      const cut = codePointFloor(s, at);
      expect(at - cut).toBeGreaterThanOrEqual(0);
      expect(at - cut).toBeLessThanOrEqual(1);
      const head = [...s.slice(0, cut)];
      expect(head).toEqual([...s].slice(0, head.length));
    }));
  });
});

describe('isOneChar', () => {
  it('counts one code point as one character, an astral one included', () => {
    expect(isOneChar('a')).toBe(true);
    expect(isOneChar('😀')).toBe(true);
    expect(isOneChar('')).toBe(false);
    expect(isOneChar('ab')).toBe(false);
    expect(isOneChar('Enter')).toBe(false);
  });
});
