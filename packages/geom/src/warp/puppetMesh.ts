/**
 * The mesh a puppet warp deforms: the path's filled region triangulated with
 * its outline as the triangles' edges, so two parts of the shape share a
 * triangle only where the fill joins them. Interior points on an even lattice
 * keep the triangles near equilateral, and each pin gets a vertex of its own.
 */
import earcut from 'earcut';
import type { PolygonPath } from '../path';
import type { Point } from '../paths/cubicMath';
import { boundsOfPath } from '../paths/bounds';
import { pointInPolygon } from '../polyline';
import { flattenPolygon } from '../tessellate/tessellate';
import { resolveCrossings, type FlattenedContours } from '../tessellate/crossings';
import { nestRings } from '../tessellate/nesting';
import type { ArapMesh } from './arap';
import { refineTriangulation } from './refine';
import { addOrigin } from '../paths/pathOrigin';

/** A puppet's mesh, and the vertex standing for each pin. */
export interface PuppetMesh extends ArapMesh {
  pinVertex: Int32Array;
}

/** Options for {@link puppetMesh}. */
export interface PuppetMeshOptions {
  /** Roughly how many vertices to spread over the region. Default 400. */
  vertices?: number;
}

interface MeshPoint {
  x: number;
  y: number;
  pins: number[];
}

/** One filled piece: its outline, its holes, and the points inside it. */
interface Region {
  rings: MeshPoint[][];
  inner: MeshPoint[];
}

function ringsOf(path: PolygonPath, tolerance: number): { flat: FlattenedContours; filled: (w: number) => boolean } {
  const flat = flattenPolygon(path, tolerance);
  addOrigin(path, flat.coords);
  if (path.fillRule === 'evenodd') return { flat, filled: (w) => w % 2 !== 0 };
  const crossed = resolveCrossings(flat);
  const nonzero = (w: number) => w !== 0;
  if (crossed) return { flat: crossed, filled: nonzero };
  const simple = nestRings(flat).every((r) => Math.abs(r.winding) <= 1);
  return { flat: simple ? flat : resolveCrossings(flat, true)!, filled: nonzero };
}

/** The ring from vertex `start` to `end` of `coords`, with no edge longer than `h`. */
function resample(coords: number[], start: number, end: number, h: number): MeshPoint[] {
  const out: MeshPoint[] = [];
  for (let i = start; i < end; i++) {
    const j = i + 1 === end ? start : i + 1;
    const ax = coords[2 * i], ay = coords[2 * i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(coords[2 * j] - ax, coords[2 * j + 1] - ay) / h));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      out.push({ x: ax + (coords[2 * j] - ax) * t, y: ay + (coords[2 * j + 1] - ay) * t, pins: [] });
    }
  }
  return out.filter((p, i) => {
    const q = out[(i + 1) % out.length];
    return out.length < 2 || p.x !== q.x || p.y !== q.y;
  });
}

function regionsOf(path: PolygonPath, tolerance: number, h: number): { regions: Region[]; area: number } {
  const { flat, filled } = ringsOf(path, tolerance);
  const rings = nestRings(flat);
  const regions = new Map<number, Region>();
  let area = 0;
  rings.forEach((r, i) => {
    if (r.area === 0 || !filled(r.winding)) return;
    if (r.parent >= 0 && filled(rings[r.parent].winding)) return;
    regions.set(i, { rings: [resample(flat.coords, r.start, r.end, h)], inner: [] });
    area += Math.abs(r.area);
  });
  rings.forEach((r) => {
    const outer = r.area !== 0 && !filled(r.winding) ? regions.get(r.parent) : undefined;
    if (!outer) return;
    outer.rings.push(resample(flat.coords, r.start, r.end, h));
    area -= Math.abs(r.area);
  });
  return { regions: [...regions.values()], area };
}

const flatRing = (ring: MeshPoint[]) => ring.flatMap((p) => [p.x, p.y]);

function inside(region: Region, x: number, y: number, flats = region.rings.map(flatRing)): boolean {
  return flats.every((ring, i) => pointInPolygon(ring, x, y) === (i === 0));
}

/** The nearest point on any ring of `region` to `(x, y)`. */
function nearestEdge(region: Region, x: number, y: number): { d: number; ring: number; edge: number; t: number } {
  let best = { d: Infinity, ring: 0, edge: 0, t: 0 };
  region.rings.forEach((ring, r) => ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
    const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
    if (d < best.d) best = { d, ring: r, edge: i, t };
  }));
  return best;
}

/** Give pin `k` a vertex: on the outline where it is on or outside it, inside where it is inside. */
function placePin(regions: Region[], pin: Point, k: number, h: number): void {
  const home = regions.find((r) => inside(r, pin.x, pin.y));
  const near = (home ? [home] : regions)
    .map((region) => ({ region, ...nearestEdge(region, pin.x, pin.y) }))
    .reduce((a, b) => (b.d < a.d ? b : a));
  const snap = 0.25 * h;
  if (home && near.d > snap) {
    const same = home.inner.find((p) => Math.hypot(p.x - pin.x, p.y - pin.y) < 1e-9 * h);
    if (same) same.pins.push(k);
    else home.inner.push({ x: pin.x, y: pin.y, pins: [k] });
    return;
  }
  const ring = near.region.rings[near.ring];
  const a = ring[near.edge], b = ring[(near.edge + 1) % ring.length];
  const at = { x: a.x + (b.x - a.x) * near.t, y: a.y + (b.y - a.y) * near.t };
  const da = Math.hypot(at.x - a.x, at.y - a.y), db = Math.hypot(at.x - b.x, at.y - b.y);
  if (Math.min(da, db) <= snap) (da <= db ? a : b).pins.push(k);
  else ring.splice(near.edge + 1, 0, { ...at, pins: [k] });
}

