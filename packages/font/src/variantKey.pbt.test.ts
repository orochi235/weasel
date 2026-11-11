import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { FontStyle } from './fontStyle';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { textureCacheKey } from './textureCacheKey';
import { variantKey } from './variantKey';

const RUNS = 200;
const weight = fc.oneof(
  fc.constantFrom(100, 400, 700, 900, 0, -0, NaN, Infinity, 1e21, 400.5),
  fc.integer({ min: 1, max: 1000 }),
  fc.double(),
);
const style = fc.constantFrom<FontStyle>('normal', 'italic');
const family = fc.oneof(fc.constantFrom('Inter', 'a|b', 'a', '', '|', 'a|400', 'Inter|400|normal'), fc.string({ maxLength: 6 }));
const variant = fc.tuple(family, weight, style);
type Variant = [string, number, FontStyle];
const same = (a: Variant, b: Variant): boolean => a[0] === b[0] && (a[1] === b[1] || (a[1] !== a[1] && b[1] !== b[1])) && a[2] === b[2];

describe('variant and texture keys, property', () => {
  it('key equal variants alike and distinct ones apart, through any order of asks', () => {
    const t = tally();
    const asked = fc.array(variant, { minLength: 1, maxLength: 6 }).chain((pool) =>
      fc.array(fc.constantFrom(...pool), { minLength: 1, maxLength: 30 }));
    fc.assert(fc.property(asked, (asks) => {
      const keys = asks.map(([f, w, s]) => ({ texture: textureCacheKey(f, w, s), variant: variantKey(w, s) }));
      for (let i = 0; i < asks.length; i++) {
        expect(keys[i]!.texture).toBe(textureCacheKey(asks[i]![0], asks[i]![1], asks[i]![2]));
        for (let j = i + 1; j < asks.length; j++) {
          const a = asks[i]!, b = asks[j]!;
          const eq = same(a, b);
          t.count(eq ? 'same' : 'apart');
          expect(keys[i]!.texture === keys[j]!.texture).toBe(eq);
          expect(keys[i]!.variant === keys[j]!.variant).toBe(same(['', a[1], a[2]], ['', b[1], b[2]]));
        }
      }
    }), runs(RUNS));
    t.atLeast('same', 50);
    t.atLeast('apart', 500);
  }, timeoutFor(RUNS, 2));
});
