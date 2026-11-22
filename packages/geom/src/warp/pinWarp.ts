/**
 * Pin warp deformation: pins placed on a shape and dragged, with everything
 * between them moved as rigidly as the pins allow. The shape's fill is
 * triangulated (`pinWarpMesh`) and deformed as-rigid-as-possible (`arap`), so
 * the pull of a pin travels through the shape: two limbs that nearly touch
 * share no triangle and move apart. A point is carried by a smooth
 * (Clough–Tocher) interpolation of the deformed mesh, so a bend has no kink
 * where two triangles meet.
 */
import type { PolygonPath } from '../path';
import type { Point } from '../paths/cubicMath';
import { createArapSolver, type ArapSolveOptions, type ArapSolver } from './arap';
import { cloughTocherMap, restFrames, type RestFrames } from './cloughTocher';
import { meshLocator, type MeshSpot } from './meshMap';
import { pinWarpMesh, type PinWarpMesh } from './pinWarpMesh';

/** A pin: where it was placed on the unwarped shape, and where it is now. */
export interface WarpPin {
  from: Point;
  to: Point;
}

/** What a pin set costs to set up once: the mesh, its factored solve, and its point lookup. */
interface Rig {
  key: string;
  mesh: PinWarpMesh;
  frames: RestFrames;
  solver: ArapSolver;
  locate: (x: number, y: number) => MeshSpot | null;
  spots: Map<number, Map<number, MeshSpot | null>>;
  remembered: number;
}

const rigs = new WeakMap<PolygonPath, Rig>();

function ensureRig(source: PolygonPath, pins: readonly WarpPin[]): Rig {
  const key = pins.map((p) => `${p.from.x},${p.from.y}`).join(';');
  const held = rigs.get(source);
  if (held?.key === key) return held;
  const mesh = pinWarpMesh(source, pins.map((p) => p.from));
  const { pinned } = pinTargets(mesh, pins);
  const rig: Rig = { key, mesh, frames: restFrames(mesh), solver: createArapSolver(mesh, pinned), locate: meshLocator(mesh), spots: new Map(), remembered: 0 };
  rigs.set(source, rig);
  return rig;
}

/**
 * The map `pins` make of `source`'s fill: smooth across the deformed mesh,
 * through every pin, and carried on past the outline for a point off the
 * shape. The mesh and its solve are set up once per source and pin set, so
 * moving pins only re-solves. No pins, or none moved, is the identity, and
 * one pin moves the whole shape with it.
 */
export function pinWarpMap(source: PolygonPath, pins: readonly WarpPin[]): (p: Point) => Point {
  if (pins.every((p) => p.to.x === p.from.x && p.to.y === p.from.y)) return (p) => ({ x: p.x, y: p.y });
  const rig = ensureRig(source, pins);
  const at = solveRig(rig, pins);
  if (!at) {
    const dx = pins[0].to.x - pins[0].from.x, dy = pins[0].to.y - pins[0].from.y;
    return (p) => ({ x: p.x + dx, y: p.y + dy });
  }
  const place = cloughTocherMap(rig.mesh, rig.frames, at);
  return (p) => {
    const spot = spotOf(rig, p);
    return spot ? place(spot) : { x: p.x, y: p.y };
  };
}

/** The vertices of `mesh` that `pins` hold, in pin order, and each one's target. Pins
 *  sharing a vertex move it by the mean of their drags; a pin off the outline holds the
 *  outline point it snapped to, carried by its own drag. */
export function pinTargets(mesh: PinWarpMesh, pins: readonly WarpPin[]): { pinned: number[]; targets: number[] } {
  const drag = new Map<number, { dx: number; dy: number; n: number }>();
  pins.forEach((pin, k) => {
    const v = mesh.pinVertex[k];
    if (v < 0) return;
    const d = drag.get(v) ?? { dx: 0, dy: 0, n: 0 };
    d.dx += pin.to.x - pin.from.x; d.dy += pin.to.y - pin.from.y; d.n++;
    drag.set(v, d);
  });
  const targets: number[] = [];
  for (const [v, d] of drag) targets.push(mesh.vertices[2 * v] + d.dx / d.n, mesh.vertices[2 * v + 1] + d.dy / d.n);
  return { pinned: [...drag.keys()], targets };
}

