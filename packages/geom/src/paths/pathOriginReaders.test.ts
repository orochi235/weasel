import { describe, it, expect } from 'vitest';
import { PathBuilder, ellipsePath, linePath, polygonFromPoints, polylineFromPoints, regularPolygonPath, starPath } from './builder';
import { anchorsToPath, pathToAnchors } from './anchors';
import { anchorPointIndices } from './anchorOrigins';
import { boundsOfPath } from './bounds';
import { cornerFrames, resolveCorners } from './corners';
import { withCorner } from './cornerSpec';
import { pathToCubicContours } from './cubicContours';
import { pathDistanceToPoint } from './pathDistance';
import { measurePath } from './pathMeasure';
import { pointAlongPath } from './pathAt';
import { pathLengthTable } from '../along/pathTable';
import { bendAlongPath } from './bendAlongPath';
import { growRegion } from './growRegion';
import { mergeRegion } from './mergeRegion';
import { puckerBloatPath } from './puckerBloatPath';
import { roughenPath } from './roughenPath';
import { tweenPaths } from './tweenPaths';
import { zigzagPath } from './zigzagPath';
import { schneiderFit } from './schneiderFit';
import type { Path } from '../path';
import { pointAtLength } from '../along/positions';
import { pathFromD } from './pathFromD';
import { ORIGIN_THRESHOLD, joinPaths, originFor, worldCoords } from './pathOrigin';
import { pathToD } from './pathToD';
import { translatePath } from './transform';
import { transformPath } from './transformPath';
import { pathUnion } from '../booleans';
import { pathToMultiPolygon } from '../booleans/adapter';
import { pathContainsPoint, polygonContainsPath, strokeHitTest } from '../pathHitTest';
import { rotatePathAbout } from '../poseRotation';
import { pinWarpMesh } from '../warp/pinWarpMesh';
import type { PolygonPath } from '../path';

const FAR = 262_144;
const X = FAR + 0.3;

/** A unit square at `(FAR + 0.3, 1)`, measured from `(FAR, 0)`: float32 coords
 *  that far out would put its left edge at FAR + 0.3125. */
const square = (dx = 0): PolygonPath => new PathBuilder().setOrigin(FAR, 0)
  .moveTo(X + dx, 1).lineTo(X + dx + 1, 1).lineTo(X + dx + 1, 2).lineTo(X + dx, 2).close().build();

