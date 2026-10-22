/**
 * The per-scene pick index: one BVH per scene layer over every node's broad
 * box (`nodeBroadBox`), rebuilt whole on the first query after anything it
 * read can have changed. Nodes it cannot box conservatively are on `always`
 * and are tested by every walk.
 */
import { createBvh, type Bvh } from '@weasel-js/geom/nd';
import { markerGeneration } from '@weasel-js/stroke';
import { inheritedPaintOf, inheritsPaint } from 'core/scene/inheritedPaint';
import { nodeMemoGeneration } from 'core/scene/nodeMemo';
import type { Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { scenePaintedPoseOf } from '../derivedPath';
import type { PickBroad, PickCandidate } from '../pickWalk';
import { sceneParentsOf, sceneShownPathOf } from '../scenePickReads';
import { nodeBroadBox, type Box2 } from './nodeBroadBox';

type AnyScene = Scene<unknown, string, unknown>;

export interface ScenePickIndex {
  /** The layers holding indexed nodes; `undefined` for nodes with none. */
  readonly layers: readonly (string | undefined)[];
  /** Ids per layer whose broad box meets `broad` (world, in that layer's own coordinates). */
  near(layer: string | undefined, broad: PickBroad, out: Set<string>): void;
  readonly always: ReadonlySet<string>;
  readonly maxOutsetPx: number;
  /** Position in `scene.renderOrderNodes()`, or -1 for an id it does not hold. */
  renderIndexOf(id: string): number;
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
  index: BuiltIndex;
}

const CACHE = new WeakMap<object, WeakMap<PoseDescriptor<unknown>, Cached>>();

class BuiltIndex implements ScenePickIndex {
  readonly layers: readonly (string | undefined)[];
  /** The render order `renderIndexOf` ranks into. */
  order: readonly PickCandidate<unknown>[] = [];
  private rank = new Map<string, number>();

  constructor(
    private readonly trees: Map<string | undefined, Bvh<string>>,
    readonly always: ReadonlySet<string>,
    readonly maxOutsetPx: number,
  ) {
    this.layers = [...trees.keys()];
  }

  near(layer: string | undefined, broad: PickBroad, out: Set<string>): void {
    const tree = this.trees.get(layer);
    if (tree === undefined) return;
    const { x, y, width, height } = broad.box;
    const k = broad.pxPerWorld;
    const by = this.maxOutsetPx > 0 && k !== undefined ? (k > 0 ? this.maxOutsetPx / k : Infinity) : 0;
    tree.queryBox([x - by, y - by, x + width + by, y + height + by], (id) => {
      out.add(id);
    });
  }

  renderIndexOf(id: string): number {
    return this.rank.get(id) ?? -1;
  }

  /** Re-rank when the scene hands back a new render order array. */
  rankBy(order: readonly PickCandidate<unknown>[]): void {
    if (order === this.order) return;
    this.order = order;
    this.rank = new Map();
    for (let i = 0; i < order.length; i++) this.rank.set(order[i].id, i);
  }
}

function hasCopyingAncestor(parents: readonly PickCandidate<unknown>[]): boolean {
  return parents.some((p) => p.kind === 'container' && typeof p.copiesFromPose === 'function');
}

function build(scene: AnyScene, descriptor: PoseDescriptor<unknown>): BuiltIndex {
  builds++;
  const order = scene.renderOrderNodes() as unknown as readonly PickCandidate<unknown>[];
  const poseOf = scenePaintedPoseOf(scene);
  const pathOf = sceneShownPathOf(scene);
  const parentsOf = sceneParentsOf(scene);
  const entries = new Map<string | undefined, [string, Box2][]>();
  const always = new Set<string>();
  let maxOutsetPx = 0;
  for (const node of order) {
    const parents = parentsOf(node);
    // Also hit wherever an ancestor paints a copy of it, which its own box does not cover.
    if (hasCopyingAncestor(parents)) {
      always.add(node.id);
      continue;
    }
    let found: ReturnType<typeof nodeBroadBox>;
    try {
      const inherited = inheritsPaint(node) ? inheritedPaintOf(node, parents) : undefined;
      found = nodeBroadBox(node, poseOf(node as never), pathOf(node), inherited, descriptor);
    } catch {
      always.add(node.id);
      continue;
    }
    if (!Number.isFinite(found.outsetPx) || !found.box.every(Number.isFinite)) {
      always.add(node.id);
      continue;
    }
    maxOutsetPx = Math.max(maxOutsetPx, found.outsetPx);
    let list = entries.get(node.layer);
    if (list === undefined) entries.set(node.layer, (list = []));
    list.push([node.id, found.box]);
  }
  const trees = new Map<string | undefined, Bvh<string>>();
  for (const [layer, list] of entries) {
    const tree = createBvh<string>(2, list);
    // The tree drops an inverted box: test that node the old way.
    if (tree.size !== list.length) {
      for (const [id, box] of list) if (!(box[0] <= box[2] && box[1] <= box[3])) always.add(id);
    }
    trees.set(layer, tree);
  }
  const index = new BuiltIndex(trees, always, maxOutsetPx);
  index.rankBy(order);
  return index;
}

/** The index for `scene` read through `descriptor`, current as of this call. */
export function scenePickIndex(scene: AnyScene, descriptor: PoseDescriptor<unknown>): ScenePickIndex {
  return current(scene, descriptor);
}

function current(scene: AnyScene, descriptor: PoseDescriptor<unknown>): BuiltIndex {
  const version = scene.getVersion();
  const overrides = scene.overrides.getGeneration();
  const memo = nodeMemoGeneration();
  const markers = markerGeneration();
  let perScene = CACHE.get(scene);
  if (perScene === undefined) CACHE.set(scene, (perScene = new WeakMap()));
  const hit = perScene.get(descriptor);
  if (hit && hit.version === version && hit.overrides === overrides && hit.memo === memo && hit.markers === markers) {
    hit.index.rankBy(scene.renderOrderNodes() as unknown as readonly PickCandidate<unknown>[]);
    return hit.index;
  }
  const index = build(scene, descriptor);
  perScene.set(descriptor, { version, overrides, memo, markers, index });
  return index;
}

/** What `PickSource.candidates` answers for a scene source with an index. */
export function indexedCandidates(
  scene: AnyScene,
  descriptor: PoseDescriptor<unknown>,
  broadFor: (layer: string | undefined) => PickBroad | null | undefined,
): readonly PickCandidate<unknown>[] | null {
  const index = current(scene, descriptor);
  const ids = new Set<string>(index.always);
  for (const layer of index.layers) {
    const broad = broadFor(layer);
    if (broad === null) continue;
    if (broad === undefined) return null;
    const { x, y, width, height } = broad.box;
    if (Number.isNaN(x + y + width + height)) return null;
    index.near(layer, broad, ids);
  }
  const ranks: number[] = [];
  for (const id of ids) {
    const i = index.renderIndexOf(id);
    if (i >= 0) ranks.push(i);
  }
  ranks.sort((a, b) => a - b);
  const order = index.order;
  return ranks.map((i) => order[i]);
}
