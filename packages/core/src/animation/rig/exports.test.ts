import { describe, expect, it } from 'vitest';
import { IDENTITY_JOINT, resolveSkeleton, type Skeleton } from '@weasel-js/animator';
import * as kit from '../../index';

describe('rig public surface', () => {
  it('exports the scene-bound rig helpers from the package entry', () => {
    expect(typeof kit.bindRig).toBe('function');
    expect(typeof kit.useRig).toBe('function');
    expect(typeof kit.rigidRigApply).toBe('function');
    for (const name of ['dataRestPath', 'placeSkeleton', 'rigFromNode', 'unplaceSkeleton', 'useRigNode'] as const) {
      expect(typeof kit[name]).toBe('function');
    }
  });

  it('exports the mat3 namespace, so a resolved joint can be read without indexing it', () => {
    expect(typeof kit.mat3.apply).toBe('function');
    expect(typeof kit.mat3.multiply).toBe('function');

    const skeleton: Skeleton = {
      joints: [{ name: 'hip', parent: null, bind: { ...IDENTITY_JOINT, x: 10, y: 20 } }],
    };
    const hip = resolveSkeleton(skeleton, {}).get('hip')!;
    expect(kit.mat3.apply(hip, 0, 0)).toEqual([10, 20]);
    expect(kit.mat3.apply(hip, 5, 0)).toEqual([15, 20]);
  });
});
