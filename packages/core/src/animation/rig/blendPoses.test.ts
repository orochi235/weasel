import { describe, expect, it } from 'vitest';
import { blendPoses } from './blendPoses';
import type { Pose } from './types';

describe('blendPoses', () => {
  it('returns an empty pose for no inputs', () => {
    expect(blendPoses([], [])).toEqual({});
  });

  it('fills a single pose out to a full delta at weight 1', () => {
    const p: Pose = { hip: { x: 10, rotation: 0.5 } };
    expect(blendPoses([p], [1])).toEqual({
      hip: { x: 10, y: 0, rotation: 0.5, scaleX: 1, scaleY: 1 },
    });
  });

  it('averages two poses at equal weights', () => {
    const a: Pose = { hip: { x: 0 } };
    const b: Pose = { hip: { x: 10 } };
    expect(blendPoses([a, b], [0.5, 0.5]).hip!.x).toBe(5);
  });

  it('normalizes weights that do not sum to 1', () => {
    const a: Pose = { hip: { x: 0 } };
    const b: Pose = { hip: { x: 10 } };
    expect(blendPoses([a, b], [1, 1]).hip.x).toBe(5);
  });

  it('unions joints across poses, treating an absent joint as bind', () => {
    const a: Pose = { hip: { x: 10 } };
    const b: Pose = { knee: { x: 20 } };
    const out = blendPoses([a, b], [0.5, 0.5]);
    expect(out.hip!.x).toBe(5);
    expect(out.knee!.x).toBe(10);
  });

  it('treats an absent field as its identity, not as zero for scale', () => {
    const a: Pose = { hip: { scaleX: 3 } };
    const b: Pose = { hip: { x: 4 } };
    const out = blendPoses([a, b], [0.5, 0.5]);
    expect(out.hip!.scaleX).toBe(2);   // (3 + 1) / 2
    expect(out.hip!.x).toBe(2);        // (0 + 4) / 2
  });

  it('blends rotation the short way around the circle', () => {
    const a: Pose = { hip: { rotation: 0.1 } };
    const b: Pose = { hip: { rotation: Math.PI * 2 - 0.1 } };
    expect(blendPoses([a, b], [0.5, 0.5]).hip!.rotation).toBeCloseTo(0, 6);
  });

  it('returns an empty pose when the weights sum to zero', () => {
    expect(blendPoses([{ hip: { x: 10 } }], [0])).toEqual({});
  });

  it('wraps a rotation delta of more than a full turn', () => {
    const a: Pose = { hip: { rotation: 0 } };
    const b: Pose = { hip: { rotation: Math.PI * 6 + 0.2 } };
    expect(blendPoses([a, b], [0.5, 0.5]).hip!.rotation).toBeCloseTo(0.1, 6);
  });

  it('blends the short way from the larger angle, leaving the result unnormalized', () => {
    const a: Pose = { hip: { rotation: Math.PI * 2 - 0.1 } };
    const b: Pose = { hip: { rotation: 0.1 } };
    expect(blendPoses([a, b], [0.5, 0.5]).hip!.rotation).toBeCloseTo(Math.PI * 2, 6);
  });

  it('rotates a joint absent from the first pose toward the pose that has it', () => {
    const a: Pose = { hip: { x: 1 } };
    const b: Pose = { knee: { rotation: 1 } };
    expect(blendPoses([a, b], [0.5, 0.5]).knee!.rotation).toBe(0.5);
  });

  it('throws when the weight count does not match the pose count', () => {
    expect(() => blendPoses([{}, {}], [1])).toThrow(/weights/);
  });
});
