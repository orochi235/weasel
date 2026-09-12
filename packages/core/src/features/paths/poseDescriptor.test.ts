import { describe, expect, it } from 'vitest';
import { pathPoseDescriptor } from './poseDescriptor';
import { polygonFromPoints } from './builder';

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

describe('pathPoseDescriptor.remapBounds on a degenerate source axis', () => {
  it('translates the collapsed axis instead of scaling it to zero', () => {
    // A zero-width source box: there is no ratio to scale by, and a zero scale
    // is not invertible. Match `scalePathToBounds`, which shifts the axis.
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 5, y: 10 }]);
    const out = pathPoseDescriptor.remapBounds(
      p,
      { x: 0, y: 0, width: 0, height: 10 },
      { x: 100, y: 0, width: 50, height: 10 },
    );
    expect(out.kind).toBe('polygon');
    expect(Array.from((out as { coords: Float32Array }).coords)).toEqual([100, 0, 105, 10]);
  });
});
