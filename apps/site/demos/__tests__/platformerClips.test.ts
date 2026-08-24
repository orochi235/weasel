// apps/site/demos/__tests__/platformerClips.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSkeleton } from '@weasel-js/core';
import { BONE_LENGTH, JOINT_ORDER, PLAYER_SKELETON } from '../platformer/skeleton';
import { CLIPS, poseInterpolate, samplePose } from '../platformer/clips';

describe('PLAYER_SKELETON', () => {
  it('has eleven joints in topological order', () => {
    expect(PLAYER_SKELETON.joints).toHaveLength(11);
    const seen = new Set<string>();
    for (const j of PLAYER_SKELETON.joints) {
      if (j.parent !== null) expect(seen.has(j.parent)).toBe(true);
      seen.add(j.name);
    }
    expect(seen.size).toBe(11);
  });

  it('resolves without throwing and gives every joint a matrix', () => {
    const joints = resolveSkeleton(PLAYER_SKELETON, {});
    expect(joints.size).toBe(11);
    for (const name of JOINT_ORDER) expect(joints.get(name)).toBeInstanceOf(Float32Array);
  });

  it('gives every drawable bone a length', () => {
    for (const name of JOINT_ORDER) expect(BONE_LENGTH[name]).toBeGreaterThan(0);
  });
});

describe('poseInterpolate', () => {
  it('returns the endpoints at u = 0 and u = 1', () => {
    const a = { torso: { rotation: 0.5 } };
    const b = { torso: { rotation: -0.5 } };
    expect(poseInterpolate(a, b, 0).torso.rotation).toBeCloseTo(0.5, 6);
    expect(poseInterpolate(a, b, 1).torso.rotation).toBeCloseTo(-0.5, 6);
  });

  it('blends halfway', () => {
    const a = { torso: { rotation: 1 } };
    const b = { torso: { rotation: 0 } };
    expect(poseInterpolate(a, b, 0.5).torso.rotation).toBeCloseTo(0.5, 6);
  });
});

describe('samplePose', () => {
  it('returns a pose at any t within every clip', () => {
    for (const [name, clip] of Object.entries(CLIPS)) {
      for (const u of [0, 0.13, 0.5, 0.87, 1]) {
        const pose = samplePose(clip, u * clip.duration);
        expect(Object.keys(pose).length, `${name} at u=${u}`).toBeGreaterThan(0);
      }
    }
  });

  it('clamps out-of-range t rather than returning undefined', () => {
    const run = CLIPS.run;
    expect(samplePose(run, -500)).toEqual(samplePose(run, 0));
    expect(samplePose(run, run.duration + 500)).toEqual(samplePose(run, run.duration));
  });

  it('makes the run cycle seamless — its last key matches its first', () => {
    const run = CLIPS.run;
    const start = samplePose(run, 0);
    const end = samplePose(run, run.duration);
    for (const joint of Object.keys(start)) {
      expect(end[joint]?.rotation ?? 0, `joint ${joint}`).toBeCloseTo(start[joint]?.rotation ?? 0, 6);
    }
  });

  it('swings the legs in opposition through the run cycle', () => {
    const quarter = samplePose(CLIPS.run, CLIPS.run.duration * 0.25);
    expect(Math.sign(quarter.thighL!.rotation!)).toBe(-Math.sign(quarter.thighR!.rotation!));
  });
});
