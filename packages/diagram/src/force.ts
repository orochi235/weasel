/**
 * `force` — relaxation, for a graph with no direction to read it in.
 *
 * Seeded from where the nodes already are rather than from a fresh random
 * scatter: an author who has arranged half a diagram gets that arrangement
 * relaxed, not replaced. There is no RNG in it at all — two coincident nodes
 * are separated along a golden-angle spiral keyed to their index, which is what
 * a random jiggle is for elsewhere.
 *
 * The integrator is the kit's own `createSimulation`, the same one
 * `useSimulation` runs a frame at a time. Only the forces are local, and they
 * are the naive O(n²) kind — right for the tens-to-hundreds of nodes an
 * edge-per-scene-node diagram is already sized for, wrong for a 10k-node graph,
 * which wants d3-force's Barnes–Hut through `useSimulation` and its own render
 * layer.
 *
 * **This is the one layout that is not idempotent.** A relaxation re-run from
 * its own output keeps relaxing; `direction` means nothing to it. Pins and the
 * `tolerance` option are what keep a second pass from scrambling a settled
 * diagram.
 */
import { createSimulation, type SimulationForce, type SimulationNode } from '@weasel-js/core';
import type { Graph } from './graph';
import {
  center,
  pinnedSet,
  translated,
  type LayoutFn,
  type LayoutOptions,
  type LayoutResult,
} from './layout';

export interface ForceOptions extends LayoutOptions {
  /** Ticks to run. Default 300 — one full cooling schedule. */
  iterations?: number;
  /** Rest length of an edge, in world units. Default 160. */
  linkDistance?: number;
  /** How hard an edge pulls, 0..1. Default 0.35. */
  linkStrength?: number;
  /** Pairwise repulsion. Negative repels; default -3000. */
  charge?: number;
  /** How hard the graph is held around its own centroid. Default 0.02. */
  gravity?: number;
  /** Clear space kept between two boxes, in world units. Default 24. */
  padding?: number;
}

interface Body extends SimulationNode {
  id: string;
  /** Half the node's box, so separation can work on the shape the author sees
   *  rather than on a point. */
  hw: number;
  hh: number;
}

const DEFAULTS = {
  iterations: 300,
  linkDistance: 160,
  linkStrength: 0.35,
  charge: -3000,
  gravity: 0.02,
  padding: 24,
} as const;

/** The golden angle. Coincident nodes fan out along it, which spreads any
 *  number of them without two landing on the same heading. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** How far the first coincident node is pushed, in world units. Small enough
 *  to be invisible, large enough that the repulsion term is finite. */
const NUDGE = 0.5;

/** Pairwise repulsion, applied to every pair once. */
function charge(bodies: readonly Body[], strength: number): SimulationForce<Body> {
  return (alpha) => {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]!;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 === 0) continue;
        const w = (strength * alpha) / d2;
        a.vx! += dx * w;
        a.vy! += dy * w;
        b.vx! -= dx * w;
        b.vy! -= dy * w;
      }
    }
  };
}

/** A spring per edge, pulling both ends toward `distance`. */
function links(
  bodies: ReadonlyMap<string, Body>,
  graph: Graph,
  distance: number,
  strength: number,
): SimulationForce<Body> {
  return (alpha) => {
    for (const edge of graph.edges) {
      const a = bodies.get(edge.from);
      const b = bodies.get(edge.to);
      if (a === undefined || b === undefined || a === b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d === 0) continue;
      const pull = ((d - distance) / d) * alpha * strength;
      a.vx! += dx * pull;
      a.vy! += dy * pull;
      b.vx! -= dx * pull;
      b.vy! -= dy * pull;
    }
  };
}

/**
 * Push overlapping boxes apart along whichever axis they overlap least.
 *
 * Charge alone is not enough: it treats a node as a point, so two wide boxes
 * whose centers are a comfortable distance apart still cover each other. This
 * works on the box, and it is not scaled by alpha — an overlap at the end of
 * the run is exactly as wrong as one at the start.
 */
function separateBoxes(bodies: readonly Body[], padding: number): SimulationForce<Body> {
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
    }
  };
}

/** A pull toward the seed centroid, so a component with nothing to hold it
 *  does not drift off under pure repulsion. */
