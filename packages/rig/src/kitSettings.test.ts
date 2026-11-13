import { describe, expect, it } from 'vitest';
import { JOINT_RADIUS_PX } from './bone/boneOverlay';
import { rigKitSettingsSchema } from './kitSettings';
import { POINT_RADIUS_PX } from './weight/weightOverlay';

describe('rigKitSettingsSchema', () => {
  it('defaults every leaf to its constant', () => {
    const { boneJointRadiusPx, weightPointRadiusPx } = rigKitSettingsSchema.children.targets.children;
    expect([boneJointRadiusPx.default, weightPointRadiusPx.default]).toEqual([JOINT_RADIUS_PX, POINT_RADIUS_PX]);
  });
});
