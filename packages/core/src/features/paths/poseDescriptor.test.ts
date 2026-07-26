import { describe, expect, it } from 'vitest';
import { pathPoseDescriptor } from './poseDescriptor';

describe('pathPoseDescriptor.lerp', () => {
  it('interpolates rect paths linearly', () => {
    const a = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } as const;
    const b = { kind: 'rect', x: 10, y: 10, width: 20, height: 20 } as const;
    expect(pathPoseDescriptor.lerp!(a, b, 0.5)).toEqual({
      kind: 'rect', x: 5, y: 5, width: 15, height: 15,
    });
  });
});

describe('pathPoseDescriptor.supportsRotation', () => {
  it('returns false for Path poses so the rotation affordance hides', () => {
    const p = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } as const;
    expect(pathPoseDescriptor.supportsRotation!(p)).toBe(false);
  });
});
