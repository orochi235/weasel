/**
 * Property tests of a fit scope's shared scale: it stays in `min..1`, and is the smallest any shared member needs.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor, uniform } from '../../pbt.fixture';
import { sharedScale } from './fitScale';

const RUNS = 400;
const scale = fc.oneof(uniform(0, 1.5), fc.constantFrom(0, 0.6, 1, 2));

describe('sharedScale', () => {
  it('stays in min..1 and is the smallest a shared member needs, or null with none shared', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(fc.record({ scale, shared: fc.boolean() }), { maxLength: 6 }), uniform(0.3, 1), (fits, min) => {
      const got = sharedScale(fits, min);
      const shared = fits.filter((f) => f.shared).map((f) => f.scale);
      if (!shared.length) { expect(got).toBeNull(); return; }
      if (shared.length > 1) t.count('shared');
      expect(got).toBeGreaterThanOrEqual(min);
      expect(got).toBeLessThanOrEqual(1);
      expect(got).toBe(Math.max(min, Math.min(1, ...shared)));
    }), runs(RUNS));
    t.atLeast('shared', 100);
  }, timeoutFor(RUNS, 1));
});