describe('readers of a path measured from an origin', () => {
  it('hit-tests the path where its origin puts it', () => {
    const p = square();
    expect(pathContainsPoint(p, X + 0.01, 1.5)).toBe(true);
    expect(pathContainsPoint(p, X - 0.01, 1.5)).toBe(false);
    expect(strokeHitTest(p, X - 0.005, 1.5, 0.01)).toBe(true);
    expect(pathDistanceToPoint(p, X - 0.1, 1.5)).toBeCloseTo(0.1, 6);
    const lasso = [{ x: X - 0.01, y: 0.9 }, { x: X + 1.1, y: 0.9 }, { x: X + 1.1, y: 2.1 }, { x: X - 0.01, y: 2.1 }];
    expect(polygonContainsPath(lasso, p)).toBe(true);
    expect(polygonContainsPath(lasso.map((q) => ({ x: q.x + 0.02, y: q.y })), p)).toBe(false);
  });

  it('reads anchors in the path\'s own space and writes them back from the same origin', () => {
    const p = square();
    const { anchors, closed } = pathToAnchors(p);
    expect(anchors[0][0].x).toBeCloseTo(X, 6);
    const back = anchorsToPath(anchors, closed, p);
    expect(back.origin).toEqual(p.origin);
    expect(Array.from(back.coords)).toEqual(Array.from(p.coords));
    expect(anchorPointIndices(p)).toEqual([0, 1, 2, 3]);
  });

  it('gives a path built from far-out anchors an origin of its own', () => {
    const built = anchorsToPath([[{ x: X, y: 1 }, { x: X + 1, y: 1 }]], [false]);
    expect(built.origin).toEqual(originFor([X, 1, X + 1, 1]));
    expect(worldCoords(built)[0]).toBeCloseTo(X, 6);
    expect(anchorsToPath([[{ x: 0.3, y: 1 }, { x: 1, y: 1 }]], [false]).origin).toBeUndefined();
  });

  it('writes SVG path data in the path\'s own space', () => {
    expect(pathToD(square())).toMatch(/^M262144\.3 1L262145\.3 1/);
  });

  it('runs the booleans where the operands are', () => {
    const union = pathUnion(square(), square(0.5));
    expect(union.origin).toBeDefined();
    const b = boundsOfPath(union);
    expect(b.x).toBeCloseTo(X, 6);
    expect(b.width).toBeCloseTo(1.5, 4);
    expect(pathToMultiPolygon(square())[0][0][0][0]).toBeCloseTo(X, 6);
  });

  it('expands corners where the path is and keeps the expansion measured from its origin', () => {
    const p = withCorner(square(), 1, { shape: 'round', radius: 0.25 });
    const drawn = resolveCorners(p);
    expect(drawn.origin).toEqual(p.origin);
    expect(boundsOfPath(drawn).x).toBeCloseTo(X, 6);
    expect(Math.max(...worldCoords(drawn).filter((_, i) => i % 2 === 0))).toBeCloseTo(X + 1, 5);
    expect(cornerFrames(p).find((f) => f.index === 1)!.x).toBeCloseTo(X + 1, 6);
  });

  it('moves and turns the origin, not the coords', () => {
    const p = square();
    const moved = translatePath(p, 5, 6) as PolygonPath;
    expect(moved.origin).toEqual({ x: FAR + 5, y: 6 });
    expect(Array.from(moved.coords)).toEqual(Array.from(p.coords));
    const turned = rotatePathAbout(p, FAR, 0, Math.PI / 2);
    // A quarter turn about (FAR, 0) takes (FAR + 0.3, 1) to (FAR - 1, 0.3).
    expect(worldCoords(turned)[0]).toBeCloseTo(FAR - 1, 6);
    expect(worldCoords(turned)[1]).toBeCloseTo(0.3, 6);
  });

  it('decodes cubic contours and pin warp meshes in the path\'s own space', () => {
    expect(pathToCubicContours(square())[0].segs[0].c[0]).toBeCloseTo(X, 6);
    const mesh = pinWarpMesh(square(), [], { vertices: 20 });
    expect(Math.min(...mesh.vertices.filter((_, i) => i % 2 === 0))).toBeCloseTo(X, 4);
  });
});

describe('joinPaths', () => {
  it('measures every part from the first part\'s origin', () => {
    const other = new PathBuilder().setOrigin(FAR + 64, 0).moveTo(X + 64, 1).lineTo(X + 65, 1).lineTo(X + 65, 2).close().build();
    const joined = joinPaths([square(), other]);
    expect(joined.origin).toEqual({ x: FAR, y: 0 });
    expect(joined.fillRule).toBe('nonzero');
    const w = worldCoords(joined);
    expect(w[0]).toBeCloseTo(X, 6);
    expect(w[8]).toBeCloseTo(X + 64, 4);
  });

  it('gives parts with no origin none', () => {
    const a = new PathBuilder().moveTo(1, 1).lineTo(2, 1).build();
    expect(joinPaths([a, a]).origin).toBeUndefined();
    expect(joinPaths([a, a]).coords.length).toBe(8);
  });
});

