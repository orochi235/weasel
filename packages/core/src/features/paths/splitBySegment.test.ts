import { describe, it, expect } from 'vitest';
import { splitPathBySegment } from './splitBySegment';
import { PathBuilder, rectPath, polygonFromPoints } from './builder';
import { extractPolylines } from './tessellate/polyline';
import { boundsOfPath } from './bounds';
import { pointInPath } from './hitTest';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type Path, type PolygonPath } from './types';
import type { Point } from './cubicMath';

/** Net filled area: signed ring areas summed, so holes subtract when they wind opposite. */
const area = (p: Path): number => {
  let total = 0;
  for (const pl of extractPolylines(p, { flattenTolerance: 0.01 })) {
    const pts = pl.points;
    let a = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const j = (i + 2) % pts.length;
      a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
    }
    total += a / 2;
  }
  return Math.abs(total);
};

type Seg = { cmd: number; pts: Point[] };

/** Every drawing segment of a polygon path, with its start point prepended. */
const segmentsOf = (p: PolygonPath): Seg[] => {
  const out: Seg[] = [];
  let cur: Point = { x: 0, y: 0 };
  let start: Point = cur;
  let k = 0;
  for (const cmd of p.commands) {
    const c = p.coords;
    if (cmd === PATH_M) { cur = start = { x: c[k], y: c[k + 1] }; k += 2; }
    else if (cmd === PATH_L) { const e = { x: c[k], y: c[k + 1] }; out.push({ cmd, pts: [cur, e] }); cur = e; k += 2; }
    else if (cmd === PATH_Q) {
      const e = { x: c[k + 2], y: c[k + 3] };
      out.push({ cmd, pts: [cur, { x: c[k], y: c[k + 1] }, e] }); cur = e; k += 4;
    } else if (cmd === PATH_C) {
      const e = { x: c[k + 4], y: c[k + 5] };
      out.push({ cmd, pts: [cur, { x: c[k], y: c[k + 1] }, { x: c[k + 2], y: c[k + 3] }, e] }); cur = e; k += 6;
    } else if (cmd === PATH_Z) { cur = start; }
  }
  return out;
};

const evalSeg = (s: Seg, t: number): Point => {
  const u = 1 - t;
  const [p0, p1, p2, p3] = s.pts;
  if (s.pts.length === 2) return { x: u * p0.x + t * p1.x, y: u * p0.y + t * p1.y };
  if (s.pts.length === 3) {
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
  }
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

/** Distance from `q` to the nearest point of `segs`, by dense sampling plus a local refine. */
const distToSegs = (q: Point, segs: Seg[]): number => {
  let best = Infinity;
  for (const s of segs) {
    const N = 400;
    let bt = 0;
    let bd = Infinity;
    for (let i = 0; i <= N; i++) {
      const p = evalSeg(s, i / N);
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bd) { bd = d; bt = i / N; }
    }
    let lo = Math.max(0, bt - 1 / N);
    let hi = Math.min(1, bt + 1 / N);
    for (let it = 0; it < 60; it++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      const d1 = Math.hypot(evalSeg(s, m1).x - q.x, evalSeg(s, m1).y - q.y);
      const d2 = Math.hypot(evalSeg(s, m2).x - q.x, evalSeg(s, m2).y - q.y);
      if (d1 < d2) hi = m2; else lo = m1;
    }
    const p = evalSeg(s, (lo + hi) / 2);
    best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
  }
  return best;
};

const K = 0.5522847498;
/** Circle of four cubics, center (cx, cy), radius r. */
const circle = (cx: number, cy: number, r: number): PolygonPath => {
  const k = K * r;
  return new PathBuilder()
    .moveTo(cx + r, cy)
    .curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r)
    .curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    .curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r)
    .curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
    .close()
    .build();
};

const inside = (p: Path, x: number, y: number): boolean =>
  pointInPath(p, x, y);

