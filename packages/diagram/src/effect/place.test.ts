import { describe, expect, it } from 'vitest';
import { freeSpot, PLACE_GAP } from './place';

const size = { width: 100, height: 50 };
const view = { x: -200, y: -100, width: 800, height: 600 };

describe('freeSpot', () => {
  it("takes the view's top-left, inset by the gap, when nothing is in the way", () => {
    expect(freeSpot([], size, view)).toEqual({ x: -200 + PLACE_GAP, y: -100 + PLACE_GAP });
  });

  it('steps past a box in the way, keeping the gap from it', () => {
    const box = { x: -200, y: -100, width: 150, height: 80 };
    const at = freeSpot([box], size, view);
    expect(at.y).toBe(-100 + PLACE_GAP);
    expect(at.x).toBeGreaterThanOrEqual(box.x + box.width + PLACE_GAP);
    expect(at.x).toBeLessThan(box.x + box.width + PLACE_GAP + 8);
  });

  it('never overlaps what it has already placed', () => {
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < 12; i++) boxes.push({ ...freeSpot(boxes, size, view), ...size });
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
      expect(a.x).toBeGreaterThanOrEqual(view.x);
      expect(a.y + a.height).toBeLessThanOrEqual(view.y + view.height);
    }
  });

  it('goes right of the rightmost box when there is no view, or no room in it', () => {
    const boxes = [{ x: 0, y: 10, width: 100, height: 50 }, { x: 300, y: 40, width: 100, height: 50 }];
    expect(freeSpot(boxes, size, null)).toEqual({ x: 400 + PLACE_GAP, y: 40 });
    expect(freeSpot(boxes, size, { x: 0, y: 0, width: 120, height: 60 })).toEqual({ x: 400 + PLACE_GAP, y: 40 });
  });
});
