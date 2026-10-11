import { describe, expect, it } from 'vitest';
import { applyToPoint } from '@weasel-js/geom';
import { RECT_POSE_DESCRIPTOR } from 'core/geometry/poseDescriptor';
import { poseFrameOf } from 'core/geometry/poseFrame';
import type { RectPose } from 'core/scene/types';
import { flipPoseViaDescriptor, type FlipAxis } from './helpers';

const corners = (p: RectPose): [number, number][] => [
  [p.x, p.y], [p.x + p.width, p.y], [p.x + p.width, p.y + p.height], [p.x, p.y + p.height],
];

describe('flipping a pose that carries a transform', () => {
  const pose: RectPose = { x: 10, y: 20, width: 40, height: 10, rotation: 0.3, transform: [2, 0, 0.5, 1] };

  it.each<FlipAxis>(['x', 'y'])('mirrors the drawn box across its own %s centerline', (axis) => {
    const flipped = flipPoseViaDescriptor(pose, axis, RECT_POSE_DESCRIPTOR as never);
    const cx = pose.x + pose.width / 2, cy = pose.y + pose.height / 2;
    const mirror = ([x, y]: [number, number]): [number, number] =>
      (axis === 'x' ? [2 * cx - x, y] : [x, 2 * cy - y]);
    // Each local corner's mirror image is drawn at the mirror of where it was drawn.
    const before = corners(pose).map(([x, y]) => mirror(applyToPoint(poseFrameOf(pose)!, x, y)));
    const after = corners(pose).map((c) => applyToPoint(poseFrameOf(flipped)!, ...mirror(c)));
    after.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(before[i][0], 9);
      expect(y).toBeCloseTo(before[i][1], 9);
    });
  });

  it('leaves a pose without a transform without one', () => {
    const flipped = flipPoseViaDescriptor({ x: 0, y: 0, width: 4, height: 2, rotation: 0.3 }, 'x', RECT_POSE_DESCRIPTOR as never);
    expect('transform' in (flipped as object)).toBe(false);
  });
});
