/**
 * Hull clips against the rule they exist to reproduce: a pixel center is inside a hull exactly when it is inside the
 * clip's corners snapped to the sixteenth-pixel grid, ties going toward +x, or toward +y along a horizontal edge.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mat3, type GlMat3, type Path } from '@weasel-js/geom';
import { cornersOf, hullOf, meetHulls, snappedRectOf, windowMap, type HullSet, type WindowMap } from './batchHull';
import { HULL_ORIGIN_BIAS, HULL_ORIGIN_SPAN, HULL_UNITS } from './testing/batch';
import { affine, axisAffine, pathOf, rectPath, runs, spread, tally, timeoutFor } from './pbt.fixture';

const U = HULL_UNITS;

/** A viewport and the projection a draw into it goes through, maybe turned. */
const target = fc.record({
  w: fc.noBias(fc.integer({ min: 16, max: 1600 })), h: fc.noBias(fc.integer({ min: 16, max: 1600 })),
  dpr: fc.constantFrom(1, 2, 1.5, 3),
  ox: fc.integer({ min: 0, max: 400 }), oy: fc.integer({ min: 0, max: 400 }),
  turn: fc.oneof({ weight: 3, arbitrary: fc.constant(0) }, { weight: 1, arbitrary: spread(-3.2, 3.2) }),
}).map(({ w, h, dpr, ox, oy, turn }) => {
  let proj = mat3.screenToClip(w, h);
  if (turn !== 0) {
    const c = Math.cos(turn), s = Math.sin(turn);
    proj = mat3.multiply(mat3.fromAffine([c, s, -s, c, 0, 0]), proj);
  }
  const width = Math.round(w * dpr), height = Math.round(h * dpr);
  return { map: windowMap(proj, [ox, oy], width, height), ox, oy, width, height, turned: turn !== 0 };
});

const ngon = fc.record({ n: fc.integer({ min: 3, max: 10 }), r: spread(0.1, 300), turn: spread(0, 6.3), cx: spread(-200, 200), cy: spread(-200, 200), flip: fc.boolean() })
  .map(({ n, r, turn, cx, cy, flip }) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const a = turn + ((flip ? -i : i) * 2 * Math.PI) / n;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
    return pathOf(pts, true);
  });

const clip: fc.Arbitrary<Path> = fc.oneof(rectPath, ngon);

/** Two clips about one center, so that they overlap more often than not. */
const nested: fc.Arbitrary<[Path, Path]> = fc.tuple(clip, clip).map(([a, b]) => {
  const center = (p: Path): { x: number; y: number } => {
    const c = cornersOf(p)!;
    let x = 0, y = 0;
    for (let i = 0; i < c.length; i += 2) { x += c[i]!; y += c[i + 1]!; }
    return { x: (2 * x) / c.length, y: (2 * y) / c.length };
  };
  const ca = center(a), cb = center(b);
  const c = cornersOf(b)!;
  const pts = [];
  for (let i = 0; i < c.length; i += 2) pts.push({ x: c[i]! - cb.x + ca.x, y: c[i + 1]! - cb.y + ca.y });
  return [a, pathOf(pts, true)];
});
/** A transform of either kind, scaled to about one and moved into the viewports above, so hulls land on them. */
const transform: fc.Arbitrary<GlMat3> = fc.tuple(fc.oneof(axisAffine, affine), spread(-2, 2), spread(0, 900), spread(0, 900))
  .map(([m, e, tx, ty]) => {
    const k = 2 ** e / Math.sqrt(Math.abs(m[0] * m[4] - m[1] * m[3]));
    return mat3.fromAffine([m[0] * k, m[1] * k, m[3] * k, m[4] * k, tx, ty]);
  });

/** The clip's corners on the window's sixteenth-pixel grid, counterclockwise. */
function snapped(path: Path, m: GlMat3, map: WindowMap): number[] {
  const local = cornersOf(path)!;
  const pts: number[] = [];
  for (let i = 0; i < local.length; i += 2) {
    const [sx, sy] = mat3.apply(m, local[i]!, local[i + 1]!);
    pts.push(Math.round((map.ax * sx + map.bx * sy + map.cx) * U), Math.round((map.ay * sx + map.by * sy + map.cy) * U));
  }
  let area = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    area += pts[i]! * pts[j + 1]! - pts[j]! * pts[i + 1]!;
  }
  if (area < 0) {
    const out: number[] = [];
    for (let i = pts.length - 2; i >= 0; i -= 2) out.push(pts[i]!, pts[i + 1]!);
    return out;
  }
  return pts;
}

