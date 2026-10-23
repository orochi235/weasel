/**
 * The per-scene pick index: one BVH per scene layer over every node's broad
 * box (`nodeBroadBox`), keyed by the node's place in the render order it was
 * built from. A pick after anything it read can have changed walks the scene
 * and only records that state; the next pick to find the scene unchanged
 * builds, so a scene edited before every pick never pays for a build. Nodes it
 * cannot box conservatively are on `always` and are tested by every walk.
 */
import { createBvh, type Bvh } from '@weasel-js/geom/nd';
import { markerGeneration } from '@weasel-js/stroke';
import { getNodeShapes } from 'canvas/NodeShape';
import { inheritedPaintOf, inheritsPaint } from 'core/scene/inheritedPaint';
import { nodeMemoGeneration } from 'core/scene/nodeMemo';
import type { Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { scenePaintedPoseOf } from '../derivedPath';
import type { PickBroad, PickCandidate } from '../pickWalk';
import { sceneParentsOf, sceneShownPathOf } from '../scenePickReads';
import { nodeBroadBox, type Box2 } from './nodeBroadBox';

type AnyScene = Scene<unknown, string, unknown>;
type Order = readonly PickCandidate<unknown>[];

export interface ScenePickIndex {
  /** The layers holding indexed nodes; `undefined` for nodes with none. */
  readonly layers: readonly (string | undefined)[];
  readonly maxOutsetPx: number;
}

let builds = 0;

/** How many indexes have been built, for tests that pin when one rebuilds. */
export function pickIndexBuildCount(): number {
  return builds;
}

interface Cached {
  version: number;
  overrides: number;
  memo: number;
  markers: number;
  /** Null until a second pick finds the same state. */
  index: BuiltIndex | null;
}

const CACHE = new WeakMap<object, WeakMap<PoseDescriptor<unknown>, Cached>>();

/** Past this share of the scene the index costs more than the walk it narrows. */
const MAX_SHARE = 0.5;

class BuiltIndex implements ScenePickIndex {
  readonly layers: readonly (string | undefined)[];
  /** The render order the candidates are read out of. */
  private order: Order;
  /** Build position to position in `order`, or null while they are the same array. */
  private remap: Int32Array | null = null;
  private readonly marks: Uint8Array;
  private found: Int32Array;

  constructor(
    private readonly built: Order,
    private readonly trees: Map<string | undefined, Bvh<number>>,
    private readonly always: Int32Array,
    readonly maxOutsetPx: number,
  ) {
    this.layers = [...trees.keys()];
    this.order = built;
    this.marks = new Uint8Array(built.length);
    this.found = new Int32Array(Math.max(16, always.length));
  }

  /** Follow a new render order array the scene hands back for the same state. */
  rankBy(order: Order): void {
    if (order === this.order) return;
    this.order = order;
    if (order === this.built) {
      this.remap = null;
      return;
    }
    const rank = new Map<string, number>();
    for (let i = 0; i < order.length; i++) rank.set(order[i].id, i);
    const remap = new Int32Array(this.built.length);
    for (let i = 0; i < remap.length; i++) remap[i] = rank.get(this.built[i].id) ?? -1;
    this.remap = remap;
  }

  /** The nodes the boxes reach, in render order, or null when that is most of the scene. */
  candidates(broads: readonly (PickBroad | null)[]): Order | null {
    const limit = Math.floor(this.order.length * MAX_SHARE);
    let count = 0;
    const add = (built: number): boolean => {
      const at = this.remap === null ? built : this.remap[built];
      if (at < 0) return true;
      if (count === this.found.length) {
        const next = new Int32Array(count * 2);
        next.set(this.found);
        this.found = next;
      }
      this.found[count++] = at;
      return count <= limit;
    };
    for (const i of this.always) if (!add(i)) return null;
    for (let l = 0; l < this.layers.length; l++) {
      const broad = broads[l];
      const tree = this.trees.get(this.layers[l]);
      if (broad === null || tree === undefined) continue;
      const { x, y, width, height } = broad.box;
      const k = broad.pxPerWorld;
      const by = this.maxOutsetPx > 0 && k !== undefined ? (k > 0 ? this.maxOutsetPx / k : Infinity) : 0;
      let over = false;
      tree.queryBox([x - by, y - by, x + width + by, y + height + by], (i) => {
        if (add(i)) return true;
        over = true;
        return false;
      });
      if (over) return null;
    }
    return this.readOut(count);
  }

  private readOut(count: number): Order {
    const { order, found } = this;
    const out: PickCandidate<unknown>[] = new Array(count);
    // A handful sorts faster than a pass over every mark.
    if (count * 32 < order.length) {
      const ranks = found.subarray(0, count).sort();
      for (let i = 0; i < count; i++) out[i] = order[ranks[i]];
      return out;
    }
    const marks = this.marks.length >= order.length ? this.marks : new Uint8Array(order.length);
    for (let i = 0; i < count; i++) marks[found[i]] = 1;
    let n = 0;
    for (let i = 0; n < count && i < order.length; i++) {
      if (marks[i] === 0) continue;
      marks[i] = 0;
      out[n++] = order[i];
    }
    return out;
  }
}

function hasCopyingAncestor(parents: Order): boolean {
  return parents.some((p) => p.kind === 'group' && typeof p.copiesFromPose === 'function');
}

function build(scene: AnyScene, descriptor: PoseDescriptor<unknown>, order: Order): BuiltIndex {
  builds++;
  const poseOf = scenePaintedPoseOf(scene);
  const pathOf = sceneShownPathOf(scene);
  const parentsOf = sceneParentsOf(scene);
  const entries = new Map<string | undefined, [number, Box2][]>();
  const always: number[] = [];
  let maxOutsetPx = 0;
  for (let i = 0; i < order.length; i++) {
    const node = order[i];
    const parents = parentsOf(node);
    // Also hit wherever an ancestor paints a copy of it, which its own box does not cover.
    if (hasCopyingAncestor(parents)) {
      always.push(i);
      continue;
    }
    const box: Box2 = [0, 0, 0, 0];
    let outsetPx: number;
    try {
      const inherited = inheritsPaint(node) ? inheritedPaintOf(node, parents) : undefined;
      outsetPx = nodeBroadBox(node, poseOf(node as never), pathOf(node), inherited, descriptor, box);
    } catch {
      always.push(i);
      continue;
    }
    if (!Number.isFinite(outsetPx) || !box.every(Number.isFinite)) {
      always.push(i);
      continue;
    }
    if (outsetPx > maxOutsetPx) maxOutsetPx = outsetPx;
    let list = entries.get(node.layer);
    if (list === undefined) entries.set(node.layer, (list = []));
    list.push([i, box]);
  }
  const trees = new Map<string | undefined, Bvh<number>>();
  for (const [layer, list] of entries) {
    const tree = createBvh<number>(2, list);
    // The tree drops an inverted box: test that node the old way.
    if (tree.size !== list.length) {
      for (const [i, box] of list) if (!(box[0] <= box[2] && box[1] <= box[3])) always.push(i);
    }
    trees.set(layer, tree);
  }
  return new BuiltIndex(order, trees, Int32Array.from(always), maxOutsetPx);
}

/** The index for `scene` read through `descriptor`, or null when this pick walks instead. */
export function scenePickIndex(scene: AnyScene, descriptor: PoseDescriptor<unknown>): ScenePickIndex | null {
  return current(scene, descriptor);
}

function current(scene: AnyScene, descriptor: PoseDescriptor<unknown>): BuiltIndex | null {
  // Registers the built-in painters first, which bumps the memo generation.
  getNodeShapes();
  const version = scene.getVersion();
  const overrides = scene.overrides.getGeneration();
  const memo = nodeMemoGeneration();
  const markers = markerGeneration();
  let perScene = CACHE.get(scene);
  if (perScene === undefined) CACHE.set(scene, (perScene = new WeakMap()));
  const hit = perScene.get(descriptor);
  const order = scene.renderOrderNodes() as unknown as Order;
  if (hit && hit.version === version && hit.overrides === overrides && hit.memo === memo && hit.markers === markers) {
    if (hit.index === null) hit.index = build(scene, descriptor, order);
    else hit.index.rankBy(order);
    return hit.index;
  }
  perScene.set(descriptor, { version, overrides, memo, markers, index: null });
  return null;
}

/** What `PickSource.candidates` answers for a scene source with an index. */
export function indexedCandidates(
  scene: AnyScene,
  descriptor: PoseDescriptor<unknown>,
  broadFor: (layer: string | undefined) => PickBroad | null | undefined,
): Order | null {
  const index = current(scene, descriptor);
  if (index === null) return null;
  const broads: (PickBroad | null)[] = [];
  for (const layer of index.layers) {
    const broad = broadFor(layer);
    if (broad === undefined) return null;
    if (broad !== null && Number.isNaN(broad.box.x + broad.box.y + broad.box.width + broad.box.height)) return null;
    broads.push(broad);
  }
  return index.candidates(broads);
}
