import { describe, expect, it } from 'vitest';
import * as kit from '../../index';

describe('rig public surface', () => {
  it('exports the rig helpers from the package entry', () => {
    expect(typeof kit.blendPoses).toBe('function');
    expect(typeof kit.resolveSkeleton).toBe('function');
    expect(kit.IDENTITY_JOINT).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
  });

  it('exports sampleTrack from the package entry', () => {
    expect(typeof kit.sampleTrack).toBe('function');
  });

  it('does not export createTimeline, which takes an internal seam', () => {
    expect('createTimeline' in kit).toBe(false);
  });
});
