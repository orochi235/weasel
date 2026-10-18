/**
 * Puppet deformation: pins placed on a shape and dragged, with everything
 * between them moved as rigidly as the pins allow. The shape's fill is
 * triangulated (`puppetMesh`) and deformed as-rigid-as-possible (`arap`), so
 * the pull of a pin travels through the shape: two limbs that nearly touch
 * share no triangle and move apart. A point follows the triangle holding it.
 */
import type { PolygonPath } from '../path';
import type { Point } from '../paths/cubicMath';
import { createArapSolver, type ArapSolver } from './arap';
import { meshLocator, placeSpot, type MeshSpot } from './meshMap';
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
  const rig: Rig = { key, mesh, solver: createArapSolver(mesh, pinned), locate: meshLocator(mesh), spots: new Map(), remembered: 0 };
  rigs.set(source, rig);
  return rig;
}

/**
 * The map `pins` make of `source`'s fill: each point carried by the triangle
 * of the deformed mesh holding it, or the nearest one for a point off the
 * shape. The mesh and its solve are set up once per source and pin set, so
 * moving pins only re-solves. No pins is the identity, and one pin moves the
 * whole shape with it.
 */
export function puppetMap(source: PolygonPath, pins: readonly PuppetPin[]): (p: Point) => Point {
  if (pins.length === 0) return (p) => ({ x: p.x, y: p.y });
  const rig = rigFor(source, pins);
  const targets: number[] = [];
  const seen = new Set<number>();
  pins.forEach((pin, k) => {
    const v = rig.mesh.pinVertex[k];
    if (v < 0 || seen.has(v)) return;
    seen.add(v);
    // A pin off the outline holds the outline point it snapped to, carried by its own drag.
    targets.push(pin.to.x + rig.mesh.vertices[2 * v] - pin.from.x, pin.to.y + rig.mesh.vertices[2 * v + 1] - pin.from.y);
  });
  if (targets.length === 0) {
    const dx = pins[0].to.x - pins[0].from.x, dy = pins[0].to.y - pins[0].from.y;
    return (p) => ({ x: p.x + dx, y: p.y + dy });
  }
  const at = rig.solver.solve(targets);
  return (p) => {
    const spot = spotOf(rig, p);
    return spot ? placeSpot(rig.mesh.triangles, at, spot) : { x: p.x, y: p.y };
  };
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