/** Whether pixel `(px, py)`'s center is inside the convex ring `p`, by the rasterizer's tie rule. */
function inRing(p: readonly number[], px: number, py: number): boolean {
  const X = px * U + U / 2, Y = py * U + U / 2;
  let edges = 0;
  for (let i = 0; i < p.length; i += 2) {
    const vx = p[i]!, vy = p[i + 1]!;
    const dx = p[(i + 2) % p.length]! - vx, dy = p[(i + 3) % p.length]! - vy;
    if (dx === 0 && dy === 0) continue;
    edges++;
    const a = -dy, b = dx;
    const side = a * (X - vx) + b * (Y - vy);
    if (side < 0 || (side === 0 && !(a > 0 || (a === 0 && b > 0)))) return false;
  }
  // A clip snapped to one point holds nothing.
  return edges > 0;
}

/** Whether pixel `(px, py)`'s center passes every plane of `set`, as the shader tests it. */
function inSet(set: HullSet, px: number, py: number): boolean {
  const X = px * U + U / 2, Y = py * U + U / 2;
  for (let k = 0; k < set.count; k++) {
    const [a, b, c, w] = set.planes.subarray(4 * k, 4 * k + 4) as unknown as [number, number, number, number];
    const ox = (w % HULL_ORIGIN_SPAN) - HULL_ORIGIN_BIAS, oy = Math.floor(w / HULL_ORIGIN_SPAN) - HULL_ORIGIN_BIAS;
    if (a * (X - U * ox) + b * (Y - U * oy) + c < 0) return false;
  }
  return true;
}

/** Pixels of the viewport to test: near every snapped corner, where edges pass, and some anywhere. */
function pixels(t: { ox: number; oy: number; width: number; height: number }, corners: readonly number[], seed: number): [number, number][] {
  const out: [number, number][] = [];
  const keep = (x: number, y: number): void => {
    if (x >= t.ox && x < t.ox + t.width && y >= t.oy && y < t.oy + t.height) out.push([x, y]);
  };
  for (let i = 0; i < corners.length; i += 2) {
    const cx = Math.floor(corners[i]! / U), cy = Math.floor(corners[i + 1]! / U);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) keep(cx + dx, cy + dy);
    // Along the edge to the next corner.
    const nx = corners[(i + 2) % corners.length]! / U, ny = corners[(i + 3) % corners.length]! / U;
    for (let s = 1; s < 8; s++) keep(Math.floor(cx + ((nx - cx) * s) / 8), Math.floor(cy + ((ny - cy) * s) / 8));
  }
  let r = seed >>> 0;
  for (let k = 0; k < 24; k++) {
    r = (r * 1664525 + 1013904223) >>> 0;
    const x = t.ox + (r % t.width);
    r = (r * 1664525 + 1013904223) >>> 0;
    keep(x, t.oy + (r % t.height));
  }
  return out;
}

