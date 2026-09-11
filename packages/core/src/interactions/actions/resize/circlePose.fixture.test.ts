import { describe, it, expect } from 'vitest';
import { circle, CIRCLE_POSE_DESCRIPTOR as D } from './circlePose.fixture';

describe('circle probe', () => {
  it('round-trips through its own bounds', () => {
    const c = circle(10, 20, 5);
    expect(D.getBounds(c)).toEqual({ x: 5, y: 15, width: 10, height: 10 });
    expect(D.fromBounds(D.getBounds(c), c)).toEqual(c);
    expect(D.translate!(c, 3, -4)).toEqual(circle(13, 16, 5));
  });
});
