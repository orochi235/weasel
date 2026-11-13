/**
 * The 3D world's pick index: one BVH over every node's world box as shown,
 * rebuilt whole on the first pick after the scene, its overrides or the
 * world's `bounds` function can have changed. A node whose box the tree
 * refuses (non-finite or inverted) is tested on every pick, the way the scan
 * did; one that occupies nothing is never picked.
 */

import type { NodeId } from '@weasel-js/routing';
import { rectsOverlap } from '@weasel-js/geom';
import { intersectRayAabb, type Aabb, type Ray } from '@weasel-js/geom/3d';
import { createBvh, type Bvh, type HalfSpace } from '@weasel-js/geom/nd';
import { rectOf, viewProjectionOf, type Viewport3d } from './project';
import { projectAabbToScreen, screenToNdc, type ScreenBox } from './screen';
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
  inScreenRect(vp: Viewport3d, rect: ScreenBox, layerIsPainted?: LayerGate): NodeId[];
}

/** The screen box a node covers, or null when it projects to nothing visible. */
export function screenBoxOf<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  id: NodeId,
  viewport: Viewport3d,
): ScreenBox | null {
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
function sidePlanes(vp: Viewport3d, rect: ScreenBox): HalfSpace[] {
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

class BuiltIndex<TData, TLayer extends string> implements WorldPickIndex {
  constructor(
    private readonly order: readonly Node3d<TData, TLayer>[],
    private readonly boxes: readonly (Aabb | null)[],
    private readonly tree: Bvh<number>,
    private readonly always: readonly number[],
  ) {}

  nearestOnRay(
    ray: Ray, excluded: ReadonlySet<NodeId> | null, maxT = Infinity, layerIsPainted?: LayerGate,
  ): NodeId | null {
    const { order, boxes } = this;
    let best = -1;
    let bestT = Infinity;
    const consider = (i: number) => {
      const box = boxes[i]!;
      const node = order[i]!;
      if (excluded?.has(node.id) || layerIsPainted?.(node.layer) === false) return;
      const t = intersectRayAabb(ray, box);
      if (t !== null && t <= maxT && (t < bestT || (t === bestT && i < best))) {
        bestT = t;
        best = i;
      }
    };
    for (const i of this.always) consider(i);
    const { origin: o, direction: d } = ray;
    this.tree.raycast([o.x, o.y, o.z], [d.x, d.y, d.z], (i, entryT) => {
      // The tree's slab test rounds differently from intersectRayAabb's.
      if (entryT > bestT * (1 + 1e-12) + 1e-12) return false;
      consider(i);
      return true;
    });
    return best < 0 ? null : order[best]!.id;
  }

  inScreenRect(vp: Viewport3d, rect: ScreenBox, layerIsPainted?: LayerGate): NodeId[] {
    const candidates = [...this.always];
    this.tree.queryHalfSpaces(sidePlanes(vp, rect), (i) => {
      candidates.push(i);
    });
    candidates.sort((a, b) => a - b);
    const hits: NodeId[] = [];
    const m = viewProjectionOf(vp);
    const pane = rectOf(vp);
    for (const i of candidates) {
      if (layerIsPainted?.(this.order[i]!.layer) === false) continue;
      const box = projectAabbToScreen(this.boxes[i]!, m, pane);
      if (box && rectsOverlap(box, rect)) hits.push(this.order[i]!.id);
    }
    return hits;
  }
}

interface Cached {
  version: number;
  overrides: number;
  bounds: unknown;
  order: readonly unknown[];
  index: WorldPickIndex;
}

const CACHE = new WeakMap<object, Cached>();

function build<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  order: readonly Node3d<TData, TLayer>[],
): WorldPickIndex {
  const boxOf = worldBoxes(world, 'shown');
  const boxes = order.map(boxOf);
  const entries: [number, number[]][] = [];
  const always: number[] = [];
  boxes.forEach((b, i) => {
    if (b === null) return;
    if (boxIndexable(b)) entries.push([i, padQuery([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z])]);
    else always.push(i);
  });
  return new BuiltIndex(order, boxes, createBvh<number>(3, entries), always);
}

/** The index for `world`, current as of this call. */
export function worldPickIndex<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
): WorldPickIndex {
  const { scene } = world;
  const version = scene.getVersion();
  const overrides = scene.overrides.getGeneration();
  const order = scene.renderOrderNodes() as readonly Node3d<TData, TLayer>[];
  const hit = CACHE.get(world);
  if (
    hit && hit.version === version && hit.overrides === overrides &&
    hit.bounds === world.bounds && hit.order === order
  ) {
    return hit.index;
  }
  const index = build(world, order);
  CACHE.set(world, { version, overrides, bounds: world.bounds, order, index });
  return index;
}
