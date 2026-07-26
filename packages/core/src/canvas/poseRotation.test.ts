import { describe, it, expect } from 'vitest';
import { rotateAroundAABBCenter, wrapWithPoseRotation } from './poseRotation';
import type { DrawCommand, GroupDrawCommand } from '../renderer';

describe('rotateAroundAABBCenter', () => {
  it('returns an identity-like matrix when rotation is zero', () => {
    const m = rotateAroundAABBCenter(0, 0, 100, 100, 0);
    expect(m[0]).toBeCloseTo(1);
    expect(m[1]).toBeCloseTo(0);
    expect(m[3]).toBeCloseTo(0);
    expect(m[4]).toBeCloseTo(1);
    expect(m[6]).toBeCloseTo(0);
    expect(m[7]).toBeCloseTo(0);
  });

  it('rotates around the AABB center, not the origin', () => {
    // 90deg rotation about center (50, 50) leaves the center fixed.
    const m = rotateAroundAABBCenter(0, 0, 100, 100, Math.PI / 2);
    // Apply to (50, 50): should map to (50, 50).
    const a = m[0], b = m[1], c = m[3], d = m[4], tx = m[6], ty = m[7];
    const x2 = a * 50 + c * 50 + tx;
    const y2 = b * 50 + d * 50 + ty;
    expect(x2).toBeCloseTo(50);
    expect(y2).toBeCloseTo(50);
  });
});

describe('wrapWithPoseRotation', () => {
  const RECT_CMD: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 10, y: 20, width: 80, height: 40 },
    fill: { color: '#abc' },
  };

  it('returns the input untouched when pose.rotation is zero', () => {
    const cmds = [RECT_CMD];
    const out = wrapWithPoseRotation(cmds, { x: 10, y: 20, width: 80, height: 40, rotation: 0 });
    expect(out).toBe(cmds);
  });

  it('returns the input untouched when pose has no rotation field', () => {
    const cmds = [RECT_CMD];
    const out = wrapWithPoseRotation(cmds, { x: 10, y: 20, width: 80, height: 40 });
    expect(out).toBe(cmds);
  });

  it('returns the input untouched when AABB fields are missing', () => {
    const cmds = [RECT_CMD];
    const out = wrapWithPoseRotation(cmds, { rotation: Math.PI / 4 });
    expect(out).toBe(cmds);
  });

  it('returns empty input untouched even with a valid rotation pose', () => {
    const out = wrapWithPoseRotation([], { x: 0, y: 0, width: 10, height: 10, rotation: 1 });
    expect(out).toEqual([]);
  });

  // Regression for the bug where consumers supplying a custom drawOne got
  // no rotation visualization. The wrap now happens at the kit level so
  // ANY drawOne output gets wrapped uniformly.
  it('wraps non-empty cmds in a group with rotateAroundAABBCenter transform when pose.rotation is non-zero', () => {
    // Custom consumer drawOne output — note: a single plain rect with NO
    // rotation handling of its own. The kit must add the rotation wrap.
    const customCmds: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: 10, y: 20, width: 80, height: 40 },
      fill: { color: '#f00' },
    }];
    const pose = { x: 10, y: 20, width: 80, height: 40, rotation: Math.PI / 4 };
    const out = wrapWithPoseRotation(customCmds, pose);
    expect(out).toHaveLength(1);
    const group = out[0] as GroupDrawCommand;
    expect(group.kind).toBe('group');
    expect(group.children).toBe(customCmds);
    expect(group.transform).toBeInstanceOf(Float32Array);
    const expected = rotateAroundAABBCenter(10, 20, 80, 40, Math.PI / 4);
    expect(Array.from(group.transform!)).toEqual(Array.from(expected));
  });
});
