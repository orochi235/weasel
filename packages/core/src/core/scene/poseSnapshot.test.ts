import { describe, it, expect } from 'vitest';
import { samePoseValue, snapshotPose } from './poseSnapshot';

describe('snapshotPose / samePoseValue', () => {
  it('survives the pose being mutated in place', () => {
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    const snap = snapshotPose(pose);
    expect(samePoseValue(snap, pose)).toBe(true);
    pose.x = 50;
    expect(samePoseValue(snap, pose)).toBe(false);
  });

  it('holds for an equal pose at a different reference', () => {
    const snap = snapshotPose({ x: 1, y: 2 });
    expect(samePoseValue(snap, { x: 1, y: 2 })).toBe(true);
    expect(samePoseValue(snap, { x: 1, y: 2, rotation: 0 })).toBe(false);
  });

  it('walks nested objects, arrays and typed arrays', () => {
    const pose = { at: { x: 1, y: 2 }, points: [3, 4], matrix: new Float32Array([1, 0, 0, 1]) };
    const snap = snapshotPose(pose);
    pose.at.x = 9;
    expect(samePoseValue(snap, pose)).toBe(false);

    const other = { at: { x: 1, y: 2 }, points: [3, 4], matrix: new Float32Array([1, 0, 0, 1]) };
    expect(samePoseValue(snap, other)).toBe(true);
    other.matrix[3] = 2;
    expect(samePoseValue(snap, other)).toBe(false);
  });

  it('keeps the reference for a pose shape it cannot copy', () => {
    // A class instance or a Map is left to the scene's pushed invalidation.
    const pose = new Map([['x', 0]]);
    const snap = snapshotPose(pose);
    expect(snap).toBe(pose);
    expect(samePoseValue(snap, pose)).toBe(true);
    expect(samePoseValue(snap, new Map([['x', 0]]))).toBe(false);
  });

  it('distinguishes a missing key from an undefined one', () => {
    expect(samePoseValue(snapshotPose({ x: 1 }), { y: 1 })).toBe(false);
    expect(samePoseValue(snapshotPose({ x: undefined }), {})).toBe(false);
  });
});
