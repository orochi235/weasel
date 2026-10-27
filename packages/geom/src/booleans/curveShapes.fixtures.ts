/** Shapes and measures the curve-preserving boolean tests share. */

import polygonClipping from 'polygon-clipping';
import { pathToMultiPolygon, type MultiPolygon } from './adapter';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from '../commands';
import type { Path, PolygonPath } from '../path';
import { ellipsePath } from '../paths/builder';
import { parseContours, windingAt } from './contours';

export const circle = (cx: number, cy: number, r: number): PolygonPath =>
  ellipsePath({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r });
export const rect = (x: number, y: number, width: number, height: number): Path => ({ kind: 'rect', x, y, width, height });

const ringArea = (ring: [number, number][]): number => {
  let a = 0;
  for (let i = 0; i + 1 < ring.length; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
};
export const mpArea = (mp: MultiPolygon): number =>
  mp.reduce((s, poly) => s + poly.reduce((t, ring, i) => t + (i === 0 ? 1 : -1) * Math.abs(ringArea(ring)), 0), 0);

/** `p` flattened finely enough that areas compare to a tenth. */
export const fine = (p: Path): MultiPolygon => pathToMultiPolygon(p, { tolerance: 0.005 });

/** Area a fill of `p` covers, from a fine flattening resolved by the clipper. */
export const area = (p: Path): number => {
  const mp = fine(p);
  return mp.length === 0 ? 0 : mpArea(polygonClipping.union(mp));
};

/** Whether a fill of `p` covers (x, y), against the exact curves. */
export const pointInPath = (p: Path, x: number, y: number): boolean => {
  const w = windingAt({ x, y }, parseContours(p));
  return p.kind === 'polygon' && p.fillRule === 'evenodd' ? (w & 1) !== 0 : w !== 0;
};

export const hasCurves = (p: PolygonPath): boolean => p.commands.some((c) => c === PATH_C || c === PATH_Q);

/** Seeded xorshift, so a failing case can be replayed. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

/** A closed blob of cubics around a center, star-shaped so it never crosses itself. */
function blob(r: () => number, cx: number, cy: number, size: number): PolygonPath {
  const n = 3 + Math.floor(r() * 4);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const d = size * (0.5 + r() * 0.5);
    pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
  }
  const cmds: number[] = [PATH_M];
  const xs: number[] = [pts[0][0], pts[0][1]];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const k = 0.3 + r() * 0.3;
    // Bulge the controls outward along the radius.
    const out = (x: number, y: number) => [cx + (x - cx) * (1 + k), cy + (y - cy) * (1 + k)];
    if (r() < 0.2) {
      cmds.push(PATH_L);
      xs.push(q[0], q[1]);
    } else {
      cmds.push(PATH_C);
      xs.push(...out(p[0] * 0.67 + q[0] * 0.33, p[1] * 0.67 + q[1] * 0.33), ...out(p[0] * 0.33 + q[0] * 0.67, p[1] * 0.33 + q[1] * 0.67), q[0], q[1]);
    }
  }
  cmds.push(PATH_Z);
  return { kind: 'polygon', commands: Uint8Array.from(cmds), coords: Float32Array.from(xs), fillRule: 'nonzero' };
}

/** A random shape; on `grid`, centers and sizes fall on multiples of 5, so outlines touch at joints and run along each other. */
export function shape(r: () => number, grid = false): Path {
  const snap = (v: number) => (grid ? Math.round(v / 5) * 5 : v);
  const cx = snap(r() * 40), cy = snap(r() * 40), size = snap(8 + r() * 20);
  const pick = r();
  if (pick < 0.3) return circle(cx, cy, size);
  if (pick < 0.45) return rect(cx - size, cy - size * 0.6, size * 2, size * 1.2);
  if (pick < 0.55) return ellipsePath({ x: cx - size, y: cy - size / 2, width: size * 2, height: size });
  return blob(r, cx, cy, size);
}

/** A clipper result as an even-odd path, to test points against. */
export function multiPath(mp: MultiPolygon): PolygonPath {
  const cmds: number[] = [];
  const xs: number[] = [];
  for (const poly of mp) for (const ring of poly) {
    ring.slice(0, -1).forEach(([x, y], i) => { cmds.push(i === 0 ? PATH_M : PATH_L); xs.push(x, y); });
    cmds.push(PATH_Z);
  }
  return { kind: 'polygon', commands: Uint8Array.from(cmds), coords: Float32Array.from(xs), fillRule: 'evenodd' };
}

/** Whether a probe sits too close to an outline for two flattenings to agree on it. */
export function nearOutline(p: Path, x: number, y: number): boolean {
  for (const [dx, dy] of [[0.02, 0], [-0.02, 0], [0, 0.02], [0, -0.02]]) {
    if (pointInPath(p, x + dx, y + dy) !== pointInPath(p, x, y)) return true;
  }
  return false;
}
