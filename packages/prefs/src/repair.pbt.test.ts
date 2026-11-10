import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { admits, leaf, runs, sameValue, stored, tally, timeoutFor, valueOf } from './pbt.fixture';
import { repairPrefValue } from './repair';

describe('repairPrefValue, properties', () => {
  it('reads anything stored as a value the leaf admits, and reads that value as itself', () => {
    const t = tally();
    fc.assert(
      fc.property(leaf(), stored, (l, s) => {
        const read = repairPrefValue(l, s);
        t.count(sameValue(read, l.default) ? 'default' : 'kept');
        expect(admits(l, read)).toBe(true);
        expect(sameValue(repairPrefValue(l, read), read)).toBe(true);
      }),
      runs(400),
    );
    t.atLeast('default', 20);
    t.atLeast('kept', 20);
  }, timeoutFor(400, 5));

  it('reads every value the leaf admits as itself', () => {
    const t = tally();
    fc.assert(
      fc.property(leaf().chain((l) => fc.tuple(fc.constant(l), valueOf(l))), ([l, v]) => {
        t.count(l.kind);
        expect(admits(l, v)).toBe(true);
        expect(sameValue(repairPrefValue(l, v), v)).toBe(true);
      }),
      runs(400),
    );
    for (const kind of ['number', 'enum', 'object', 'list', 'map', 'union']) t.atLeast(kind, 5);
  }, timeoutFor(400, 5));
});
