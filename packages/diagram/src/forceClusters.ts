/**
 * What a cluster adds to the relaxation in `force.ts`: its members drawn
 * together, and its box kept clear of everything that is not in it.
 *
 * A cluster is its members and nothing else here — the box is recomputed from
 * where they are on every tick, the way the scene derives it: around its own
 * nodes and the boxes of the clusters nested in it. In a run of three
 * dimensions the box has a depth too, the span of its members' (an inset is
 * drawn on the plane, so it adds none).
 */
import type { SimulationForce } from '@weasel-js/simulation';
import type { GraphCluster } from './graph';
import type { ForceBody } from './force';

interface ClusterBodies {
  /** Every body inside, through any nested cluster. */
  members: ForceBody[];
  cluster: GraphCluster;
  parent?: ClusterBodies;
  children: ClusterBodies[];
}

interface Box { x0: number; y0: number; x1: number; y1: number }

/** A box's reach in depth: `z0` to `z1`, and `c0` to `c1` the z of the centers
 *  inside, which say whether it is level. Kept off {@link Box} so a flat run
 *  pays nothing for it. */
interface Depth { z0: number; z1: number; c0: number; c1: number }

function resolve(clusters: readonly GraphCluster[], byId: ReadonlyMap<string, ForceBody>): ClusterBodies[] {
  const out: ClusterBodies[] = [];
  for (const cluster of clusters) {
    const members = cluster.members.map((id) => byId.get(id)).filter((b) => b !== undefined);
    if (members.length > 0) out.push({ members, cluster, children: [] });
  }
  const byCluster = new Map(out.map((g) => [g.cluster.id, g]));
  for (const g of out) {
    const parent = g.cluster.parent === undefined ? undefined : byCluster.get(g.cluster.parent);
    if (parent === undefined) continue;
    g.parent = parent;
    parent.children.push(g);
  }
  return out;
}

/** A pull on each member toward its cluster's centroid. */
export function clusterCohesion(
  clusters: readonly GraphCluster[],
  byId: ReadonlyMap<string, ForceBody>,
  strength: number,
  three = false,
): SimulationForce<ForceBody> {
  const resolved = resolve(clusters, byId);
  return (alpha) => {
    for (const { members } of resolved) {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const m of members) {
        cx += m.x;
        cy += m.y;
        if (three) cz += m.z!;
      }
      cx /= members.length;
      cy /= members.length;
      cz /= members.length;
      for (const m of members) {
        m.vx! += (cx - m.x) * strength * alpha;
        m.vy! += (cy - m.y) * strength * alpha;
        if (three) m.vz! += (cz - m.z!) * strength * alpha;
      }
    }
  };
}

/** The box of `g`: around its bodies and its nested clusters' boxes, grown by
 *  its inset. A body inside a nested cluster is covered by that cluster's box. */
function boxOf(g: ClusterBodies): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of g.members) {
    x0 = Math.min(x0, m.x - m.hw);
    y0 = Math.min(y0, m.y - m.hh);
    x1 = Math.max(x1, m.x + m.hw);
    y1 = Math.max(y1, m.y + m.hh);
  }
  for (const child of g.children) {
    const b = boxOf(child);
    x0 = Math.min(x0, b.x0);
    y0 = Math.min(y0, b.y0);
    x1 = Math.max(x1, b.x1);
    y1 = Math.max(y1, b.y1);
  }
  const { inset } = g.cluster;
  return { x0: x0 - inset.left, y0: y0 - inset.top, x1: x1 + inset.right, y1: y1 + inset.bottom };
}

/** The depth of `g`'s box: every body inside spans it, through nested clusters too. */
function depthOf(g: ClusterBodies): Depth {
  const d: Depth = { z0: Infinity, z1: -Infinity, c0: Infinity, c1: -Infinity };
  for (const m of g.members) {
    d.z0 = Math.min(d.z0, m.z! - m.hd);
    d.z1 = Math.max(d.z1, m.z! + m.hd);
    d.c0 = Math.min(d.c0, m.z!);
    d.c1 = Math.max(d.c1, m.z!);
  }
  return d;
}

/** The depth of one body. */
function bodyDepth(m: ForceBody): Depth {
  return { z0: m.z! - m.hd, z1: m.z! + m.hd, c0: m.z!, c1: m.z! };
}

interface Push { x: number; y: number; z: number }

