/**
 * The 3D world's pick index: core's reach tree over every node's world box as
 * shown, in three dimensions, updated from the scene's touched-ids feed and
 * built whole again only when the feed cannot say what changed or the world
 * takes a new `bounds` function. A node whose box the tree refuses
 * (non-finite or inverted) is tested on every pick, the way the scan did; one
 * that occupies nothing is never picked.
 */

import type { NodeId } from '@weasel-js/routing';
import { rectsOverlap } from '@weasel-js/geom';
import { intersectRayAabb, type Aabb, type Ray } from '@weasel-js/geom/3d';
import type { HalfSpace } from '@weasel-js/geom/nd';
import {
  BOX_ALL, BOX_NONE, BOX_SOME, createReachTree, type ReachQuery, type ReachRay, type ReachSource, type ReachTree,
} from '@weasel-js/core';
import { rectOf, viewProjectionOf, type Viewport3d } from './project';
import { projectAabbToScreen, screenToNdc, type ScreenRect } from './screen';
import { padQuery } from './snap/boxIndex';
import { boxAt, boxIndexable, inWorld, worldBoxes, worldPoseOf, type Node3d, type World3d } from './world';

/** Whether the asking view draws `layer`. */
type LayerGate = (layer: string) => boolean;

export interface WorldPickIndex {
  /** The nearest node the ray enters no further along it than `maxT`; a tie on
   *  distance goes to the first in render order. `layerIsPainted`, the asking
   *  view's layer gate, passes over the nodes of a layer it does not draw. */
  nearestOnRay(
    ray: Ray, excluded: ReadonlySet<NodeId> | null, maxT?: number, layerIsPainted?: LayerGate,
  ): NodeId | null;
  /** The nodes whose projected box overlaps `rect`, in render order, less any
   *  on a layer `layerIsPainted` says the asking view does not draw. */
  inScreenRect(vp: Viewport3d, rect: ScreenRect, layerIsPainted?: LayerGate): NodeId[];
}

/** The screen box a node covers, or null when it projects to nothing visible. */
export function screenBoxOf<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  id: NodeId,
  viewport: Viewport3d,
): ScreenRect | null {
  const node = world.scene.get(id) as Node3d<TData, TLayer> | undefined;
  const pose = node && worldPoseOf(world.scene, id);
  const box = node && pose && boxAt(world, node, pose);
  const vp = inWorld(world, viewport);
  return box ? projectAabbToScreen(box, viewProjectionOf(vp), rectOf(vp)) : null;
}

/** Widens each side plane, in NDC, past the rounding between it and the exact screen test. */
const NDC_SLACK = 1e-9;

/**
 * The four half-spaces a point must sit in for its screen point to fall in
 * `rect`'s columns and rows: `ndc.x >= a` is `clip.x - a * clip.w >= 0`
 * wherever `clip.w > 0`, which is linear in the world point. Each plane is
 * kept or dropped on its own, so a box survives exactly when its projection's
 * x span and y span each reach the rect — what the screen-box test asks —
 * and points behind the eye only ever add candidates.
 */
function sidePlanes(vp: Viewport3d, rect: ScreenRect): HalfSpace[] {
  const m = viewProjectionOf(vp);
  const pane = rectOf(vp);
  const lo = screenToNdc({ x: rect.x, y: rect.y + rect.height }, pane);
  const hi = screenToNdc({ x: rect.x + rect.width, y: rect.y }, pane);
  // Column-major: row r of the matrix is m[r], m[4 + r], m[8 + r], m[12 + r].
  const row = (r: number) => [m[r]!, m[4 + r]!, m[8 + r]!, m[12 + r]!];
  const w = row(3);
  const plane = (r: number, a: number, sign: 1 | -1): HalfSpace => {
    const c = row(r);
    const e = [0, 1, 2, 3].map((j) => sign * (c[j]! - a * w[j]!));
    return { normal: [e[0]!, e[1]!, e[2]!], offset: e[3]! };
  };
  return [
    plane(0, lo.x - NDC_SLACK, 1),
    plane(0, hi.x + NDC_SLACK, -1),
    plane(1, lo.y - NDC_SLACK, 1),
    plane(1, hi.y + NDC_SLACK, -1),
  ];
}

/** Every node is tag 1: a layer gate is the caller's, applied to each hit. */
const EVERY = 1;

class WorldIndex<TData, TLayer extends string> implements WorldPickIndex {
  /** Each node's exact box as shown, read when the tree last boxed it; the tree's own is padded. */
  private readonly exact = new Map<string, Aabb | null>();
  readonly tree: ReachTree;
  private rank: { order: readonly unknown[]; of: Map<string, number> } | null = null;

