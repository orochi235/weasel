/**
 * Every descriptor that can *write* a rotation has to be able to read one
 * back. A descriptor missing `getRotation` reports 0 for a pose it just
 * rotated, and the halves of the kit that read rotation through the descriptor
 * — `useResize`, diagram's port placement — then disagree with the half that
 * duck-types `pose.rotation` to paint it.
 */

import { describe, it, expect } from 'vitest';
import { RECT_POSE_DESCRIPTOR, ROTATED_POSE_DESCRIPTOR, type PoseDescriptor } from './poseDescriptor';

const DESCRIPTORS: Array<[string, PoseDescriptor<never>]> = [
  ['RECT_POSE_DESCRIPTOR', RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<never>],
  ['ROTATED_POSE_DESCRIPTOR', ROTATED_POSE_DESCRIPTOR as unknown as PoseDescriptor<never>],
];

describe.each(DESCRIPTORS)('%s', (_name, descriptor) => {
  it('reads back the rotation it writes', () => {
    expect(descriptor.withRotation).toBeDefined();
    expect(descriptor.getRotation).toBeDefined();
    const pose = { x: 0, y: 0, width: 10, height: 10, rotation: 0 } as never;
    const rotated = descriptor.withRotation!(pose, Math.PI / 4);
    expect(descriptor.getRotation!(rotated)).toBeCloseTo(Math.PI / 4);
  });
});

describe('RECT_POSE_DESCRIPTOR', () => {
  it('reports 0 for a pose that carries no rotation field', () => {
    expect(RECT_POSE_DESCRIPTOR.getRotation!({ x: 0, y: 0, width: 1, height: 1 })).toBe(0);
  });
});