/** How far `b` has to move to clear `a` by `padding` on the plane, along
 *  whichever axis is shorter, or `null` when they are already clear. */
function clearance(a: Box, b: Box, padding: number): Push | null {
  const dx = (b.x0 + b.x1) - (a.x0 + a.x1);
  const dy = (b.y0 + b.y1) - (a.y0 + a.y1);
  // From the centers, so a box inside the other is pushed past its far edge, not by its own width.
  const gapX = (a.x1 - a.x0 + b.x1 - b.x0 - Math.abs(dx)) / 2 + padding;
  const gapY = (a.y1 - a.y0 + b.y1 - b.y0 - Math.abs(dy)) / 2 + padding;
  if (gapX <= 0 || gapY <= 0) return null;
  return gapX < gapY
    ? { x: (Math.sign(dx) || 1) * gapX, y: 0, z: 0 }
    : { x: 0, y: (Math.sign(dy) || 1) * gapY, z: 0 };
}

/**
 * `push`, the plane's {@link clearance} of two boxes, with their depths taken
 * in: `null` when they are clear in depth, and a push along z when they
 * overlap least there. Two boxes whose bodies are all exactly level on z are
 * cleared across it, as on the plane. Apart from `clearance` so the flat run's
 * loop stays small enough to inline it.
 */
function inDepth(push: Push, a: Depth, b: Depth, padding: number): Push | null {
  if (a.c0 === a.c1 && b.c0 === b.c1 && a.c0 === b.c0) return push;
  const dz = (b.c0 + b.c1) - (a.c0 + a.c1);
  const gapZ = (a.z1 - a.z0 + b.z1 - b.z0 - Math.abs(dz)) / 2 + padding;
  if (gapZ <= 0) return null;
  return gapZ < Math.abs(push.x + push.y) ? { x: 0, y: 0, z: (Math.sign(dz) || 1) * gapZ } : push;
}

/** Whether `inner` is nested somewhere inside `outer`. */
function holds(outer: ClusterBodies, inner: ClusterBodies): boolean {
  for (let at = inner.parent; at !== undefined; at = at.parent) {
    if (at === outer) return true;
  }
  return false;
}

function shove(bodies: readonly ForceBody[], x: number, y: number, z: number): void {
  for (const body of bodies) shoveOne(body, x, y, z);
}

function shoveOne(body: ForceBody, x: number, y: number, z: number): void {
  body.vx! += x;
  body.vy! += y;
  if (z !== 0) body.vz! += z;
}

/**
 * Push a cluster's box clear of every other cluster's and of every body outside
 * it, moving the cluster as a block. Like the box separation between nodes it is
 * not scaled by alpha: an overlap at the end of the run is as wrong as one at
 * the start.
 */
export function separateClusters(
  clusters: readonly GraphCluster[],
  bodies: readonly ForceBody[],
  byId: ReadonlyMap<string, ForceBody>,
  padding: number,
  three = false,
): SimulationForce<ForceBody> {
  const resolved = resolve(clusters, byId);
  const memberSets = resolved.map((g) => new Set(g.members));
  return () => {
    const boxes = resolved.map(boxOf);
    const depths = three ? resolved.map(depthOf) : undefined;
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        if (holds(resolved[i]!, resolved[j]!) || holds(resolved[j]!, resolved[i]!)) continue;
        let push = clearance(boxes[i]!, boxes[j]!, padding);
        if (push !== null && depths !== undefined) push = inDepth(push, depths[i]!, depths[j]!, padding);
        if (push === null) continue;
        shove(resolved[i]!.members, -push.x / 2, -push.y / 2, -push.z / 2);
        shove(resolved[j]!.members, push.x / 2, push.y / 2, push.z / 2);
      }
      for (const body of bodies) {
        if (memberSets[i]!.has(body)) continue;
        const box = { x0: body.x - body.hw, y0: body.y - body.hh, x1: body.x + body.hw, y1: body.y + body.hh };
        let push = clearance(boxes[i]!, box, padding);
        if (push !== null && depths !== undefined) push = inDepth(push, depths[i]!, bodyDepth(body), padding);
        if (push === null) continue;
        shove(resolved[i]!.members, -push.x / 2, -push.y / 2, -push.z / 2);
        shoveOne(body, push.x / 2, push.y / 2, push.z / 2);
      }
    }
  };
}
