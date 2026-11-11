/** Counterexamples diagram's router property tests shrank to, in the port curve they reached. */
import { describe, expect, it } from 'vitest';
import { portControls, portCurvePoints } from './portCurve';

const finite = (pts: readonly (readonly number[])[]) => pts.every((p) => p.every(Number.isFinite));

describe('port curves between far ends', () => {
  it('reaches a finite control point where the chord\'s square passes the double range', () => {
    expect(finite(portControls([0, 0], [1e300, 0], [1, 0], [Math.SQRT1_2, Math.SQRT1_2]))).toBe(true);
  });

  it('lerps along a chord that passes the double range', () => {
    const [c1, c2] = portControls([-Number.MAX_VALUE, 0], [Number.MAX_VALUE, 0], null, null);
    expect(finite([c1, c2])).toBe(true);
    expect(c1[0]).toBeLessThan(c2[0]!);
  });

  it('samples a finite curve whose controls sit at the double range\'s end', () => {
    const M = Number.MAX_VALUE;
    expect(finite(portCurvePoints([M, 0], [1e300, 0], [1, 0], [1, 0], 16))).toBe(true);
  });
});
