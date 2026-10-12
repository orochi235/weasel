import { describe, expect, it } from 'vitest';
import * as kit from '../../index';

describe('rig public surface', () => {
  it('exports the rig helpers from the package entry', () => {
    expect(typeof kit.skeletonAxes).toBe('function');
    expect(typeof kit.jointAxes).toBe('function');
    expect(typeof kit.mirrorPose).toBe('function');
    expect(typeof kit.resolveSkeleton).toBe('function');
    expect(typeof kit.bindRig).toBe('function');
    expect(typeof kit.useRig).toBe('function');
    expect(typeof kit.rigidRigApply).toBe('function');
    expect(typeof kit.solveIk).toBe('function');
    expect(typeof kit.skinPath).toBe('function');
    expect(typeof kit.autoSkin).toBe('function');
    expect(typeof kit.motionsFromRest).toBe('function');
    expect(typeof kit.dataRestPath).toBe('function');
    expect(typeof kit.rigFromNode).toBe('function');
    for (const name of ['addJoint', 'dropSkinJoints', 'jointAt', 'jointPositions', 'moveJoint', 'removeJoint'] as const) {
      expect(typeof kit[name]).toBe('function');
    }
    expect(typeof kit.useRigNode).toBe('function');
    expect(kit.IDENTITY_JOINT).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
  });

  it('exports sampleTrack from the package entry', () => {
    expect(typeof kit.sampleTrack).toBe('function');
  });

  it('exports the mat3 namespace, so a resolved joint can be read without indexing it', () => {
    expect(typeof kit.mat3.apply).toBe('function');
    expect(typeof kit.mat3.multiply).toBe('function');

    const skeleton: kit.Skeleton = {
      joints: [{ name: 'hip', parent: null, bind: { ...kit.IDENTITY_JOINT, x: 10, y: 20 } }],
    };
    const hip = kit.resolveSkeleton(skeleton, {}).get('hip')!;
    expect(kit.mat3.apply(hip, 0, 0)).toEqual([10, 20]);
    expect(kit.mat3.apply(hip, 5, 0)).toEqual([15, 20]);
  });

  it('does not export createTimeline, which takes an internal seam', () => {
    expect('createTimeline' in kit).toBe(false);
  });
});
