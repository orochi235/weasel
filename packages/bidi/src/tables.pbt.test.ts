/**
 * Properties of the three lookups over the whole code point range: mirroring is an involution with no
 * fixed point, a paired bracket's pair is its mirror and pairs back, and the fixture's code points are
 * the classes the other property files take them for.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bidiClassOf, mirrorOf, pairedBracket } from './tables';
import { mirror } from './index';
import { BY_CLASS, anyCodePoint, runs, tally, timeoutFor } from './pbt.fixture';
import type { BidiClass } from './types';

const RUNS = 2000;

const mirrored: number[] = [];
for (let cp = 0; cp <= 0x10ffff; cp++) if (mirrorOf(cp) !== null) mirrored.push(cp);

const someCodePoint = fc.oneof(anyCodePoint, fc.constantFrom(...mirrored));

describe('bidi tables, property', () => {
  it('takes every fixture code point for its class', () => {
    for (const [cls, cps] of Object.entries(BY_CLASS)) {
      for (const cp of cps) expect([cp.toString(16), bidiClassOf(cp)]).toEqual([cp.toString(16), cls as BidiClass]);
    }
  });

  it('mirrors as an involution with no fixed point, and pairs a bracket with its mirror', () => {
    const t = tally();
    fc.assert(fc.property(someCodePoint, (cp) => {
      const m = mirror(cp);
      expect(m).toBe(mirrorOf(cp));
      const b = pairedBracket(cp);
      if (m === null) {
        expect(b).toBeNull();
        t.count('plain');
        return;
      }
      t.count('mirrored');
      expect(m).not.toBe(cp);
      expect(mirror(m)).toBe(cp);
      if (b === null) return;
      t.count('bracket');
      expect(b.pair).toBe(m);
      const back = pairedBracket(b.pair)!;
      expect(back.pair).toBe(cp);
      expect(back.kind).toBe(b.kind === 'open' ? 'close' : 'open');
    }), runs(RUNS));
    t.atLeast('plain', 100);
    t.atLeast('mirrored', 100);
    t.atLeast('bracket', 20);
  }, timeoutFor(RUNS, 1));

  it('classes anything handed over, a non-code point as L', () => {
    fc.assert(fc.property(fc.oneof(anyCodePoint, fc.double()), (cp) => {
      const c = bidiClassOf(cp);
      expect(typeof c).toBe('string');
      if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) expect(c).toBe('L');
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
