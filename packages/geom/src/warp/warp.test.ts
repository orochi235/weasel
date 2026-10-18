import { describe, expect, it } from 'vitest';
import { PathBuilder } from '../paths/builder';
import { pathToAnchors } from '../paths/anchors';
import { nearestOnPath } from '../nearest';
import { PATH_C, PATH_L, PATH_M } from '../commands';
import type { Point } from '../paths/cubicMath';
import {
  applyPathWarp, bicubicMesh, bilinearQuad, coonsMesh, distortOver, envelopeOver, meshGridOver,
  moveWarpControl, pathWarpMap, projectiveQuad, resizeEnvelope, warpPath,
  type Quad,
} from './index';

const close = (p: Point, q: Point, eps = 1e-9) => {
  expect(p.x).toBeCloseTo(q.x, -Math.log10(eps));
  expect(p.y).toBeCloseTo(q.y, -Math.log10(eps));
};

const kite: Quad = [{ x: 0, y: 0 }, { x: 100, y: 10 }, { x: 120, y: 90 }, { x: -10, y: 80 }];

function square(x: number, y: number, s: number) {
  return new PathBuilder().moveTo(x, y).lineTo(x + s, y).lineTo(x + s, y + s).lineTo(x, y + s).close().build();
}

describe('quad maps', () => {
  it('send the unit square corners onto the quad, both of them', () => {
    const maps = [bilinearQuad(kite), projectiveQuad(kite)!];
    for (const m of maps) {
      close(m(0, 0), kite[0], 1e-6);
      close(m(1, 0), kite[1], 1e-6);
      close(m(1, 1), kite[2], 1e-6);
      close(m(0, 1), kite[3], 1e-6);
    }
  });

  it('keeps the square diagonal straight under the projective map, and bends it under the bilinear one', () => {
    const lineDev = (m: (u: number, v: number) => Point) => {
      const a = m(0, 0), b = m(1, 1), c = m(0.5, 0.5);
      return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
    };
    expect(lineDev(projectiveQuad(kite)!)).toBeLessThan(1e-9);
    expect(lineDev(bilinearQuad(kite))).toBeGreaterThan(0.5);
  });

  it('has no projective map onto a quad folded over itself', () => {
    expect(projectiveQuad([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }])).toBeNull();
  });
});

describe('mesh maps', () => {
  const grid = meshGridOver({ x: 10, y: 20, width: 200, height: 100 }, 3, 4);

  it('map an even grid onto its own box', () => {
    for (const m of [bicubicMesh(grid), coonsMesh(grid)]) {
      close(m(0.37, 0.81), { x: 10 + 0.37 * 200, y: 20 + 0.81 * 100 }, 1e-9);
    }
  });

  it('pass through every grid point, a moved one included', () => {
    const points = [...grid.points];
    points[6] = { x: points[6].x + 15, y: points[6].y - 9 };
    const moved = { ...grid, points };
    for (const m of [bicubicMesh(moved), coonsMesh(moved)]) {
      close(m(1 / 4, 1 / 3), points[6], 1e-9);
      close(m(1, 1), points[points.length - 1], 1e-9);
    }
  });

  it('disagree inside a cell once a point diagonally beyond it moves', () => {
    // Row 0, column 1: in the bicubic surface's reach for the cell at row 1,
    // column 2, but on none of the grid lines bounding that cell.
    const points = [...grid.points];
    points[1] = { x: points[1].x - 40, y: points[1].y - 40 };
    const moved = { ...grid, points };
    const a = bicubicMesh(moved)(0.6, 0.5);
    const b = coonsMesh(moved)(0.6, 0.5);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1e-6);
  });
});

describe('warpPath', () => {
  it('keeps every anchor, at the point it maps to', () => {
    const map = (p: Point) => ({ x: p.x * 2 + 3, y: p.y + p.x * 0.5 });
    const out = warpPath(square(0, 0, 50), map);
    const anchors = pathToAnchors(out).anchors[0];
    expect(anchors.map(({ x, y }) => ({ x, y }))).toEqual([
      map({ x: 0, y: 0 }), map({ x: 50, y: 0 }), map({ x: 50, y: 50 }), map({ x: 0, y: 50 }),
    ]);
    // An affine map keeps every edge straight.
    expect(Array.from(out.commands).filter((c) => c === PATH_C)).toHaveLength(0);
  });

  it('refits a bent edge within the tolerance of the exact warp', () => {
    const line = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
    const bend = (p: Point) => ({ x: p.x, y: 0.01 * p.x * (100 - p.x) });
    for (const tolerance of [0.05, 1]) {
      const out = warpPath(line, bend, { tolerance });
      expect(Array.from(out.commands)).toContain(PATH_C);
      for (let k = 0; k <= 50; k++) {
        const target = bend({ x: 2 * k, y: 0 });
        expect(nearestOnPath(out.commands, out.coords, target.x, target.y)!.dist).toBeLessThanOrEqual(tolerance + 1e-6);
      }
    }
  });

  it('keeps a straight edge straight when the map does', () => {
    const corners: Quad = [{ x: 0, y: 0 }, { x: 100, y: 20 }, { x: 90, y: 100 }, { x: 10, y: 80 }];
    const warp = { ...distortOver({ x: 0, y: 0, width: 100, height: 100 }, 'perspective'), corners };
    const diagonal = new PathBuilder().moveTo(0, 0).lineTo(100, 100).build();
    expect(Array.from(applyPathWarp(diagonal, warp).commands)).toEqual([PATH_M, PATH_L]);
  });
});

describe('path warps', () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };
  const area = square(0, 0, 50);

  it('start out as the identity', () => {
    const p = { x: 31, y: 17 };
    for (const w of [distortOver(box), distortOver(box, 'perspective'), envelopeOver(box, 2, 3), { kind: 'puppet' as const, pins: [] }]) {
      close(pathWarpMap(w, area)(p), p, 1e-9);
    }
  });

  it('move a corner, a mesh point and a pin by index', () => {
    const d = moveWarpControl(distortOver(box), 2, { x: 130, y: 70 });
    close(pathWarpMap(d, area)({ x: 100, y: 50 }), { x: 130, y: 70 });
    const e = moveWarpControl(envelopeOver(box, 1, 1), 0, { x: -10, y: -10 });
    close(pathWarpMap(e, area)({ x: 0, y: 0 }), { x: -10, y: -10 });
    const p = moveWarpControl({ kind: 'puppet', pins: [{ from: { x: 0, y: 0 }, to: { x: 0, y: 0 } }] }, 0, { x: 4, y: 4 });
    close(pathWarpMap(p, area)({ x: 10, y: 10 }), { x: 14, y: 14 });
  });

  it('resample an envelope at a new resolution without moving its grid points', () => {
    const e = moveWarpControl(envelopeOver(box, 2, 2), 4, { x: 60, y: 35 });
    const finer = resizeEnvelope(e as never, 4, 4);
    expect(finer.mesh.points).toHaveLength(25);
    close(finer.mesh.points[12], { x: 60, y: 35 }, 1e-9);
  });
});
