import { describe, expect, it } from 'vitest';
import { pointInTextPose } from './hitTest';
import type { TextPose } from './textLayer';

const pose: TextPose = { x: 10, y: 20, width: 100, height: 40, text: 'hi' };

describe('pointInTextPose', () => {
  it('hits inside the rect', () => {
    expect(pointInTextPose(50, 30, pose)).toBe(true);
  });

  it('misses outside the rect', () => {
    expect(pointInTextPose(5, 30, pose)).toBe(false);
    expect(pointInTextPose(50, 70, pose)).toBe(false);
  });

  it('treats edges as inside', () => {
    expect(pointInTextPose(10, 20, pose)).toBe(true);
    expect(pointInTextPose(110, 60, pose)).toBe(true);
  });

  it('respects padding', () => {
    expect(pointInTextPose(8, 30, pose)).toBe(false);
    expect(pointInTextPose(8, 30, pose, { padding: 4 })).toBe(true);
  });
});
