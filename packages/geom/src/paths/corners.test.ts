import { describe, expect, it } from 'vitest';
import { PATH_C, PATH_L, PATH_M, PATH_Z } from '../commands';
import type { PolygonPath } from '../path';
import { polygonFromPoints } from './builder';
import { boundsOfPath } from './bounds';
import { cornerFrameAt, cornerFrames, cornerRadiusOf, cornerTrimOf, resolveCorners } from './corners';
import { nextCornerStyle, withCorner, type CornerSpec } from './cornerSpec';
import { anchorsToPath, pathToAnchors } from './anchors';
import { pathFromD } from './pathFromD';
import { pointInPath } from '../pathHitTest';
import { tessellate } from '../tessellate/tessellate';

const square = (): PolygonPath =>
  polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);

const withAll = (path: PolygonPath, spec: CornerSpec): PolygonPath =>
  [0, 1, 2, 3].reduce((p, i) => withCorner(p, i, spec), path);

const points = (p: PolygonPath): number[][] => {
  const out: number[][] = [];
  for (let i = 0; i < p.coords.length; i += 2) out.push([p.coords[i], p.coords[i + 1]]);
  return out;
};

describe('resolveCorners', () => {
  it('returns a path with no corners as itself', () => {
    const p = square();
    expect(resolveCorners(p)).toBe(p);
  });

  it('chamfers a corner with a straight cut `radius` along each edge', () => {
    const out = resolveCorners(withCorner(square(), 1, { style: 'chamfer', radius: 10 }));
    expect(out.corners).toBeUndefined();
    expect([...out.commands]).toEqual([PATH_M, PATH_L, PATH_L, PATH_L, PATH_L, PATH_Z]);
    expect(points(out)).toEqual([[0, 0], [90, 0], [100, 10], [100, 100], [0, 100]]);
  });

  it('rounds a square corner with a quarter arc of the given radius', () => {
    const out = resolveCorners(withCorner(square(), 1, { style: 'round', radius: 10 }));
    expect([...out.commands]).toEqual([PATH_M, PATH_L, PATH_C, PATH_L, PATH_L, PATH_Z]);
    const k = (4 / 3) * Math.tan(Math.PI / 8) * 10;
    const pts = points(out);
    expect(pts[1]).toEqual([90, 0]);
    expect(pts[2][0]).toBeCloseTo(90 + k, 4);
    expect(pts[2][1]).toBeCloseTo(0, 4);
    expect(pts[3][0]).toBeCloseTo(100, 4);
    expect(pts[3][1]).toBeCloseTo(10 - k, 4);
    expect(pts[4]).toEqual([100, 10]);
  });

  it('scoops an inverted corner with an arc centered on the anchor', () => {
    const out = resolveCorners(withCorner(square(), 1, { style: 'inverted', radius: 10 }));
    const pts = points(out);
    expect(pts[1]).toEqual([90, 0]);
    // The first control leaves (90, 0) straight down, into the shape.
    expect(pts[2][0]).toBeCloseTo(90, 4);
    expect(pts[2][1]).toBeGreaterThan(0);
    // The second arrives at (100, 10) moving right, back out to the edge.
    expect(pts[3][1]).toBeCloseTo(10, 4);
    expect(pts[3][0]).toBeLessThan(100);
    expect(pts[4]).toEqual([100, 10]);
  });

  it('cuts the first anchor of a closed subpath across the seam', () => {
    const out = resolveCorners(withCorner(square(), 0, { style: 'chamfer', radius: 10 }));
    expect(points(out)).toEqual([[10, 0], [100, 0], [100, 100], [0, 100], [0, 10]]);
    expect(out.commands[out.commands.length - 1]).toBe(PATH_Z);
  });

  it('clamps two corners on one edge so their cuts meet and never overlap', () => {
    const p = withCorner(withCorner(square(), 0, { style: 'chamfer', radius: 80 }), 1, {
      style: 'chamfer', radius: 80,
    });
    const pts = points(resolveCorners(p));
    // The top edge is 100 long; both cuts scale to 50 and meet at its middle.
    expect(pts[0]).toEqual([50, 0]);
    expect(pts).toContainEqual([50, 0]);
    expect(pts.filter(([x, y]) => x === 50 && y === 0).length).toBeGreaterThanOrEqual(1);
    for (const [x] of pts) expect(x).toBeGreaterThanOrEqual(0);
    const b = boundsOfPath(resolveCorners(p));
    expect(b.width).toBeCloseTo(100, 4);
  });

  it('leaves the ends of an open path and a straight-through anchor alone', () => {
    const line = withCorner(withCorner(
      pathFromD('M 0 0 L 50 0 L 100 0'),
      0, { style: 'round', radius: 5 }), 1, { style: 'round', radius: 5 });
    expect(points(resolveCorners(line))).toEqual([[0, 0], [50, 0], [100, 0]]);
  });

  it('cuts a corner between two curves along each curve', () => {
    const p = pathFromD('M 0 0 C 30 0 60 0 100 0 C 100 30 100 60 100 100 L 0 100 Z');
    const out = resolveCorners(withCorner(p, 1, { style: 'chamfer', radius: 10 }));
    const b = boundsOfPath(out);
    expect(b.x).toBeCloseTo(0, 4);
    expect(b.width).toBeCloseTo(100, 3);
    // The anchor itself is cut away.
    expect(points(out)).not.toContainEqual([100, 0]);
  });

  it('is memoized per path', () => {
    const p = withCorner(square(), 1, { style: 'round', radius: 10 });
    expect(resolveCorners(p)).toBe(resolveCorners(p));
  });
});

