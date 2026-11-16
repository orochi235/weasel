/**
 * Property tests for `settleWithinRounding`, beneath align and distribute, and `childVerdict`'s rule for a
 * parent with no pages.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { asNodeId } from 'core/scene/types';
import { settleWithinRounding } from './settleWithinRounding';
import { childVerdict } from './admitsChild';
import { runs, timeoutFor } from './pbt.fixture';

const N = 200;
const coord = (limit: number) => fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });

describe('settleWithinRounding', () => {
  it('answers the target or, within rounding at the scale, the current value', () => {
    fc.assert(fc.property(coord(1e6), coord(1e6), coord(1e6), (current, target, scale) => {
      const got = settleWithinRounding(current, target, scale);
      expect(got === current || got === target).toBe(true);
      if (got !== target) expect(Math.abs(target - current)).toBeLessThanOrEqual(Math.max(1, Math.abs(scale)) * 1e-9);
      expect(settleWithinRounding(current, current, scale)).toBe(current);
    }), runs(N));
  }, timeoutFor(N, 1));
});

describe('childVerdict without pages', () => {
  it('a locked parent takes nothing; otherwise canDropInto decides when given, else a group does and a mark does not', () => {
    const kinds = fc.constantFrom('group', 'mark', 'text', 'path');
    fc.assert(fc.property(kinds, fc.boolean(), fc.option(fc.boolean(), { nil: undefined }), fc.array(fc.string({ maxLength: 4 }), { maxLength: 3 }),
      (kind, locked, drop, ids) => {
        const parent = asNodeId('p');
        const scene = {
          get: (id: string) => (id === 'p' ? { kind } : { kind: 'mark' }),
          isLocked: (id: string) => id === 'p' && locked,
        };
        const canDropInto = drop === undefined ? undefined : () => drop;
        const want = locked ? false : drop !== undefined ? drop : kind === 'group';
        expect(childVerdict(scene as never, parent, ids, canDropInto)).toBe(want);
      }), runs(N));
  }, timeoutFor(N, 1));
});