  constructor(private readonly world: World3d<TData, TLayer>) {
    this.tree = createReachTree(this.source());
  }

  private source(): ReachSource {
    const { scene } = this.world;
    const boxOf = worldBoxes(this.world, 'shown');
    return {
      dim: 3,
      changesSince: (token) => {
        const changed = scene.changesSince(token);
        // The tree boxes every node afresh after this answer.
        if (token === undefined || changed.ids === 'unknown') this.exact.clear();
        return changed;
      },
      childrenOf: (id) => (id === null ? scene.roots : scene.get(id as NodeId)?.children ?? []),
      parentOf: (id) => {
        const node = scene.get(id as NodeId);
        if (node === undefined) this.exact.delete(id);
        return node === undefined ? undefined : node.parent;
      },
      ownBox: (id, out, at) => {
        const node = scene.get(id as NodeId) as Node3d<TData, TLayer> | undefined;
        const b = node ? boxOf(node) : null;
        this.exact.set(id, b);
        if (b === null) return BOX_NONE;
        if (!boxIndexable(b)) return BOX_ALL;
        out.set(padQuery([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]), at);
        return BOX_SOME;
      },
      tagsOf: () => EVERY,
    };
  }

  private rankOf(id: string): number {
    const order = this.world.scene.renderOrderNodes();
    if (this.rank?.order !== order) this.rank = { order, of: new Map(order.map((n, i) => [n.id as string, i])) };
    return this.rank.of.get(id) ?? Number.MAX_SAFE_INTEGER;
  }

  nearestOnRay(
    ray: Ray, excluded: ReadonlySet<NodeId> | null, maxT = Infinity, layerIsPainted?: LayerGate,
  ): NodeId | null {
    const { origin: o, direction: d } = ray;
    const probe: ReachRay = { origin: [o.x, o.y, o.z], dir: [d.x, d.y, d.z], tMax: maxT * (1 + 1e-12) + 1e-12 };
    let best: string | null = null;
    let bestRank = Infinity;
    let bestT = Infinity;
    const q: ReachQuery = { wanted: EVERY, regions: [undefined, { ray: probe }] };
    this.tree.collect(q, (id) => {
      const box = this.exact.get(id);
      const node = this.world.scene.get(id as NodeId);
      if (!box || !node || excluded?.has(id as NodeId) || layerIsPainted?.(node.layer) === false) return;
      const t = intersectRayAabb(ray, box);
      if (t === null || t > maxT || t > bestT) return;
      const rank = this.rankOf(id);
      if (t < bestT || rank < bestRank) {
        best = id;
        bestT = t;
        bestRank = rank;
        // The tree's slab test rounds differently from intersectRayAabb's.
        if (boxIndexable(box)) probe.tMax = bestT * (1 + 1e-12) + 1e-12;
      }
    });
    return best;
  }

  inScreenRect(vp: Viewport3d, rect: ScreenRect, layerIsPainted?: LayerGate): NodeId[] {
    const found: string[] = [];
    this.tree.collect({ wanted: EVERY, regions: [undefined, { planes: sidePlanes(vp, rect) }] }, (id) => {
      found.push(id);
    });
    const m = viewProjectionOf(vp);
    const pane = rectOf(vp);
    const hits: { id: NodeId; rank: number }[] = [];
    for (const id of found) {
      const node = this.world.scene.get(id as NodeId);
      const box = this.exact.get(id);
      if (!node || !box || layerIsPainted?.(node.layer) === false) continue;
      const screen = projectAabbToScreen(box, m, pane);
      if (screen && rectsOverlap(screen, rect)) hits.push({ id: id as NodeId, rank: this.rankOf(id) });
    }
    hits.sort((a, b) => a.rank - b.rank);
    return hits.map((h) => h.id);
  }
}

const CACHE = new WeakMap<object, { bounds: unknown; index: WorldIndex<never, never> }>();

/** The index for `world`, current as of this call. */
export function worldPickIndex<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
): WorldPickIndex {
  let hit = CACHE.get(world) as { bounds: unknown; index: WorldIndex<TData, TLayer> } | undefined;
  if (hit === undefined || hit.bounds !== world.bounds) {
    hit = { bounds: world.bounds, index: new WorldIndex(world) };
    CACHE.set(world, hit as never);
  }
  hit.index.tree.ensure();
  return hit.index;
}
