import { describe, expect, it } from 'vitest';
import type { PolygonPath } from '../path';
import { polygonFromPoints, rectPath } from './builder';
import { boundsOfPath } from './bounds';
import { pathToCubicContours } from './cubicContours';
import { tweenPaths, prepareTween } from './tweenPaths';
import { pathFromD } from './pathFromD';
import { pathToD } from './pathToD';

const anchors = (p: PolygonPath) => pathToCubicContours(p).map((c) => c.segs.map((s) => [s.c[0], s.c[1]]));

describe('tweenPaths', () => {
  it('is the first shape at 0 and the second at 1', () => {
    const a = rectPath(0, 0, 10, 10);
    const b = rectPath(100, 0, 20, 20);
    expect(boundsOfPath(tweenPaths(a, b, 0))).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
    expect(boundsOfPath(tweenPaths(a, b, 1))).toMatchObject({ x: 100, y: 0, width: 20, height: 20 });
  });

  it('interpolates the matched anchors halfway', () => {
    const mid = tweenPaths(rectPath(0, 0, 10, 10), rectPath(100, 0, 30, 30), 0.5);
    expect(boundsOfPath(mid)).toMatchObject({ x: 50, y: 0, width: 20, height: 20 });
    // Straight on both sides stays straight: no C command.
    expect(Array.from(mid.commands)).not.toContain(2);
  });

  it('splits the shape with fewer anchors until the counts agree', () => {
    const tri = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]);
    const square = rectPath(0, 0, 10, 10);
    const tween = prepareTween(tri, square);
    expect(tween.segmentCounts).toEqual([4]);
    // At t = 0 the triangle keeps its outline, the extra anchor on an edge.
    expect(boundsOfPath(tween.at(0))).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('splits a few segments to match a contour of hundreds of thousands', () => {
    const n = 200_000;
    const ring = polygonFromPoints(Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return { x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a) };
    }));
    const tween = prepareTween(rectPath(0, 0, 100, 100), ring, { autoAlign: false });
    expect(tween.segmentCounts).toEqual([n]);
    expect(boundsOfPath(tween.at(0))).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('picks the start point that keeps matched anchors closest', () => {
    const a = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    // The same square drawn from the opposite corner, far away.
    const b = polygonFromPoints([{ x: 110, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 0 }, { x: 110, y: 0 }]);
    expect(boundsOfPath(tweenPaths(a, b, 0.5))).toMatchObject({ width: 10, height: 10 });
    expect(boundsOfPath(tweenPaths(a, b, 0.5, { autoAlign: false })).width).toBeLessThan(10);
  });

  it('turns the start point further with startOffset', () => {
    const square = rectPath(0, 0, 10, 10);
    expect(anchors(tweenPaths(square, square, 1))[0]![0]).toEqual([0, 0]);
    expect(anchors(tweenPaths(square, square, 1, { startOffset: 1 }))[0]![0]).toEqual([10, 0]);
  });

  it('grows a contour the other shape lacks out of a point', () => {
    const ring = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    const two: PolygonPath = {
      ...ring,
      commands: new Uint8Array([...ring.commands, ...ring.commands]),
      coords: new Float32Array([...ring.coords, ...ring.coords.map((v) => v + 20)]),
    };
    const moves = (p: PolygonPath) => Array.from(p.commands).filter((c) => c === 0).length;
    expect(moves(tweenPaths(ring, two, 0))).toBe(2);
    expect(boundsOfPath(tweenPaths(ring, two, 1))).toMatchObject({ width: 30, height: 30 });
  });

  it('keeps each shape\'s own closing at its end of a tween between a closed contour and an open one', () => {
    const closed = pathFromD('M0 0 L10 0 L10 10 L0 10 Z');
    const open = pathFromD('M0 0 L10 0 L10 10 L0 10');
    const tween = prepareTween(closed, open);
    expect(pathToD(tween.at(0))).toMatch(/Z$/);
    expect(pathToD(tween.at(1))).not.toMatch(/Z$/);
  });
});

describe('tweenPaths with near-equal segments', () => {
  it('changes steadily as a turned box is stretched, whichever side float rounding leaves longer', () => {
    const star = pathFromD('M120 90 L138 136 L188 140 L150 172 L162 222 L120 194 L78 222 L90 172 L52 140 L102 136 Z') as PolygonPath;
    // A 100 × 140 box turned 45° and skewed a little more each step, as a resize of it leaves it.
    const box = (k: number) => {
      const at = (x: number, y: number) => {
        const sx = x + k * y;
        return { x: 490 + (sx - y) * Math.SQRT1_2, y: 180 + (sx + y) * Math.SQRT1_2 };
      };
      return polygonFromPoints([at(-50, -70), at(50, -70), at(50, 70), at(-50, 70)]);
    };
    const lefts = Array.from({ length: 40 }, (_, i) => boundsOfPath(tweenPaths(star, box(0.002 * i), 1 / 3)).x);
    for (let i = 1; i < lefts.length; i++) expect(Math.abs(lefts[i]! - lefts[i - 1]!)).toBeLessThan(1);
  });
});
