import { describe, it, expect } from 'vitest';
import { DRAG_THRESHOLD_PX, pastDragThreshold } from '../../index';

describe('pastDragThreshold', () => {
  const at = (clientX: number, clientY: number) => ({ clientX, clientY });

  it('holds a press under the threshold as a click', () => {
    expect(pastDragThreshold(at(10, 10), at(10 + DRAG_THRESHOLD_PX - 1, 10))).toBe(false);
  });

  it('turns a press into a drag at the threshold, in any direction', () => {
    expect(pastDragThreshold(at(10, 10), at(10, 10 - DRAG_THRESHOLD_PX))).toBe(true);
    expect(pastDragThreshold(at(0, 0), at(3, 3))).toBe(DRAG_THRESHOLD_PX <= Math.hypot(3, 3));
  });

  it('takes a threshold of its own', () => {
    expect(pastDragThreshold(at(0, 0), at(6, 0), 8)).toBe(false);
    expect(pastDragThreshold(at(0, 0), at(8, 0), 8)).toBe(true);
  });
});
