/**
 * `force` — relaxation, for a graph with no direction to read it in.
 *
 * Seeded from where the nodes already are rather than from a fresh random
 * scatter: an author who has arranged half a diagram gets that arrangement
 * relaxed, not replaced. There is no RNG in it at all — two coincident nodes
 * are separated along a golden-angle spiral keyed to their index.
 *
 * The forces are the naive O(n²) kind — right for tens to hundreds of nodes,
 * wrong for a 10k-node graph.
 *
 * **This is the one layout that is not idempotent.** A relaxation re-run from
 * its own output keeps relaxing; `direction` means nothing to it. Pins and the
 * `tolerance` option are what keep a second pass from scrambling a settled
 * diagram.
 */
import { createSimulation, type SimulationNode } from '@weasel-js/simulation';
import type { Vec3 } from '@weasel-js/geom/3d';
import type { Graph } from './graph';
import { clusterCohesion, separateClusters } from './forceClusters';
import { charge, gravity, links, separate, separateBoxes } from './forceTerms';
import {
  center,
  pinnedSet,
  movesFrom,
  type LayoutFn,
  type LayoutOptions,
  type LayoutResult,
} from './layout';

/** Options for {@link force} and {@link createForceRelaxation}. `direction` is
 *  ignored. */
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
  /** How hard a cluster draws its members together, 0..1. Default 0.2. */
  clusterStrength?: number;
}

/** One node as the relaxation sees it: a simulation point centered on the
 *  node's box. */
export interface ForceBody extends SimulationNode {
  id: string;
  /** Half the node's box, so separation can work on the shape the author sees
   *  rather than on a point. */
  hw: number;
  hh: number;
  /** Half its depth: its `box3`'s along z in a run of three dimensions, else 0. */
  hd: number;
}

const DEFAULTS = {
  iterations: 300,
  linkDistance: 160,
  linkStrength: 0.35,
  charge: -3000,
  gravity: 0.02,
  padding: 24,
  clusterStrength: 0.2,
} as const;

/**
 * The bodies and the force list, wound up and ready to tick.
 */
export interface ForceRelaxation {
  bodies: ForceBody[];
  byId: Map<string, ForceBody>;
  /** Ids the caller must not move: declared pins, held as `fx`/`fy` (and `fz`). */
  pinned: ReadonlySet<string>;
  sim: ReturnType<typeof createSimulation<ForceBody>>;
  /** Where a body's node's top-left sits, given the body's center. */
  placed(): Map<string, { x: number; y: number }>;
  /** Where a body's node's low corner sits in three dimensions, given the
   *  body's center: `placed()` with z, which is 0 in a flat run. */
  placed3(): Map<string, Vec3>;
}

/**
 * Wind up a relaxation of `graph` without ticking it: bodies seeded from
 * where the nodes are, pins held fixed. Tick `sim` yourself and read the
 * top-lefts from `placed()`.
 *
 * With `dimensions` 3 it relaxes in depth as well, each body seeded on z from
 * its node's `box3` (a node without one is flat, at 0). x and y are seeded from
 * `bounds` either way, so a run of solids that all share one z lands each where
 * the flat run of their `bounds` does.
 */
export function createForceRelaxation(graph: Graph, opts: ForceOptions = {}, dimensions: 2 | 3 = 2): ForceRelaxation {
  const {
    linkDistance = DEFAULTS.linkDistance,
    linkStrength = DEFAULTS.linkStrength,
    charge: chargeStrength = DEFAULTS.charge,
    gravity: gravityStrength = DEFAULTS.gravity,
    padding = DEFAULTS.padding,
    clusterStrength = DEFAULTS.clusterStrength,
  } = opts;

  const three = dimensions === 3;
  const pinned = pinnedSet(graph, opts);
  const bodies: ForceBody[] = graph.nodes.map((node) => {
    const body: ForceBody = {
      id: node.id,
      x: center(node.bounds, 0),
      y: center(node.bounds, 1),
      hw: node.bounds.width / 2,
      hh: node.bounds.height / 2,
      hd: 0,
    };
    if (three) {
      const box = node.box3;
      body.z = box === undefined ? 0 : box.min.z + (box.max.z - box.min.z) / 2;
      body.hd = box === undefined ? 0 : (box.max.z - box.min.z) / 2;
    }
    // A pin is the integrator's own `fx`/`fy`, not a filter applied after the
    // fact: a pinned node has to hold its neighbors while they relax.
    if (pinned.has(node.id)) {
      body.fx = body.x;
      body.fy = body.y;
      if (three) body.fz = body.z;
    }
    return body;
  });
  separate(bodies, three);

  const byId = new Map(bodies.map((b) => [b.id, b]));
  const centroid = {
    x: bodies.reduce((sum, b) => sum + b.x, 0) / bodies.length,
    y: bodies.reduce((sum, b) => sum + b.y, 0) / bodies.length,
    z: three ? bodies.reduce((sum, b) => sum + b.z!, 0) / bodies.length : 0,
  };

  const clusters = graph.clusters ?? [];
  const sim = createSimulation<ForceBody>({
    nodes: bodies,
    dimensions,
    forces: [
      charge(bodies, chargeStrength, three),
      links(byId, graph, linkDistance, linkStrength, three),
      gravity(bodies, centroid, gravityStrength, three),
      separateBoxes(bodies, padding, three),
      ...(clusters.length > 0
        ? [clusterCohesion(clusters, byId, clusterStrength, three), separateClusters(clusters, bodies, byId, padding, three)]
        : []),
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
    placed3() {
      const placed = new Map<string, Vec3>();
      for (const node of graph.nodes) {
        const body = byId.get(node.id)!;
        placed.set(node.id, {
          x: body.x - node.bounds.width / 2,
          y: body.y - node.bounds.height / 2,
          z: (body.z ?? 0) - body.hd,
        });
      }
      return placed;
    },
  };
}

/** The force-directed layout. Unlike the others it is not idempotent: a
 *  re-run keeps relaxing, so pins and `tolerance` are what hold a settled
 *  diagram still. */
export const force = (graph: Graph, opts: ForceOptions = {}): LayoutResult => {
  if (graph.nodes.length === 0) return new Map();
  const relaxation = createForceRelaxation(graph, opts);
  relaxation.sim.tick(opts.iterations ?? DEFAULTS.iterations);
  return movesFrom(graph, relaxation.placed(), relaxation.pinned, opts.tolerance);
};

/** `ForceOptions` only widens `LayoutOptions`, so this is a `LayoutFn` — but
 *  declaring it as one would hide the extra options from every caller. */
force satisfies LayoutFn;