describe('hullOf, property', () => {
  it('holds a pixel exactly when its center is inside the clip snapped to the grid', () => {
    const t = tally();
    fc.assert(fc.property(clip, transform, target, fc.integer(), (path, m, tg, seed) => {
      const hull = hullOf(path, m, tg.map);
      if (hull === null) { t.count('null'); return; }
      const ring = snapped(path, m, tg.map);
      let inside = 0;
      for (const [px, py] of pixels(tg, ring, seed)) {
        const want = inRing(ring, px, py);
        if (want) inside++;
        expect(inSet(hull.set, px, py), `pixel ${px}, ${py}`).toBe(want);
      }
      t.count(inside > 0 ? (tg.turned ? 'turned' : 'hull') : 'none inside');
    }), runs(600));
    t.atLeast('hull', 60);
    t.atLeast('turned', 20);
    t.atLeast('none inside', 10);
    t.atLeast('null', 10);
  }, timeoutFor(600, 10));

  it('draws its stencil polygon through the same snapped corners', () => {
    fc.assert(fc.property(clip, transform, target, (path, m, tg) => {
      const hull = hullOf(path, m, tg.map);
      if (hull === null) return;
      const ring = new Set<string>();
      const s = snapped(path, m, tg.map);
      for (let i = 0; i < s.length; i += 2) ring.add(`${s[i]},${s[i + 1]}`);
      const c = hull.path.coords, map = tg.map;
      for (let i = 0; i < c.length; i += 2) {
        const x = c[i]! + (hull.path.origin?.x ?? 0), y = c[i + 1]! + (hull.path.origin?.y ?? 0);
        const wx = (map.ax * x + map.bx * y + map.cx) * U, wy = (map.ay * x + map.by * y + map.cy) * U;
        const k = `${Math.round(wx)},${Math.round(wy)}`;
        expect(ring.has(k), `${wx}, ${wy} is no snapped corner`).toBe(true);
        // Float32 corners: close enough that the rasterizer snaps each to the grid point it came from.
        expect(Math.max(Math.abs(wx - Math.round(wx)), Math.abs(wy - Math.round(wy)))).toBeLessThan(0.5);
      }
    }), runs(300));
  });

  it('answers a path again under a new transform as it answers a fresh copy of it', () => {
    fc.assert(fc.property(clip, transform, transform, target, (path, m1, m2, tg) => {
      const first = hullOf(path, m1, tg.map);
      expect(hullOf(path, m1, tg.map)).toBe(first);
      const again = hullOf(path, m2, tg.map), fresh = hullOf(structuredClone(path), m2, tg.map);
      expect(again?.set ?? null).toEqual(fresh?.set ?? null);
    }), runs(200));
  });
});

describe('meetHulls, property', () => {
  it('holds a pixel exactly when both hulls do', () => {
    const t = tally();
    fc.assert(fc.property(nested, transform, fc.option(transform, { nil: undefined, freq: 2 }), target, fc.integer(), ([p1, p2], m1, other, tg, seed) => {
      const m2 = other ?? m1;
      const a = hullOf(p1, m1, tg.map), b = hullOf(p2, m2, tg.map);
      if (a === null || b === null) return;
      const both = meetHulls(a.set, b.set);
      if (both === null) {
        t.count('too many');
        return;
      }
      let inside = 0;
      for (const [px, py] of pixels(tg, [...snapped(p1, m1, tg.map), ...snapped(p2, m2, tg.map)], seed)) {
        const want = inSet(a.set, px, py) && inSet(b.set, px, py);
        if (want) inside++;
        expect(inSet(both, px, py), `pixel ${px}, ${py}`).toBe(want);
      }
      expect(both.count).toBeLessThanOrEqual(8);
      t.count(inside > 0 ? 'met' : 'apart');
    }), runs(600));
    t.atLeast('met', 15);
    t.atLeast('apart', 30);
    t.atLeast('too many', 10);
  }, timeoutFor(600, 10));
});

describe('snappedRectOf, property', () => {
  it('is the box of the snapped corners, for a rect the window does not turn', () => {
    const t = tally();
    fc.assert(fc.property(rectPath, axisAffine, target, (path, m, tg) => {
      const got = snappedRectOf(path, m, tg.map);
      if (tg.map.bx !== 0 || tg.map.ay !== 0) { expect(got).toBeNull(); return; }
      const hull = hullOf(path, m, tg.map);
      if (hull === null) { expect(got).toBeNull(); return; }
      t.count('rect');
      const c = hull.path.coords;
      const xs = [...c].filter((_, i) => i % 2 === 0), ys = [...c].filter((_, i) => i % 2 === 1);
      const ox = hull.path.origin?.x ?? 0, oy = hull.path.origin?.y ?? 0;
      expect(got!.rect).toEqual({ x0: Math.min(...xs) + ox, y0: Math.min(...ys) + oy, x1: Math.max(...xs) + ox, y1: Math.max(...ys) + oy });
    }), runs(200));
    t.atLeast('rect', 60);
  });
});