describe('the geometry readers see corners expanded', () => {
  const cut = (): PolygonPath => withCorner(square(), 1, { style: 'chamfer', radius: 20 });

  it('bounds the expanded geometry', () => {
    const p = withAll(square(), { style: 'inverted', radius: 10 });
    expect(boundsOfPath(p)).toEqual(boundsOfPath(resolveCorners(p)));
  });

  it('hit-tests the cut-away corner as outside', () => {
    expect(pointInPath(square(), 98, 2)).toBe(true);
    expect(pointInPath(cut(), 98, 2)).toBe(false);
    expect(pointInPath(cut(), 50, 50)).toBe(true);
  });

  it('tessellates the expanded outline', () => {
    const v = tessellate(cut()).vertices;
    const pts: string[] = [];
    for (let i = 0; i < v.length; i += 2) pts.push(`${v[i]},${v[i + 1]}`);
    expect(pts).toContain('80,0');
    expect(pts).not.toContain('100,0');
  });
});

describe('cornerFrames', () => {
  it('reports the bisector into the cut and the room each corner has', () => {
    const p = withCorner(square(), 0, { style: 'round', radius: 30 });
    const f = cornerFrameAt(p, 1)!;
    expect(f.x).toBe(100);
    expect(f.y).toBe(0);
    expect(f.bisector.x).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(f.bisector.y).toBeCloseTo(Math.SQRT1_2, 6);
    expect(f.halfAngle).toBeCloseTo(Math.PI / 4, 6);
    expect(f.trim).toBe(0);
    // Anchor 0 keeps 30 of the top edge, so 70 is left for anchor 1.
    expect(f.maxTrim).toBeCloseTo(70, 6);
    expect(cornerFrames(p)).toHaveLength(4);
  });

  it('converts between radius and trim per style', () => {
    const half = Math.PI / 6;
    expect(cornerRadiusOf('round', cornerTrimOf('round', 7, half), half)).toBeCloseTo(7, 9);
    expect(cornerTrimOf('chamfer', 7, half)).toBe(7);
    expect(cornerTrimOf('round', 10, Math.PI / 4)).toBeCloseTo(10, 9);
  });
});

describe('corners through the anchor model', () => {
  it('ride on their anchors through an insert', () => {
    const p = withCorner(square(), 2, { style: 'round', radius: 5 });
    const { anchors, closed } = pathToAnchors(p);
    expect(anchors[0][2].corner).toEqual({ style: 'round', radius: 5 });
    anchors[0].splice(1, 0, { x: 50, y: 0 });
    const out = anchorsToPath(anchors, closed, p);
    expect(out.corners).toEqual([null, null, null, { style: 'round', radius: 5 }]);
  });

  it('are dropped when no anchor keeps one', () => {
    const p = withCorner(square(), 2, { style: 'round', radius: 5 });
    const { anchors, closed } = pathToAnchors(p);
    anchors[0].splice(2, 1);
    expect(anchorsToPath(anchors, closed, p).corners).toBeUndefined();
  });
});

describe('nextCornerStyle', () => {
  it('cycles round, chamfer, inverted', () => {
    expect(nextCornerStyle('round')).toBe('chamfer');
    expect(nextCornerStyle('chamfer')).toBe('inverted');
    expect(nextCornerStyle('inverted')).toBe('round');
  });
});