/** A U: base y∈[0,30] spanning x∈[0,100], arms x∈[0,30] and x∈[70,100] up to y=100. */
const uShape = polygonFromPoints([
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 70, y: 100 },
  { x: 70, y: 30 }, { x: 30, y: 30 }, { x: 30, y: 100 }, { x: 0, y: 100 },
]);
const U_AREA = 100 * 100 - 40 * 70;

describe('splitPathBySegment', () => {
  it('returns null when the segment does not cross the path boundary', () => {
    const sq = rectPath(0, 0, 100, 100);
    expect(splitPathBySegment(sq, { x: -50, y: 50 }, { x: -10, y: 50 })).toBeNull();
  });

  it('splits an axis-aligned square crossed left-to-right into two pieces', () => {
    const sq = rectPath(0, 0, 100, 100);
    const pieces = splitPathBySegment(sq, { x: -20, y: 50 }, { x: 120, y: 50 });
    expect(pieces).not.toBeNull();
    expect(pieces!.length).toBe(2);
  });

  it('conserves total area across the cut', () => {
    const sq = rectPath(0, 0, 100, 100);
    const pieces = splitPathBySegment(sq, { x: -20, y: 50 }, { x: 120, y: 50 })!;
    const sum = pieces.reduce((s, p) => s + area(p), 0);
    expect(sum).toBeCloseTo(100 * 100, 0);
  });

  it('preserves fillRule on the pieces', () => {
    const tri = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }], { fillRule: 'evenodd' });
    const pieces = splitPathBySegment(tri, { x: -10, y: 40 }, { x: 110, y: 40 })!;
    expect(pieces.every((p) => p.kind === 'polygon' && p.fillRule === 'evenodd')).toBe(true);
  });

  it('returns null when the segment runs along an edge (only one side has area)', () => {
    const sq = rectPath(0, 0, 100, 100);
    expect(splitPathBySegment(sq, { x: -10, y: 0 }, { x: 110, y: 0 })).toBeNull();
  });

  it('diagonal cut of a square produces 2 pieces with conserved total area', () => {
    const sq = rectPath(0, 0, 100, 100);
    const pieces = splitPathBySegment(sq, { x: -5, y: -10 }, { x: 110, y: 105 });
    expect(pieces).not.toBeNull();
    expect(pieces!.length).toBe(2);
    const sum = pieces!.reduce((s, p) => s + area(p), 0);
    expect(sum).toBeCloseTo(100 * 100, 0);
    for (const p of pieces!) expect(area(p)).toBeGreaterThan(1000);
  });

  it('cuts a square exactly through two opposite corners', () => {
    const sq = rectPath(0, 0, 100, 100);
    const pieces = splitPathBySegment(sq, { x: -10, y: -10 }, { x: 110, y: 110 })!;
    expect(pieces).not.toBeNull();
    expect(pieces.map(area)).toEqual([expect.closeTo(5000, 3), expect.closeTo(5000, 3)]);
  });

  it('returns null when the segment only grazes a vertex', () => {
    const diamond = polygonFromPoints([{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }]);
    expect(splitPathBySegment(diamond, { x: -10, y: 0 }, { x: 110, y: 0 })).toBeNull();
  });

  describe('finite cut on concave shapes', () => {
    it('cuts only the arm the segment crosses, not the one its extension would reach', () => {
      const pieces = splitPathBySegment(uShape, { x: -10, y: 60 }, { x: 50, y: 60 })!;
      expect(pieces).not.toBeNull();
      expect(pieces.length).toBe(2);
      const areas = pieces.map(area).sort((a, b) => a - b);
      expect(areas[0]).toBeCloseTo(30 * 40, 3);
      expect(areas[1]).toBeCloseTo(U_AREA - 30 * 40, 3);
      const stub = pieces.find((p) => area(p) < 2000)!;
      expect(boundsOfPath(stub)).toMatchObject({ x: 0, y: 60, width: 30, height: 40 });
      const rest = pieces.find((p) => p !== stub)!;
      expect(inside(rest, 85, 80)).toBe(true);
    });

    it('cuts both arms when the segment crosses both', () => {
      const pieces = splitPathBySegment(uShape, { x: -10, y: 60 }, { x: 110, y: 60 })!;
      expect(pieces.length).toBe(3);
      expect(pieces.reduce((s, p) => s + area(p), 0)).toBeCloseTo(U_AREA, 3);
    });

    it('cuts along an edge collinear with the segment', () => {
      const lShape = polygonFromPoints([
        { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 40 },
        { x: 30, y: 40 }, { x: 30, y: 100 }, { x: 0, y: 100 },
      ]);
      const pieces = splitPathBySegment(lShape, { x: -10, y: 40 }, { x: 70, y: 40 })!;
      expect(pieces.map(area).sort((a, b) => a - b)).toEqual([
        expect.closeTo(30 * 60, 3),
        expect.closeTo(60 * 40, 3),
      ]);
    });
  });

  describe('a segment that ends inside the shape', () => {
    it('returns null when no chord is crossed end to end', () => {
      expect(splitPathBySegment(uShape, { x: -10, y: 60 }, { x: 15, y: 60 })).toBeNull();
      expect(splitPathBySegment(rectPath(0, 0, 100, 100), { x: 50, y: 50 }, { x: 150, y: 50 })).toBeNull();
    });

    it('cuts the chords it does cross and leaves the partial one alone', () => {
      const pieces = splitPathBySegment(uShape, { x: -10, y: 60 }, { x: 85, y: 60 })!;
      expect(pieces.length).toBe(2);
      expect(pieces.map(area).sort((a, b) => a - b)[0]).toBeCloseTo(30 * 40, 3);
    });
  });

  describe('curve preservation', () => {
    it('keeps a cut circle as cubics lying on the original curve', () => {
      const c = circle(50, 50, 40);
      const pieces = splitPathBySegment(c, { x: 0, y: 60 }, { x: 100, y: 60 })!;
      expect(pieces.length).toBe(2);
      const original = segmentsOf(c);
      for (const piece of pieces) {
        const segs = segmentsOf(piece as PolygonPath);
        const lines = segs.filter((s) => s.cmd === PATH_L);
        const cubics = segs.filter((s) => s.cmd === PATH_C);
        expect(lines.length).toBe(1);
        for (const p of lines[0].pts) expect(p.y).toBeCloseTo(60, 3);
        expect(cubics.length).toBeGreaterThan(0);
        for (const s of cubics) {
          for (let i = 0; i <= 8; i++) {
            expect(distToSegs(evalSeg(s, i / 8), original)).toBeLessThan(1e-3);
          }
        }
      }
      expect(pieces.reduce((s, p) => s + area(p), 0)).toBeCloseTo(area(c), 0);
    });

    it('keeps quadratic segments quadratic', () => {
      const shape = new PathBuilder().moveTo(0, 0).lineTo(100, 0).quadTo(100, 100, 0, 100).close().build();
      const pieces = splitPathBySegment(shape, { x: -10, y: 50 }, { x: 110, y: 50 })!;
      expect(pieces.length).toBe(2);
      const original = segmentsOf(shape).filter((s) => s.cmd === PATH_Q);
      for (const piece of pieces) {
        const quads = segmentsOf(piece as PolygonPath).filter((s) => s.cmd === PATH_Q);
        expect(quads.length).toBe(1);
        for (let i = 0; i <= 8; i++) {
          expect(distToSegs(evalSeg(quads[0], i / 8), original)).toBeLessThan(1e-3);
        }
      }
    });

    it('splits one cubic the segment crosses twice', () => {
      const dome = new PathBuilder().moveTo(0, 0).curveTo(0, 100, 100, 100, 100, 0).close().build();
      const pieces = splitPathBySegment(dome, { x: -10, y: 30 }, { x: 110, y: 30 })!;
      expect(pieces.length).toBe(2);
      const original = segmentsOf(dome).filter((s) => s.cmd === PATH_C);
      const cubics = pieces.flatMap((p) => segmentsOf(p as PolygonPath).filter((s) => s.cmd === PATH_C));
      expect(cubics.length).toBe(3);
      for (const s of cubics) {
        for (let i = 0; i <= 8; i++) expect(distToSegs(evalSeg(s, i / 8), original)).toBeLessThan(1e-3);
      }
      expect(pieces.reduce((s, p) => s + area(p), 0)).toBeCloseTo(area(dome), 0);
    });

    it('returns null for a segment tangent to a curve', () => {
      expect(splitPathBySegment(circle(50, 50, 40), { x: 0, y: 10 }, { x: 100, y: 10 })).toBeNull();
    });
  });

  describe('compound paths', () => {
    const donut = (fillRule: 'nonzero' | 'evenodd') => new PathBuilder()
      .setFillRule(fillRule)
      .moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close()
      .moveTo(20, 20).lineTo(80, 20).lineTo(80, 80).lineTo(20, 80).close()
      .build();

    it('cuts a donut straight across into two U pieces', () => {
      for (const rule of ['nonzero', 'evenodd'] as const) {
        const d = donut(rule);
        // Same winding on both rings: nonzero fills the hole, evenodd does not.
        const expected = rule === 'evenodd' ? 100 * 100 - 60 * 60 : 100 * 100;
        const pieces = splitPathBySegment(d, { x: -10, y: 50 }, { x: 110, y: 50 })!;
        expect(pieces.length).toBe(2);
        expect(pieces.reduce((s, p) => s + area(p), 0)).toBeCloseTo(expected, 3);
      }
    });

    it('slits a ring the segment crosses once without separating it', () => {
      const d = donut('evenodd');
      const pieces = splitPathBySegment(d, { x: -10, y: 50 }, { x: 50, y: 50 })!;
      expect(pieces.length).toBe(1);
      expect(area(pieces[0])).toBeCloseTo(100 * 100 - 60 * 60, 3);
    });

    it('keeps an untouched hole with the piece that surrounds it', () => {
      const d = donut('evenodd');
      const pieces = splitPathBySegment(d, { x: -10, y: 10 }, { x: 110, y: 10 })!;
      expect(pieces.length).toBe(2);
      const big = pieces.find((p) => area(p) > 5000)!;
      expect(area(big)).toBeCloseTo(100 * 90 - 60 * 60, 3);
      expect(inside(big, 50, 50)).toBe(false);
    });

    it('keeps contours the segment misses together in one remainder piece', () => {
      const two = new PathBuilder()
        .moveTo(0, 0).lineTo(40, 0).lineTo(40, 40).lineTo(0, 40).close()
        .moveTo(60, 0).lineTo(100, 0).lineTo(100, 40).lineTo(60, 40).close()
        .moveTo(60, 60).lineTo(100, 60).lineTo(100, 100).lineTo(60, 100).close()
        .build();
      const pieces = splitPathBySegment(two, { x: -10, y: 20 }, { x: 50, y: 20 })!;
      expect(pieces.length).toBe(3);
      expect(pieces.map(area)).toEqual([
        expect.closeTo(800, 3), expect.closeTo(800, 3), expect.closeTo(3200, 3),
      ]);
    });

    it('resolves overlapping contours before cutting', () => {
      const overlap = new PathBuilder()
        .moveTo(0, 0).lineTo(60, 0).lineTo(60, 60).lineTo(0, 60).close()
        .moveTo(30, 30).lineTo(90, 30).lineTo(90, 90).lineTo(30, 90).close()
        .build();
      const pieces = splitPathBySegment(overlap, { x: -10, y: 45 }, { x: 100, y: 45 })!;
      expect(pieces.length).toBe(2);
      expect(pieces.reduce((s, p) => s + area(p), 0)).toBeCloseTo(60 * 60 * 2 - 30 * 30, 3);
    });
  });
});
