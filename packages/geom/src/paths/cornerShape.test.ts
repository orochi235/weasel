import { describe, expect, it } from 'vitest';
import {
  CORNER_FIT_TOLERANCE,
  cornerKeywordOf,
  cornerShapeK,
  cornerShapePieces,
  cornerShapePoint,
  nextCornerShape,
  type CornerPiece,
  type CornerShapeFrame,
} from './cornerShape';
import type { Point } from './cubicMath';

// A right-angle corner at (100, 0) with a setback of 10 along each edge.
const FRAME: CornerShapeFrame = { start: { x: 90, y: 0 }, end: { x: 100, y: 10 }, outer: { x: 100, y: 0 } };

/** Points along the pieces, starting from the frame's start. */
function trace(pieces: CornerPiece[], from: Point, steps = 2000): Point[] {
  const out: Point[] = [];
  let p0 = from;
  for (const piece of pieces) {
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (piece.kind === 'line') {
        out.push({ x: p0.x + (piece.to.x - p0.x) * t, y: p0.y + (piece.to.y - p0.y) * t });
      } else {
        const u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        out.push({
          x: a * p0.x + b * piece.c1.x + c * piece.c2.x + d * piece.to.x,
          y: a * p0.y + b * piece.c1.y + c * piece.c2.y + d * piece.to.y,
        });
      }
    }
    p0 = piece.to;
  }
  return out;
}

const near = (pts: Point[], q: Point) => Math.min(...pts.map((p) => Math.hypot(p.x - q.x, p.y - q.y)));

describe('corner-shape keywords', () => {
  it('are the points CSS puts them on the superellipse parameter', () => {
    expect(['square', 'squircle', 'round', 'bevel', 'scoop', 'notch'].map((w) => cornerShapeK(w as never)))
      .toEqual([Infinity, 2, 1, 0, -1, -Infinity]);
    expect(cornerShapeK(0.5)).toBe(0.5);
    expect(cornerKeywordOf(-1)).toBe('scoop');
    expect(cornerKeywordOf(0.5)).toBeNull();
  });

  it('cycle from the most convex to the most concave, and from a number to the next keyword below it', () => {
    expect(nextCornerShape('square')).toBe('squircle');
    expect(nextCornerShape('notch')).toBe('square');
    expect(nextCornerShape(1.5)).toBe('round');
    expect(nextCornerShape(-3)).toBe('notch');
  });
});

describe('cornerShapePieces', () => {
  it('draws round (k = 1) as the cubic quarter arc the kit draws a fillet with', () => {
    const [piece, ...rest] = cornerShapePieces(1, FRAME);
    expect(rest).toHaveLength(0);
    const k = (4 / 3) * Math.tan(Math.PI / 8) * 10;
    expect(piece).toEqual({ kind: 'cubic', c1: { x: 90 + k, y: 0 }, c2: { x: 100, y: 10 - k }, to: { x: 100, y: 10 } });
  });

  it('draws scoop (k = -1) as the same arc centered on the outer corner', () => {
    const [piece] = cornerShapePieces(-1, FRAME);
    const k = (4 / 3) * Math.tan(Math.PI / 8) * 10;
    expect(piece.kind).toBe('cubic');
    if (piece.kind !== 'cubic') return;
    expect(piece.c1.x).toBeCloseTo(90, 9);
    expect(piece.c1.y).toBeCloseTo(k, 9);
    expect(piece.c2.x).toBeCloseTo(100 - k, 9);
    expect(piece.c2.y).toBeCloseTo(10, 9);
  });

  it('draws bevel (k = 0) as one straight cut', () => {
    expect(cornerShapePieces(0, FRAME)).toEqual([{ kind: 'line', to: FRAME.end }]);
  });

  it('draws square and notch as right angles through the outer corner and the center', () => {
    expect(cornerShapePieces(Infinity, FRAME)).toEqual([
      { kind: 'line', to: { x: 100, y: 0 } }, { kind: 'line', to: FRAME.end },
    ]);
    expect(cornerShapePieces(-Infinity, FRAME)).toEqual([
      { kind: 'line', to: { x: 90, y: 10 } }, { kind: 'line', to: FRAME.end },
    ]);
  });

  it.each([0.25, 0.5, 2, 3, 6, -0.5, -2, -4])('fits k = %s within tolerance of the true superellipse', (k) => {
    const pts = trace(cornerShapePieces(k, FRAME), FRAME.start);
    for (let i = 1; i < 40; i++) {
      const q = cornerShapePoint(k, FRAME, i / 40);
      expect(near(pts, q)).toBeLessThanOrEqual(CORNER_FIT_TOLERANCE * 10 * 1.5);
    }
    expect(pts.at(-1)!.x).toBeCloseTo(100, 9);
    expect(pts.at(-1)!.y).toBeCloseTo(10, 9);
  });

  it('puts the squircle where u^4 + v^4 = 1 says its middle is', () => {
    // The middle of the convex curve, spanned from the center (90, 10).
    const m = 0.5 ** (1 / 4) * 10;
    const pts = trace(cornerShapePieces(2, FRAME), FRAME.start);
    expect(near(pts, { x: 90 + m, y: 10 - m })).toBeLessThan(CORNER_FIT_TOLERANCE * 10 * 1.5);
  });

  it('mirrors a negative k through the cut', () => {
    const a = cornerShapePoint(2, FRAME, 0.3);
    const b = cornerShapePoint(-2, FRAME, 0.7);
    expect(a.x + b.x).toBeCloseTo(FRAME.start.x + FRAME.end.x, 9);
    expect(a.y + b.y).toBeCloseTo(FRAME.start.y + FRAME.end.y, 9);
  });
});