/** The rig's vertices under `pins`, or null when no pin landed on the mesh. */
function solveRig(rig: Rig, pins: readonly WarpPin[], opts?: ArapSolveOptions): Float64Array | null {
  const { pinned, targets } = pinTargets(rig.mesh, pins);
  return pinned.length === 0 ? null : rig.solver.solve(targets, opts);
}

/**
 * The mesh `pinWarpMap` deforms for `pins` and where its vertices land, solved
 * with `opts` — its `trace` reports every stage of the solve, and its round
 * caps bound it. With the default options the vertices are the ones
 * `pinWarpMap` places points by. Null with no pins, or when none landed on the
 * mesh (then `pinWarpMap` moves the shape with the first pin).
 */
export function pinWarpSolve(
  source: PolygonPath,
  pins: readonly WarpPin[],
  opts?: ArapSolveOptions,
): { mesh: PinWarpMesh; vertices: Float64Array } | null {
  if (pins.length === 0) return null;
  const rig = ensureRig(source, pins);
  const vertices = solveRig(rig, pins, opts);
  return vertices ? { mesh: rig.mesh, vertices } : null;
}

/** How many points a rig remembers the spot of before starting over. */
const SPOT_CAP = 1 << 16;

/** Where `p` sits in the rig's mesh. A drag maps the same samples of the path
 *  every frame, so each is looked up once per pin set. */
function spotOf(rig: Rig, p: Point): MeshSpot | null {
  let row = rig.spots.get(p.x);
  const hit = row?.get(p.y);
  if (hit !== undefined) return hit;
  const spot = rig.locate(p.x, p.y);
  if (++rig.remembered > SPOT_CAP) { rig.spots.clear(); rig.remembered = 1; row = undefined; }
  if (!row) { row = new Map(); rig.spots.set(p.x, row); }
  row.set(p.y, spot);
  return spot;
}

/**
 * The point `map` sends to `target`, found by Newton steps from `guess` through
 * the map's local Jacobian, each halved until it shrinks the miss, until the
 * miss is within `tolerance`. A smooth map that turns the shape any amount
 * converges in a few steps. Returns the point with the smallest miss found.
 */
export function unwarpPoint(
  map: (p: Point) => Point,
  target: Point,
  guess: Point = target,
  tolerance = 1e-3,
): Point {
  const missAt = (p: Point) => {
    const at = map(p);
    return { x: target.x - at.x, y: target.y - at.y };
  };
  let p = { x: guess.x, y: guess.y };
  let e = missAt(p);
  let miss = Math.hypot(e.x, e.y);
  for (let k = 0; k < 50 && miss > tolerance; k++) {
    const d = 1e-6 * Math.max(1, Math.abs(p.x), Math.abs(p.y));
    const ax = map({ x: p.x + d, y: p.y }), bx = map({ x: p.x - d, y: p.y });
    const ay = map({ x: p.x, y: p.y + d }), by = map({ x: p.x, y: p.y - d });
    const j00 = (ax.x - bx.x) / (2 * d), j10 = (ax.y - bx.y) / (2 * d);
    const j01 = (ay.x - by.x) / (2 * d), j11 = (ay.y - by.y) / (2 * d);
    const det = j00 * j11 - j01 * j10;
    // Where the map folds flat here, step by the miss itself.
    let sx = e.x, sy = e.y;
    if (Number.isFinite(det) && det !== 0) {
      sx = (j11 * e.x - j01 * e.y) / det;
      sy = (j00 * e.y - j10 * e.x) / det;
    }
    let moved = false;
    for (let t = 1; t > 1e-6; t /= 2) {
      const q = { x: p.x + t * sx, y: p.y + t * sy };
      const f = missAt(q);
      const m = Math.hypot(f.x, f.y);
      if (m < miss) { p = q; e = f; miss = m; moved = true; break; }
    }
    if (!moved) break;
  }
  return p;
}
