import { describe, expect, it } from 'vitest';
import { RECT_POSE_DESCRIPTOR } from './geometry';

describe('RECT_POSE_DESCRIPTOR.lerp', () => {
  it('interpolates x/y/width/height linearly', () => {
    const a = { x: 0, y: 0, width: 10, height: 20 };
    const b = { x: 100, y: 200, width: 30, height: 40 };
    const m = RECT_POSE_DESCRIPTOR.lerp!(a, b, 0.5);
    expect(m).toEqual({ x: 50, y: 100, width: 20, height: 30 });
  });

  it('endpoints reproduce exactly', () => {
    const a = { x: 1, y: 2, width: 3, height: 4 };
    const b = { x: 5, y: 6, width: 7, height: 8 };
    expect(RECT_POSE_DESCRIPTOR.lerp!(a, b, 0)).toEqual(a);
    expect(RECT_POSE_DESCRIPTOR.lerp!(a, b, 1)).toEqual(b);
  });
});
