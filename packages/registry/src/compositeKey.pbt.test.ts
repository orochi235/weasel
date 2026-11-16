/** Property test of `compositeKey`: two tuples share a key exactly when they are equal part by part. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compositeKey, type KeyPart } from './compositeKey';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;
const text = fc.string({ unit: fc.constantFrom('a', ':', '1', '#', ';', 'n', 'u', 't', 'f', '\0'), maxLength: 4 });
const part: fc.Arbitrary<KeyPart> = fc.oneof(text, fc.constantFrom<KeyPart>(0, -0, 1, 10, NaN, true, false, null, undefined));
const tuple = fc.array(part, { maxLength: 4 });
const same = (a: readonly KeyPart[], b: readonly KeyPart[]) => a.length === b.length && a.every((x, i) => x === b[i] || (Number.isNaN(x) && Number.isNaN(b[i])));

describe('compositeKey', () => {
  it('gives two tuples one key exactly when they are equal part by part', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(fc.tuple(tuple, tuple), tuple.map((a) => [a, [...a]] as const)), ([a, b]) => {
      const equal = same(a, b);
      expect(compositeKey(a) === compositeKey(b)).toBe(equal);
      t.count(equal ? 'equal' : 'differ');
    }), runs(RUNS));
    t.atLeast('equal', RUNS / 6);
    t.atLeast('differ', RUNS / 6);
  }, timeoutFor(RUNS, 1));
});
