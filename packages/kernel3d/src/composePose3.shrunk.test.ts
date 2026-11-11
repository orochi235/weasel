/** Counterexamples `composePose3.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { POSE3_COMPOSITION } from './composePose3';
import type { Pose3 } from './pose3';

describe('POSE3_COMPOSITION (shrunk)', () => {
  it('reads a world pose into a frame scaled subnormally as one collapsed along those axes', () => {
    const frame: Pose3 = { position: { x: 0, y: 0, z: 0 }, rotation: [0, 0, 0, 1], scale: { x: 5e-324, y: 5e-324, z: 0.1 } };
    const world: Pose3 = { position: { x: 4, y: 5, z: 6 }, rotation: [0, 0, 0, 1], scale: { x: 0.1, y: 0.1, z: 0.1 } };
    const local = POSE3_COMPOSITION.decompose(frame, world);
    expect(local.position).toEqual({ x: 0, y: 0, z: 60 });
    expect(local.scale.x).toBe(0.1);
    expect(local.scale.y).toBe(0.1);
    expect(local.scale.z).toBeCloseTo(1, 15);
  });
});
