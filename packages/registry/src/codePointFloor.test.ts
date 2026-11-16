import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { codePointFloor } from './codePointFloor';

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
