/**
 * The faces of an {@link Arrangement}, each labeled with the inputs covering it.
 */
import type { MultiPolygon, Polygon, Ring } from './adapter';
import { buildArrangement, type Arrangement } from './arrangement';

/** A connected region every point of which lies in exactly the inputs `mask` names. */
export interface ArrangementFace {
  mask: bigint;
  polygon: Polygon;
}

interface Cycle {
  edges: number[];
  area: number;
  component: number;
  minX: number; maxX: number; minY: number; maxY: number;
}

function components(arr: Arrangement): number[] {
  const parent = arr.xs.map((_, i) => i);
  const find = (v: number): number => {
    while (parent[v] !== v) { parent[v] = parent[parent[v]!]!; v = parent[v]!; }
    return v;
  };
  for (let h = 0; h < arr.origin.length; h += 2) parent[find(arr.origin[h]!)] = find(arr.origin[h + 1]!);
  return arr.xs.map((_, v) => find(v));
}

function traceCycles(arr: Arrangement, compOf: number[]): { cycles: Cycle[]; cycleOf: number[] } {
  const cycleOf: number[] = new Array(arr.origin.length).fill(-1);
  const cycles: Cycle[] = [];
  for (let start = 0; start < arr.origin.length; start++) {
    if (cycleOf[start] !== -1) continue;
    const c: Cycle = { edges: [], area: 0, component: compOf[arr.origin[start]!]!, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    let h = start;
    do {
      cycleOf[h] = cycles.length;
      c.edges.push(h);
      const x0 = arr.xs[arr.origin[h]!]!, y0 = arr.ys[arr.origin[h]!]!;
      const x1 = arr.xs[arr.origin[h ^ 1]!]!, y1 = arr.ys[arr.origin[h ^ 1]!]!;
      c.area += (x0 * y1 - x1 * y0) / 2;
      c.minX = Math.min(c.minX, x0); c.maxX = Math.max(c.maxX, x0);
      c.minY = Math.min(c.minY, y0); c.maxY = Math.max(c.maxY, y0);
      h = arr.next[h]!;
    } while (h !== start);
    cycles.push(c);
  }
  return { cycles, cycleOf };
}

/** Which inputs hold the point `(px, py)`, counting only edges outside `component`. */
function coverAt(arr: Arrangement, compOf: number[], component: number, px: number, py: number): bigint {
  let mask = 0n;
  for (let h = 0; h < arr.origin.length; h += 2) {
    const u = arr.origin[h]!, v = arr.origin[h + 1]!;
    if (compOf[u] === component) continue;
    const y0 = arr.ys[u]!, y1 = arr.ys[v]!;
    if ((y0 > py) === (y1 > py)) continue;
    const x = arr.xs[u]! + ((py - y0) / (y1 - y0)) * (arr.xs[v]! - arr.xs[u]!);
    if (x < px) mask ^= arr.owners[h >> 1]!;
  }
  return mask;
}

function ringOf(arr: Arrangement, cycle: Cycle): Ring {
  const ring: Ring = cycle.edges.map((h) => [arr.xs[arr.origin[h]!]!, arr.ys[arr.origin[h]!]!]);
  ring.push([ring[0]![0], ring[0]![1]]);
  return ring;
}

function ringHolds(ring: Ring, px: number, py: number): boolean {
  let inside = false;
  for (let k = 0; k + 1 < ring.length; k++) {
    const [x0, y0] = ring[k]!;
    const [x1, y1] = ring[k + 1]!;
    if ((y0 > py) !== (y1 > py) && px < x0 + ((py - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
  }
  return inside;
}

function popcount(mask: bigint): number {
  let c = 0;
  for (let m = mask; m; m &= m - 1n) c++;
  return c;
}

/**
 * Every face the boundaries of `inputs` cut the plane into that some input
 * covers, with its holes. Inputs must be clean polygon sets — rings that do
 * not cross themselves or each other, as `polygon-clipping` returns them — so
 * crossing an input's boundary always toggles it. Faces come smallest `mask`
 * population first, then by `mask`, then left to right.
 */
export function arrangementFaces(inputs: readonly MultiPolygon[]): ArrangementFace[] {
  const arr = buildArrangement(inputs);
  const compOf = components(arr);
  const { cycles, cycleOf } = traceCycles(arr, compOf);

  // Each component's outer boundary is its one clockwise cycle.
  const outerOf = new Map<number, number>();
  cycles.forEach((c, i) => {
    const best = outerOf.get(c.component);
    if (best === undefined || c.area < cycles[best]!.area) outerOf.set(c.component, i);
  });

  const label: (bigint | undefined)[] = new Array(cycles.length);
  for (const [component, outer] of outerOf) {
    const v = arr.origin[cycles[outer]!.edges[0]!]!;
    label[outer] = coverAt(arr, compOf, component, arr.xs[v]!, arr.ys[v]!);
    const queue = [outer];
    while (queue.length > 0) {
      const f = queue.pop()!;
      for (const h of cycles[f]!.edges) {
        const g = cycleOf[h ^ 1]!;
        if (label[g] !== undefined) continue;
        label[g] = label[f]! ^ arr.owners[h >> 1]!;
        queue.push(g);
      }
    }
  }

  let extent = 1;
  for (let v = 0; v < arr.xs.length; v++) extent = Math.max(extent, Math.abs(arr.xs[v]!), Math.abs(arr.ys[v]!));
  const minArea = 1e-12 * extent * extent;
  const faces = new Map<number, ArrangementFace>();
  cycles.forEach((c, i) => {
    if (c.area > minArea && label[i]) faces.set(i, { mask: label[i]!, polygon: [ringOf(arr, c)] });
  });

  // A component's outer boundary is a hole in the smallest face of another
  // component that holds it.
  for (const [component, outer] of outerOf) {
    const v = arr.origin[cycles[outer]!.edges[0]!]!;
    const px = arr.xs[v]!, py = arr.ys[v]!;
    let host = -1;
    cycles.forEach((c, i) => {
      if (c.component === component || c.area <= minArea) return;
      if (px < c.minX || px > c.maxX || py < c.minY || py > c.maxY) return;
      if (host !== -1 && cycles[host]!.area <= c.area) return;
      if (ringHolds(ringOf(arr, c), px, py)) host = i;
    });
    faces.get(host)?.polygon.push(ringOf(arr, cycles[outer]!));
  }

  const left = (f: ArrangementFace) => Math.min(...f.polygon[0]!.map((p) => p[0]));
  const low = (f: ArrangementFace) => Math.min(...f.polygon[0]!.map((p) => p[1]));
  return [...faces.values()].sort((a, b) =>
    popcount(a.mask) - popcount(b.mask)
    || (a.mask < b.mask ? -1 : a.mask > b.mask ? 1 : 0)
    || left(a) - left(b) || low(a) - low(b));
}