function gravity(bodies: readonly Body[], at: { x: number; y: number }, strength: number): SimulationForce<Body> {
  return (alpha) => {
    for (const body of bodies) {
      body.vx! += (at.x - body.x) * strength * alpha;
      body.vy! += (at.y - body.y) * strength * alpha;
    }
  };
}

/**
 * The bodies and the force list, wound up and ready to tick.
 *
 * Shared by the one-shot `force` below and the live relaxation in `live.ts`,
 * which ticks it a frame at a time. Two copies of a force list drift, and the
 * only thing that would say so is the arrangement they produce.
 */
export interface ForceRelaxation {
  bodies: Body[];
  byId: Map<string, Body>;
  /** Ids the caller must not move: declared pins, held as `fx`/`fy`. */
  pinned: ReadonlySet<string>;
  sim: ReturnType<typeof createSimulation<Body>>;
  /** Where a body's node's top-left sits, given the body's center. */
  placed(): Map<string, { x: number; y: number }>;
}

export function forceRelaxation(graph: Graph, opts: ForceOptions = {}): ForceRelaxation {
  const {
    linkDistance = DEFAULTS.linkDistance,
    linkStrength = DEFAULTS.linkStrength,
    charge: chargeStrength = DEFAULTS.charge,
    gravity: gravityStrength = DEFAULTS.gravity,
    padding = DEFAULTS.padding,
  } = opts;

  const pinned = pinnedSet(graph, opts);
  const bodies: Body[] = graph.nodes.map((node) => {
    const body: Body = {
      id: node.id,
      x: center(node.bounds, 'x'),
      y: center(node.bounds, 'y'),
      hw: node.bounds.width / 2,
      hh: node.bounds.height / 2,
    };
    // A pin is the integrator's own `fx`/`fy`, not a filter applied after the
    // fact: a pinned node has to hold its neighbors while they relax, not be
    // put back once they have finished relaxing around where it wasn't.
    if (pinned.has(node.id)) {
      body.fx = body.x;
      body.fy = body.y;
    }
    return body;
  });
  separate(bodies);

  const byId = new Map(bodies.map((b) => [b.id, b]));
  const centroid = {
    x: bodies.reduce((sum, b) => sum + b.x, 0) / bodies.length,
    y: bodies.reduce((sum, b) => sum + b.y, 0) / bodies.length,
  };

  const sim = createSimulation<Body>({
    nodes: bodies,
    forces: [
      charge(bodies, chargeStrength),
      links(byId, graph, linkDistance, linkStrength),
      gravity(bodies, centroid, gravityStrength),
      separateBoxes(bodies, padding),
    ],
  });

  return {
    bodies,
    byId,
    pinned,
    sim,
    placed() {
      const placed = new Map<string, { x: number; y: number }>();
      for (const node of graph.nodes) {
        const body = byId.get(node.id)!;
        placed.set(node.id, {
          x: body.x - node.bounds.width / 2,
          y: body.y - node.bounds.height / 2,
        });
      }
      return placed;
    },
  };
}

export const force = (graph: Graph, opts: ForceOptions = {}): LayoutResult => {
  if (graph.nodes.length === 0) return new Map();
  const relaxation = forceRelaxation(graph, opts);
  relaxation.sim.tick(opts.iterations ?? DEFAULTS.iterations);
  return translated(graph, relaxation.placed(), relaxation.pinned, opts.tolerance);
};

/** `ForceOptions` only widens `LayoutOptions`, so this is a `LayoutFn` — but
 *  declaring it as one would hide the extra options from every caller. */
force satisfies LayoutFn;

/** Push coincident bodies apart, deterministically. Two nodes at exactly the
 *  same point feel no repulsion from each other and stay stacked forever. A
 *  pinned body is counted but never moved — a pin outranks this. */
function separate(bodies: Body[]): void {
  const seen = new Map<string, number>();
  bodies.forEach((body, i) => {
    const key = `${body.x},${body.y}`;
    const nth = seen.get(key) ?? 0;
    seen.set(key, nth + 1);
    if (nth === 0 || body.fx != null || body.fy != null) return;
    const angle = GOLDEN * i;
    const radius = NUDGE * nth;
    body.x += Math.cos(angle) * radius;
    body.y += Math.sin(angle) * radius;
  });
}
