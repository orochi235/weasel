import { describe, expect, it } from 'vitest';
import * as animator from './index';

describe('animator public surface', () => {
  it('exports the skeleton helpers from the package entry', () => {
    expect(typeof animator.skeletonAxes).toBe('function');
    expect(typeof animator.jointAxes).toBe('function');
    expect(typeof animator.mirrorPose).toBe('function');
    expect(typeof animator.resolveSkeleton).toBe('function');
    expect(typeof animator.solveIk).toBe('function');
    expect(animator.IDENTITY_JOINT).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
  });

  it('exports sampleTrack from the package entry', () => {
    expect(typeof animator.sampleTrack).toBe('function');
  });

  it('does not export createTimeline, which takes an internal seam', () => {
    expect('createTimeline' in animator).toBe(false);
  });
});
