import { describe, expect, it } from 'vitest';
import { polylineFromPoints, type Path } from '@weasel-js/geom';
import type { Vec2 } from '@weasel-js/core/math';
import { asNodeId, type DerivedDep, type RectPose } from '@weasel-js/core';
import { edgeDerivePath } from '../edge';
import { withHops } from './draw';

const NAMES = ['M', 'L', 'C'] as const;
const SIZES = [2, 2, 6];

/** The path as commands, each with the points it carries. */
function steps(path: Path): { cmd: string; pts: Vec2[] }[] {
  if (path.kind !== 'polygon') throw new Error('not a polygon');
  const out: { cmd: string; pts: Vec2[] }[] = [];
  let ci = 0;
  for (const code of path.commands) {
    const n = SIZES[code]!;
    const pts: Vec2[] = [];
    for (let k = 0; k < n; k += 2) pts.push({ x: path.coords[ci + k]!, y: path.coords[ci + k + 1]! });
    out.push({ cmd: NAMES[code]!, pts });
    ci += n;
  }
  return out;
}

/** Every curve point of the path's arcs. */
const arcPoints = (path: Path): Vec2[] => steps(path).filter((s) => s.cmd === 'C').flatMap((s) => s.pts);

const close = (a: Vec2, b: Vec2) => {
  expect(a.x).toBeCloseTo(b.x, 3);
  expect(a.y).toBeCloseTo(b.y, 3);
};

describe('withHops', () => {
  it('replaces the stretch within r of a hop with a half circle of two quarter arcs', () => {
    const path = withHops([{ x: 0, y: 50 }, { x: 200, y: 50 }], [{ at: { x: 100, y: 50 }, over: ['v'], r: 5 }]);
    const s = steps(path);
    expect(s.map((x) => x.cmd)).toEqual(['M', 'L', 'C', 'C', 'L']);
    close(s[1]!.pts[0]!, { x: 95, y: 50 });
    close(s[2]!.pts[2]!, { x: 100, y: 45 });
    close(s[3]!.pts[2]!, { x: 105, y: 50 });
    close(s[4]!.pts[0]!, { x: 200, y: 50 });
    const k = 0.5523 * 5;
    close(s[2]!.pts[0]!, { x: 95, y: 50 - k });
    close(s[2]!.pts[1]!, { x: 100 - k, y: 45 });
  });

  it('bulges toward -y on a horizontal run whichever way it travels', () => {
    for (const run of [[{ x: 0, y: 50 }, { x: 200, y: 50 }], [{ x: 200, y: 50 }, { x: 0, y: 50 }]]) {
      const arc = arcPoints(withHops(run, [{ at: { x: 100, y: 50 }, over: ['v'], r: 5 }]));
      expect(arc.every((p) => p.y <= 50)).toBe(true);
      expect(Math.min(...arc.map((p) => p.y))).toBeCloseTo(45, 3);
    }
  });

  it('bulges toward -x on a vertical run whichever way it travels', () => {
    for (const run of [[{ x: 50, y: 0 }, { x: 50, y: 200 }], [{ x: 50, y: 200 }, { x: 50, y: 0 }]]) {
      const arc = arcPoints(withHops(run, [{ at: { x: 50, y: 100 }, over: ['h'], r: 5 }]));
      expect(arc.every((p) => p.x <= 50)).toBe(true);
      expect(Math.min(...arc.map((p) => p.x))).toBeCloseTo(45, 3);
    }
  });

  it('bulges to the left of travel on a diagonal run', () => {
    const r = 5;
    const arc = arcPoints(withHops([{ x: 0, y: 0 }, { x: 100, y: 100 }], [{ at: { x: 50, y: 50 }, over: ['a'], r }]));
    // Traveling down and right on a y-down page, left is up and right: x - y > 0.
    expect(arc.every((p) => p.x - p.y >= -1e-6)).toBe(true);
    close(steps(withHops([{ x: 0, y: 0 }, { x: 100, y: 100 }], [{ at: { x: 50, y: 50 }, over: ['a'], r }]))[2]!.pts[2]!, {
      x: 50 + r / Math.SQRT2, y: 50 - r / Math.SQRT2,
    });
  });

  it('draws a hop on the segment it lies on, and the rest of the route as it was', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const s = steps(withHops(points, [{ at: { x: 100, y: 50 }, over: ['h'], r: 5 }]));
    expect(s.map((x) => x.cmd)).toEqual(['M', 'L', 'L', 'C', 'C', 'L']);
    close(s[1]!.pts[0]!, { x: 100, y: 0 });
    close(s[2]!.pts[0]!, { x: 100, y: 45 });
    close(s[5]!.pts[0]!, { x: 100, y: 100 });
  });

  it('drops a stale hop: off the route by more than 0.5, or not fitting its segment', () => {
    const points = [{ x: 0, y: 50 }, { x: 200, y: 50 }];
    const plain = polylineFromPoints(points);
    expect(withHops(points, [{ at: { x: 100, y: 51 }, over: ['v'], r: 5 }])).toEqual(plain);
    expect(withHops(points, [{ at: { x: 197, y: 50 }, over: ['v'], r: 5 }])).toEqual(plain);
    expect(steps(withHops(points, [{ at: { x: 100, y: 50.4 }, over: ['v'], r: 5 }])).map((x) => x.cmd)).toContain('C');
  });

  it('drops a hop overlapping the one before it', () => {
    const points = [{ x: 0, y: 50 }, { x: 200, y: 50 }];
    const s = steps(withHops(points, [
      { at: { x: 100, y: 50 }, over: ['a'], r: 5 },
      { at: { x: 106, y: 50 }, over: ['b'], r: 5 },
    ]));
    expect(s.filter((x) => x.cmd === 'C')).toHaveLength(2);
  });
});

describe('edgeDerivePath with hops', () => {
  const dep = (x: number): DerivedDep<RectPose> => {
    const pose = { x, y: 0, width: 40, height: 40 };
    return { node: { id: asNodeId(`n${x}`), kind: 'leaf', layer: 'main', parent: null, pose, data: { diagram: {} } } as never, pose, path: null };
  };
  const derive = edgeDerivePath<RectPose>();

  it('draws the hops an edge carries on its route, and none that have gone stale', () => {
    // East port (40, 20) to west port (200, 20).
    const hopped = derive({ data: { diagram: { from: {}, to: {}, hops: [{ at: { x: 120, y: 20 }, over: ['v'], r: 5 }] } } }, [dep(0), dep(200)]);
    expect(steps(hopped!).map((x) => x.cmd)).toEqual(['M', 'L', 'C', 'C', 'L']);
    const stale = derive({ data: { diagram: { from: {}, to: {}, hops: [{ at: { x: 120, y: 60 }, over: ['v'], r: 5 }] } } }, [dep(0), dep(200)]);
    expect(steps(stale!).map((x) => x.cmd)).toEqual(['M', 'L']);
  });
});
