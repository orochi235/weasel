import { describe, expect, it } from 'vitest';
import { pathToAnchors } from './anchors';
import { forEachSegment, PATH_C } from '../commands';
import { cubicPointAt } from './cubicMath';
import { eulerPointAt } from './eulerSpiral';
import { solveSpiro, type SpiroKind, type SpiroPoint } from './spiro';
import { spiroContoursFromControl, spiroContoursOf, spiroControlPath, spiroToPath, type SpiroContour } from './spiroPath';
import { transformPath } from './transformPath';

const pts = (kind: SpiroKind, ...xy: [number, number][]): SpiroPoint[] => xy.map(([x, y]) => ({ x, y, kind }));
const wave = (): SpiroContour => ({ points: pts('smooth', [0, 0], [80, 70], [170, 10], [260, 100], [300, 220]), closed: false });

/** The furthest any cubic of `path` strays from the nearest point of the solved spirals. */
function worstDeviation(path: ReturnType<typeof spiroToPath>['path'], contour: SpiroContour): number {
  const dense = solveSpiro(contour.points, contour.closed)
    .flatMap((seg) => Array.from({ length: 2001 }, (_, i) => eulerPointAt(seg.spiral!, i / 2000)));
  let worst = 0;
  let cubics = 0;
  forEachSegment(path.commands, path.coords, (cmd, ci, penX, penY) => {
    if (cmd !== PATH_C) return;
    cubics++;
    const c = path.coords.subarray(ci, ci + 6);
    const p0 = { x: penX, y: penY };
    for (let i = 1; i < 20; i++) {
      const q = cubicPointAt(p0, { x: c[0], y: c[1] }, { x: c[2], y: c[3] }, { x: c[4], y: c[5] }, i / 20);
      let near = Infinity;
      for (const p of dense) near = Math.min(near, Math.hypot(p.x - q.x, p.y - q.y));
      worst = Math.max(worst, near);
    }
  });
  if (cubics === 0) throw new Error('no cubics to measure');
  return worst;
}

describe('spiroToPath', () => {
  it('stays on the solved spirals, splitting a segment into several cubics where one would stray', () => {
    const contour = wave();
    const { path, at } = spiroToPath([contour]);
    // The dense sampling itself is about 0.07 apart, so this is its floor.
    expect(worstDeviation(path, contour)).toBeLessThan(0.08);
    expect(pathToAnchors(path).anchors[0].length).toBeGreaterThan(contour.points.length);
    expect(at[0]).toBe(0);
  });

  it('puts each point on the anchor `at` names', () => {
    const contour = wave();
    const { path, at } = spiroToPath([contour]);
    const anchors = pathToAnchors(path).anchors[0];
    contour.points.forEach((p, i) => {
      expect(anchors[at[i]].x).toBeCloseTo(p.x, 4);
      expect(anchors[at[i]].y).toBeCloseTo(p.y, 4);
    });
  });

  it('closes a closed contour with a curve back to its first point, and numbers anchors across contours', () => {
    const ring: SpiroContour = { points: pts('smooth', [100, 0], [0, 100], [-100, 0], [0, -100]), closed: true };
    const { path, at } = spiroToPath([ring, wave()]);
    const { anchors, closed } = pathToAnchors(path);
    expect(closed).toEqual([true, false]);
    expect(anchors[0][0].inHandle).toBeDefined();
    expect(at[4]).toBe(anchors[0].length);
  });
});

describe('spiroContoursOf', () => {
  it('reads the points back out of the path, after the path has moved', () => {
    const contour = wave();
    const { path, at } = spiroToPath([contour]);
    const moved = transformPath(path, [1, 0, 0, 1, 10, -5]) as typeof path;
    const back = spiroContoursOf(moved, contour.points.map((p) => p.kind), at)!;
    expect(back[0].closed).toBe(false);
    back[0].points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(contour.points[i].x + 10, 3);
      expect(p.y).toBeCloseTo(contour.points[i].y - 5, 3);
    });
  });

  it('declines indexes that do not describe the path', () => {
    const contour = wave();
    const { path, at } = spiroToPath([contour]);
    const kinds = contour.points.map((p) => p.kind);
    expect(spiroContoursOf(path, kinds.slice(1), at)).toBeNull();
    expect(spiroContoursOf(path, kinds, [1, ...at.slice(1)])).toBeNull();
    expect(spiroContoursOf(path, kinds, [...at.slice(0, -1), 999])).toBeNull();
  });
});

describe('spiroContoursFromControl', () => {
  it('keeps kinds point for point when the count holds, and by position when it changes', () => {
    const before: SpiroContour[] = [{
      points: [{ x: 0, y: 0, kind: 'corner' }, { x: 50, y: 50, kind: 'smooth' }, { x: 100, y: 0, kind: 'left' }],
      closed: false,
    }];
    const control = spiroControlPath(before);
    const dragged = transformPath(control, [1, 0, 0, 1, 5, 5]) as typeof control;
    expect(spiroContoursFromControl(dragged, before)[0].points.map((p) => p.kind)).toEqual(['corner', 'smooth', 'left']);
    const fewer = spiroControlPath([{ points: [before[0].points[0], before[0].points[2]], closed: false }]);
    expect(spiroContoursFromControl(fewer, before)[0].points.map((p) => p.kind)).toEqual(['corner', 'left']);
  });
});
