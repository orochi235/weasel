/**
 * Puppet deformation: pins placed on a shape and dragged, with everything
 * between them moved as rigidly as the pins allow. The shape's fill is
 * triangulated (`puppetMesh`) and deformed as-rigid-as-possible (`arap`), so
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
import { puppetMesh, type PuppetMesh } from './puppetMesh';

/** A pin: where it was placed on the unwarped shape, and where it is now. */
export interface PuppetPin {
  from: Point;
  to: Point;
}

/** What a pin set costs to set up once: the mesh, its factored solve, and its point lookup. */
interface Rig {
  key: string;
  mesh: PuppetMesh;
  frames: RestFrames;
  solver: ArapSolver;
  locate: (x: number, y: number) => MeshSpot | null;
  spots: Map<number, Map<number, MeshSpot | null>>;
  remembered: number;
}

const rigs = new WeakMap<PolygonPath, Rig>();

function rigFor(source: PolygonPath, pins: readonly PuppetPin[]): Rig {
  const key = pins.map((p) => `${p.from.x},${p.from.y}`).join(';');
  const held = rigs.get(source);
  if (held?.key === key) return held;
  const mesh = puppetMesh(source, pins.map((p) => p.from));
  const pinned = [...new Set(Array.from(mesh.pinVertex).filter((v) => v >= 0))];
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
export function puppetMap(source: PolygonPath, pins: readonly PuppetPin[]): (p: Point) => Point {
  if (pins.every((p) => p.to.x === p.from.x && p.to.y === p.from.y)) return (p) => ({ x: p.x, y: p.y });
  const rig = rigFor(source, pins);
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

/** The rig's vertices under `pins`, or null when no pin landed on the mesh. */
function solveRig(rig: Rig, pins: readonly PuppetPin[], opts?: ArapSolveOptions): Float64Array | null {
  const targets: number[] = [];
  const seen = new Set<number>();
  pins.forEach((pin, k) => {
    const v = rig.mesh.pinVertex[k];
    if (v < 0 || seen.has(v)) return;
    seen.add(v);
    // A pin off the outline holds the outline point it snapped to, carried by its own drag.
    targets.push(pin.to.x + rig.mesh.vertices[2 * v] - pin.from.x, pin.to.y + rig.mesh.vertices[2 * v + 1] - pin.from.y);
  });
  return targets.length === 0 ? null : rig.solver.solve(targets, opts);
}

/**
 * The mesh `puppetMap` deforms for `pins` and where its vertices land, solved
 * with `opts` — its `trace` reports every stage of the solve, and its round
 * caps bound it. With the default options the vertices are the ones
 * `puppetMap` places points by. Null with no pins, or when none landed on the
 * mesh (then `puppetMap` moves the shape with the first pin).
 */
export function puppetSolve(
  source: PolygonPath,
  pins: readonly PuppetPin[],
  opts?: ArapSolveOptions,
): { mesh: PuppetMesh; vertices: Float64Array } | null {
  if (pins.length === 0) return null;
  const rig = rigFor(source, pins);
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
 * The point `map` sends to `target`, found by stepping from `guess` by the
 * miss until it is within `tolerance` — for a map that stays close to rigid,
 * as a puppet's does, a few steps suffice. Returns the best point found.
 */
export function unwarpPoint(
  map: (p: Point) => Point,
  target: Point,
  guess: Point = target,
  tolerance = 1e-3,
): Point {
  let p = { x: guess.x, y: guess.y };
  for (let k = 0; k < 50; k++) {
    const at = map(p);
    const ex = target.x - at.x, ey = target.y - at.y;
    if (Math.hypot(ex, ey) <= tolerance) break;
    p = { x: p.x + ex, y: p.y + ey };
  }
  return p;
}
