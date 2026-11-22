/**
 * The forces `force.ts` relaxes a graph under, in two dimensions or three.
 *
 * Each term reads `z` only when told the run has three dimensions, and a pair
 * exactly level on z feels in three exactly what it feels in two: the z terms
 * add zero, and box separation never shoves a level pair off its level. So a
 * run whose bodies all share one z keeps them there and lands them where the
 * flat run does.
 */
import type { SimulationForce } from '@weasel-js/simulation';
import type { Graph } from './graph';
import type { ForceBody } from './force';

/** The nearest repulsion reckons two bodies to be, in world units. Without a
 *  floor, a pair a nudge apart takes a kick that throws it thousands of units off. */
const MIN_CHARGE_DISTANCE = 10;
/** The golden angle. Coincident nodes fan out along it, which spreads any
 *  number of them without two landing on the same heading. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** How far the first coincident node is pushed, in world units. Small enough
 *  to be invisible, large enough that the repulsion term is finite. */
const NUDGE = 0.5;

/** Pairwise repulsion, applied to every pair once. The flat and deep loops
 *  are separate because this runs over every pair on every tick. */
export function charge(bodies: readonly ForceBody[], strength: number, three: boolean): SimulationForce<ForceBody> {
  const floor = MIN_CHARGE_DISTANCE * MIN_CHARGE_DISTANCE;
  if (three) {
    return (alpha) => {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i]!;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z! - a.z!;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 === 0) continue;
          const w = (strength * alpha) / Math.max(d2, floor);
          a.vx! += dx * w;
          a.vy! += dy * w;
          a.vz! += dz * w;
          b.vx! -= dx * w;
          b.vy! -= dy * w;
          b.vz! -= dz * w;
        }
      }
    };
  }
  return (alpha) => {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]!;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 === 0) continue;
        const w = (strength * alpha) / Math.max(d2, floor);
        a.vx! += dx * w;
        a.vy! += dy * w;
        b.vx! -= dx * w;
        b.vy! -= dy * w;
      }
    }
  };
}

/** A spring per edge, pulling both ends toward `distance`. */
export function links(
  bodies: ReadonlyMap<string, ForceBody>,
  graph: Graph,
  distance: number,
  strength: number,
  three: boolean,
): SimulationForce<ForceBody> {
  return (alpha) => {
    for (const edge of graph.edges) {
      const a = bodies.get(edge.from);
      const b = bodies.get(edge.to);
      if (a === undefined || b === undefined || a === b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = three ? b.z! - a.z! : 0;
      // `Math.hypot` with a trailing zero rounds differently from the two-term call.
      const d = dz === 0 ? Math.hypot(dx, dy) : Math.hypot(dx, dy, dz);
      if (d === 0) continue;
      const pull = ((d - distance) / d) * alpha * strength;
      a.vx! += dx * pull;
      a.vy! += dy * pull;
      b.vx! -= dx * pull;
      b.vy! -= dy * pull;
      if (dz !== 0) {
        a.vz! += dz * pull;
        b.vz! -= dz * pull;
      }
    }
  };
}

/**
 * Push overlapping boxes apart along whichever axis they overlap least.
 *
 * Charge alone is not enough: it treats a node as a point, so two wide boxes
 * whose centers are a comfortable distance apart still cover each other. Not
 * scaled by alpha — an overlap at the end of the run is exactly as wrong as
 * one at the start. In three dimensions a pair overlaps only where its depths
 * do too; a pair exactly level on z is separated across it, as in two.
 */
export function separateBoxes(bodies: readonly ForceBody[], padding: number, three: boolean): SimulationForce<ForceBody> {
  return three ? separateSolids(bodies, padding) : separateFlat(bodies, padding);
}

/** {@link separateBoxes} on the plane. Kept apart from {@link separateSolids}:
 *  a depth test in this loop, even one only overlapping pairs reach, cost a
 *  300-node run about a quarter of its time (2026-11-21). */
function separateFlat(bodies: readonly ForceBody[], padding: number): SimulationForce<ForceBody> {
  return () => {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]!;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const gapX = a.hw + b.hw + padding - Math.abs(dx);
        const gapY = a.hh + b.hh + padding - Math.abs(dy);
        if (gapX <= 0 || gapY <= 0) continue;
        pushAcross(a, b, dx, dy, gapX, gapY);
      }
    }
  };
}

/** {@link separateBoxes} in depth as well. */
function separateSolids(bodies: readonly ForceBody[], padding: number): SimulationForce<ForceBody> {
  return () => {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]!;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const gapX = a.hw + b.hw + padding - Math.abs(dx);
        const gapY = a.hh + b.hh + padding - Math.abs(dy);
        if (gapX <= 0 || gapY <= 0 || depthPush(a, b, padding, gapX, gapY)) continue;
        pushAcross(a, b, dx, dy, gapX, gapY);
      }
    }
  };
}

/** Push an overlapping pair apart across the plane, along the axis it overlaps least. */
function pushAcross(a: ForceBody, b: ForceBody, dx: number, dy: number, gapX: number, gapY: number): void {
  if (gapX < gapY) {
    const push = (Math.sign(dx) || 1) * gapX * 0.5;
    a.vx! -= push;
    b.vx! += push;
  } else {
    const push = (Math.sign(dy) || 1) * gapY * 0.5;
    a.vy! -= push;
    b.vy! += push;
  }
}

/** For a pair overlapping across the plane: whether it is clear in depth, or
 *  overlaps least in depth and has been pushed apart along it. */
function depthPush(a: ForceBody, b: ForceBody, padding: number, gapX: number, gapY: number): boolean {
  const dz = b.z! - a.z!;
  if (dz === 0) return false;
  const gapZ = a.hd + b.hd + padding - Math.abs(dz);
  if (gapZ <= 0) return true;
  if (gapZ >= gapX || gapZ >= gapY) return false;
  const push = Math.sign(dz) * gapZ * 0.5;
  a.vz! -= push;
  b.vz! += push;
  return true;
}

/** A pull toward the seed centroid, so a component with nothing to hold it
 *  does not drift off under pure repulsion. */
export function gravity(
  bodies: readonly ForceBody[],
  at: { x: number; y: number; z: number },
  strength: number,
  three: boolean,
): SimulationForce<ForceBody> {
  return (alpha) => {
    for (const body of bodies) {
      body.vx! += (at.x - body.x) * strength * alpha;
      body.vy! += (at.y - body.y) * strength * alpha;
      if (three) body.vz! += (at.z - body.z!) * strength * alpha;
    }
  };
}

/** Push coincident bodies apart, deterministically. Two nodes at exactly the
 *  same point feel no repulsion from each other and stay stacked forever. A
 *  pinned body is counted but never moved — a pin outranks this. The fan stays
 *  on the bodies' own level, so a flat arrangement stays flat. */
export function separate(bodies: ForceBody[], three: boolean): void {
  const seen = new Map<string, number>();
  bodies.forEach((body, i) => {
    const key = three ? `${body.x},${body.y},${body.z}` : `${body.x},${body.y}`;
    const nth = seen.get(key) ?? 0;
    seen.set(key, nth + 1);
    if (nth === 0 || body.fx != null || body.fy != null) return;
    const angle = GOLDEN * i;
    const radius = NUDGE * nth;
    body.x += Math.cos(angle) * radius;
    body.y += Math.sin(angle) * radius;
  });
}