describe('producers that pick an origin', () => {
  it('leave a path within the threshold alone and center one past it', () => {
    expect(originFor([ORIGIN_THRESHOLD - 1, 0])).toBeUndefined();
    expect(originFor([X, 1, X + 1, 3])).toEqual({ x: FAR + 1, y: 2 });
  });

  it('build an origin when asked, at build time', () => {
    expect(new PathBuilder().autoOrigin().moveTo(1, 2).build().origin).toBeUndefined();
    const far = new PathBuilder().autoOrigin().moveTo(X, 1).lineTo(X + 1, 1).build();
    expect(far.origin).toBeDefined();
    expect(worldCoords(far)[0]).toBeCloseTo(X, 6);
  });

  it('map a path far out with an origin under transformPath, unless told not to', () => {
    const near = new PathBuilder().moveTo(0, 0).lineTo(1, 0).lineTo(1, 1).close().build();
    const m = [1, 0, 0, 1, X, 0] as const;
    const far = transformPath(near, [...m]) as PolygonPath;
    expect(far.origin).toBeDefined();
    expect(worldCoords(far)[0]).toBeCloseTo(X, 6);
    expect((transformPath(near, [...m], { autoOrigin: false }) as PolygonPath).origin).toBeUndefined();
    expect((transformPath(near, [1, 0, 0, 1, 5, 0]) as PolygonPath).origin).toBeUndefined();
  });

  it('keep a rect rotated far out exact through transformPath', () => {
    const turned = transformPath({ kind: 'rect', x: X, y: 1, width: 1, height: 1 }, [0, 1, -1, 0, 0, 0]) as PolygonPath;
    expect(turned.origin).toBeDefined();
    expect(worldCoords(turned)[1]).toBeCloseTo(X, 6);
  });

  it('read SVG path data reaching past the threshold into a path with an origin', () => {
    const p = pathFromD('M262144.3 1L262145.3 1L262145.3 2Z');
    expect(p.origin).toBeDefined();
    expect(worldCoords(p)[0]).toBeCloseTo(X, 6);
    expect(pathFromD('M1 1L2 2').origin).toBeUndefined();
  });

  it('measure the path by length where its origin puts it', () => {
    const p = square();
    const m = measurePath(p)!;
    expect(m.at(0).point.x).toBeCloseTo(X, 6);
    expect(m.at(0.5).point).toEqual({ x: expect.closeTo(X + 0.5, 6), y: 1 });
    const near = m.nearest({ x: X + 0.25, y: 0.5 });
    expect(near.s).toBeCloseTo(0.25, 6);
    expect(near.dist).toBeCloseTo(0.5, 6);
    expect(pointAlongPath(pathFromD('M20000 0 L20010 0'), 0)!.point).toEqual({ x: 20000, y: 0 });
    const table = pathLengthTable(p);
    expect(table.origin).toEqual(p.origin);
    expect(pointAtLength(table, 0).point[0] + table.origin!.x).toBeCloseTo(X, 6);
  });

  it('write an effect\'s far-out result from an origin, and keep the source\'s open-fill rule', () => {
    const left = (p: Path | null) => boundsOfPath(p!).x;
    const p = square();
    expect(left(puckerBloatPath(p, { amount: 1e-12 }))).toBeCloseTo(X, 6);
    expect(left(roughenPath(p, { size: 1e-9 }))).toBeCloseTo(X, 6);
    expect(left(zigzagPath(p, { size: 1e-9 }))).toBeCloseTo(X, 6);
    expect(left(tweenPaths(p, p, 0))).toBeCloseTo(X, 6);
    expect(left(mergeRegion(p))).toBeCloseTo(X, 6);
    expect(left(growRegion(p, 0.01))).toBeCloseTo(X - 0.01, 6);
    expect(left(bendAlongPath({ kind: 'rect', x: 0, y: 0, width: 10, height: 2 }, pathFromD('M262144.3 0 L262154.3 0')))).toBeCloseTo(X, 6);

    const open: PolygonPath = { ...pathFromD('M0 0 L10 0 L10 10'), openFill: 'none' };
    const fill = (q: Path | null) => (q as PolygonPath).openFill;
    expect(fill(puckerBloatPath(open, { amount: 0.1 }))).toBe('none');
    expect(fill(roughenPath(open, { size: 1 }))).toBe('none');
    expect(fill(zigzagPath(open, { size: 1 }))).toBe('none');
    expect(fill(tweenPaths(open, open, 0.5))).toBe('none');
    expect(fill(bendAlongPath(open, pathFromD('M0 0 L100 0')))).toBe('none');
  });

  it('fit far-out samples from an origin', () => {
    const fit = schneiderFit([{ x: X, y: 1 }, { x: X + 1, y: 1.5 }, { x: X + 2, y: 1 }], 0.01);
    expect(fit.origin).toBeDefined();
    expect(worldCoords(fit)[0]).toBeCloseTo(X, 6);
  });

  it('build far-out shapes from an origin', () => {
    const pts = [{ x: X, y: 1 }, { x: X + 1, y: 1 }, { x: X + 1, y: 2 }];
    for (const p of [
      polygonFromPoints(pts), polylineFromPoints(pts) as PolygonPath, linePath(pts[0]!, pts[1]!),
      ellipsePath({ x: X, y: 1, width: 1, height: 1 }), regularPolygonPath({ x: X + 1, y: 1 }, 1, 6),
    ]) {
      expect(p.origin).toBeDefined();
      expect(boundsOfPath(p).x).toBeCloseTo(X, 6);
    }
    expect(boundsOfPath(starPath({ x: X + 1, y: 1 }, 1)).x).toBeCloseTo(X + 1 + Math.cos(0.8 * Math.PI), 6);
    expect(polygonFromPoints([{ x: 0.3, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }]).origin).toBeUndefined();
  });
});
