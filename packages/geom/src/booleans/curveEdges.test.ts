import { describe, expect, it } from 'vitest';
import { cutEdges } from './curveEdges';
import { evalSeg, type Seg } from './contourSegments';

describe('cutEdges', () => {
  it('cuts a cubic at a self-crossing whose parameters both lie below t = 0.5', () => {
    const loop: Seg = [{ x: 0, y: 0 }, { x: 6, y: 4 }, { x: -16, y: 0 }, { x: 46, y: -12 }];
    const back: Seg = [loop[3], loop[0]];
    const { points } = cutEdges([[[loop, back]]], 1e-6);
    const x = evalSeg(loop, 0.08633658232300576);
    expect(points.some((p) => Math.hypot(p.x - x.x, p.y - x.y) < 1e-6)).toBe(true);
  });
});
