/** Counterexamples `orbit.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { createCamera, dollyBy, dollyToward, orbitBy, panBy } from './camera';

describe('orbit camera gestures (shrunk)', () => {
  const c = createCamera({ distance: 0.5, fov: 0.2 });

  it('leave the camera as it is for a NaN turn', () => {
    expect(orbitBy(c, NaN, 0)).toBe(c);
  });

  it('leave the camera as it is for a NaN dolly, about the middle or a point', () => {
    expect(dollyBy(c, NaN)).toBe(c);
    expect(dollyToward(c, NaN, { x: 0, y: 0 }, { width: 1, height: 1 })).toEqual(c);
  });

  it('leave the camera as it is for a pan past the double range', () => {
    const far = createCamera({ distance: 1e300 });
    expect(panBy(far, 1e10, 0, 1)).toBe(far);
    expect(panBy(c, NaN, 0, 600)).toBe(c);
  });
});
