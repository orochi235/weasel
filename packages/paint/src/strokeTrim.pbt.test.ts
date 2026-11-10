import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { strokeTrimKey, type StrokeTrim, type TrimAt } from './strokeTrim';
import { runs, tally } from './pbt.fixture';

const RUNS = runs(300);
const at: fc.Arbitrary<TrimAt> = fc.oneof(
  fc.constantFrom(0, 0.5, 1),
  fc.constantFrom(0, 2).map((length) => ({ length })),
  fc.constantFrom(0, 2).map((anchor) => ({ anchor })),
  fc.constantFrom(0, 2).map((subpath) => ({ subpath })),
);
const trim: fc.Arbitrary<StrokeTrim | undefined> = fc.option(fc.record({
  start: fc.option(at, { nil: undefined }),
  end: fc.option(at, { nil: undefined }),
  pace: fc.constantFrom(undefined, 'length' as const, 'anchor' as const),
}, { requiredKeys: [] }), { nil: undefined });

/** A trim with every default written in. */
const filled = (t: StrokeTrim | undefined) => (t === undefined ? 'none' : JSON.stringify([t.start ?? 0, t.end ?? 1, t.pace ?? 'length']));

describe('strokeTrimKey, property', () => {
  it('keys two trims alike exactly when they name the same edges and pace', () => {
    const t = tally();
    fc.assert(fc.property(trim, trim, (a, b) => {
      const same = strokeTrimKey(a) === strokeTrimKey(b);
      t.count(same ? 'alike' : 'apart');
      expect(same).toBe(filled(a) === filled(b));
    }), { numRuns: RUNS.numRuns * 3 });
    t.atLeast('alike', 1);
    t.atLeast('apart', 1);
  });
});