/** Whether any edge of `rings` passes within `r` of a point, through a grid of cells `r` wide. */
function clearanceTest(rings: MeshPoint[][], r: number): (x: number, y: number) => boolean {
  const cells = new Map<string, [MeshPoint, MeshPoint][]>();
  const key = (i: number, j: number) => `${i},${j}`;
  for (const ring of rings) {
    ring.forEach((a, n) => {
      const b = ring[(n + 1) % ring.length];
      for (let i = Math.floor(Math.min(a.x, b.x) / r); i <= Math.floor(Math.max(a.x, b.x) / r); i++) {
        for (let j = Math.floor(Math.min(a.y, b.y) / r); j <= Math.floor(Math.max(a.y, b.y) / r); j++) {
          const k = key(i, j);
          const list = cells.get(k);
          if (list) list.push([a, b]);
          else cells.set(k, [[a, b]]);
        }
      }
    });
  }
  return (x, y) => {
    const ci = Math.floor(x / r), cj = Math.floor(y / r);
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        for (const [a, b] of cells.get(key(i, j)) ?? []) {
          const dx = b.x - a.x, dy = b.y - a.y;
          const len2 = dx * dx + dy * dy;
          const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
          if (Math.hypot(a.x + dx * t - x, a.y + dy * t - y) < r) return true;
        }
      }
    }
    return false;
  };
}

/** Where the horizontal line at `y` crosses any of `rings`, sorted; a point on it is inside where an odd count lie left of it. */
function crossingsAt(rings: MeshPoint[][], y: number): number[] {
  const xs: number[] = [];
  for (const ring of rings) {
    ring.forEach((a, n) => {
      const b = ring[(n + 1) % ring.length];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    });
  }
  return xs.sort((p, q) => p - q);
}

/** Points of a triangular lattice of spacing `h` inside `region`, clear of its outline and its pins. */
function fillLattice(region: Region, h: number): void {
  const outer = region.rings[0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of outer) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const pins = [...region.inner];
  const nearOutline = clearanceTest(region.rings, 0.5 * h);
  const rowH = h * Math.sqrt(3) / 2;
  for (let row = 0, y = y0 + rowH / 2; y < y1; row++, y += rowH) {
    const xs = crossingsAt(region.rings, y);
    let left = 0;
    for (let x = x0 + (row % 2 ? h / 2 : h / 4); x < x1; x += h) {
      while (left < xs.length && xs[left] < x) left++;
      if (left % 2 === 0 || nearOutline(x, y)) continue;
      if (pins.some((p) => Math.hypot(p.x - x, p.y - y) < 0.5 * h)) continue;
      region.inner.push({ x, y, pins: [] });
    }
  }
}

/**
 * The mesh a puppet with pins at `pins` deforms over `path`'s fill. A pin
 * inside the fill gets a vertex where it is; one on the outline, or off the
 * shape, gets the nearest point of the outline. Pins on one spot share a vertex.
 */
export function puppetMesh(path: PolygonPath, pins: readonly Point[], opts: PuppetMeshOptions = {}): PuppetMesh {
  const box = boundsOfPath(path);
  const size = Math.max(box.width, box.height);
  const empty = { vertices: new Float64Array(0), triangles: new Uint32Array(0), pinVertex: new Int32Array(pins.length).fill(-1) };
  if (!(size > 0)) return empty;
  const tolerance = size / 1000;
  const rough = regionsOf(path, tolerance, size);
  const h = Math.max(Math.sqrt(Math.max(rough.area, 0) / (opts.vertices ?? 400)), size / 400);
  const { regions } = regionsOf(path, tolerance, h);
  if (regions.length === 0) return empty;
  pins.forEach((p, k) => placePin(regions, p, k, h));
  const vertices: number[] = [];
  const triangles: number[] = [];
  const pinVertex = new Int32Array(pins.length).fill(-1);
  for (const region of regions) {
    fillLattice(region, h);
    const points = [...region.rings.flat(), ...region.inner];
    const holes: number[] = [];
    let at = 0;
    for (const ring of region.rings) { if (at > 0) holes.push(at); at += ring.length; }
    const offset = vertices.length / 2;
    const coords = points.flatMap((p) => [p.x, p.y]);
    const outline = earcut(coords.slice(0, 2 * at), holes.length > 0 ? holes : undefined);
    for (const t of refineTriangulation(coords, outline, at)) triangles.push(t + offset);
    points.forEach((p, i) => { for (const k of p.pins) pinVertex[k] = offset + i; });
    vertices.push(...coords);
  }
  return { vertices: Float64Array.from(vertices), triangles: Uint32Array.from(triangles), pinVertex };
}
