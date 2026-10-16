import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { strokeEdgeNear } from './strokeEdge';

const LINE = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
const stroke: Stroke = { paint: { color: '#000' }, width: 4 };

describe('strokeEdgeNear', () => {
  it('finds the edge on the side of the path a point is on', () => {
    const below = strokeEdgeNear(LINE, stroke, 30, 3)!;
    expect(below.side).toBe('right');
    expect(below.x).toBeCloseTo(30, 6);
    expect(below.y).toBeCloseTo(0, 6);
    expect(below.ny).toBeCloseTo(1, 6);
    expect(below.right).toBeCloseTo(2, 6);
    expect(below.gap).toBeCloseTo(1, 6);
    const above = strokeEdgeNear(LINE, stroke, 30, -1.5)!;
    expect(above.side).toBe('left');
    expect(above.ny).toBeCloseTo(-1, 6);
    expect(above.gap).toBeCloseTo(-0.5, 6);
  });

  it('reads each side of a pair, interpolated, with the nib applied', () => {
    const sided: Stroke = { ...stroke, vertexWidths: [{ left: 2, right: 10 }, { left: 2, right: 2 }] };
    const mid = strokeEdgeNear(LINE, sided, 50, 9)!;
    expect(mid.right).toBeCloseTo(6, 5);
    expect(mid.left).toBeCloseTo(2, 5);
    expect(strokeEdgeNear(LINE, sided, 50, -9)!.side).toBe('left');
    const nib = strokeEdgeNear(LINE, { ...sided, nib: { angle: 0, ratio: 0.5 } }, 50, 9)!;
    expect(nib.right).toBeCloseTo(3, 5);
    expect(nib.factor).toBeCloseTo(0.5, 5);
  });

  it('measures a point past the end of a segment by its straight distance', () => {
    const far = strokeEdgeNear(LINE, stroke, 300, 1)!;
    expect(far.gap).toBeCloseTo(Math.hypot(200, 1) - 2, 6);
  });

  it('answers null for a path with no segments', () => {
    expect(strokeEdgeNear(new PathBuilder().moveTo(5, 5).build(), stroke, 5, 5)).toBeNull();
  });
});
