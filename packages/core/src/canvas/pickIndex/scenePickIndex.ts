/**
 * The per-scene pick index: a reach tree over every node's broad box
 * (`nodeBroadBox`), tagged by layer, updated from the scene's touched-ids
 * feed. The first pick after a change the feed cannot name walks the scene
 * and only records that state; the next pick to find the scene unchanged
 * builds, so a scene changed that way before every pick never pays for a
 * build, while one edited by ops keeps its index and updates the nodes edited.
 * Nodes it cannot box conservatively hold everything and meet every query.
 */
import { createPart } from '@weasel-js/registry';
import { nodeShapesOf } from 'canvas/nodeShapeRegistry';
import { createSettledCache, type SettledCache } from '@weasel-js/geom/nd';
import { markerGeneration } from '@weasel-js/stroke';
import { nodeShapeEntries } from 'canvas/NodeShape';
import { inheritedPaintOf, inheritsPaint } from 'core/scene/inheritedPaint';
import { nodeAsShown, nodesAsShown } from 'core/scene/nodeAsShown';
import { nodeMemoGeneration } from 'core/scene/nodeMemo';
import { outsideGeneration } from 'core/scene/outsideReads';
import { renderRanksOf } from 'core/scene/renderRank';
import { asNodeId } from 'core/scene/types';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { scenePaintedPoseOf } from '../derivedPath';
import type { PickBroad, PickCandidate } from '../pickWalk';
import { sceneParentsOf, sceneShownPathOf } from '../scenePickReads';
import { createReachTree, type ReachTree } from '../reach/reachTree';
import { BOX_ALL, BOX_NONE, BOX_SOME, type ReachRegion, type ReachSource } from '../reach/reachTypes';
import { nodeBroadBox, type Box2 } from './nodeBroadBox';
import type { AnyScene } from 'core/scene/anyScene';

type Order = readonly PickCandidate<unknown>[];

export interface ScenePickIndex {
  /** The layers holding indexed nodes. */
  readonly layers: readonly (string | undefined)[];
  readonly maxOutsetPx: number;
}

let builds = 0;

/** How many indexes have been built from a whole scene, for tests that pin when one rebuilds. */
export function pickIndexBuildCount(): number {
  return builds;
}

/** Layers past this share one tag, which meets everywhere. */
const TAG_BITS = 30;

/** Past this share of the scene the index costs more than the walk it narrows. */
const MAX_SHARE = 0.5;

function hasCopyingAncestor(parents: Order): boolean {
  return parents.some((p) => typeof p.copiesFromPose === 'function');
}

class PickIndex implements ScenePickIndex {
  /** The largest screen-pixel reach any node's ink has had; it only grows, which only adds candidates. */
  maxOutsetPx = 0;
  private tree: ReachTree | null = null;
  private readonly settle: SettledCache<true> = createSettledCache();
  private bits: { layers: readonly unknown[]; of: Map<string, number> } | null = null;

  constructor(private readonly scene: AnyScene, private readonly descriptor: PoseDescriptor<unknown>) {}

  get layers(): readonly string[] {
    return this.scene.layers.map((l) => l.id);
  }

  tagOf(layer: string): number {
    const { layers } = this.scene;
    if (this.bits?.layers !== layers) this.bits = { layers, of: new Map(layers.map((l, i) => [l.id, Math.min(i, TAG_BITS)])) };
    return this.bits.of.get(layer) ?? TAG_BITS;
  }

  /** The tree, current; null while the scene has not held still since a change the feed could not name. */
  current(): ReachTree | null {
    if (this.tree !== null) {
      if (this.tree.ensure(false)) return this.tree;
      this.tree = null;
      this.settle.clear();
    }
    const { scene } = this;
    const key = [
      scene.getVersion(), scene.overrides.getGeneration(), scene.scroll?.getGeneration() ?? 0,
      nodeMemoGeneration(), markerGeneration(), outsideGeneration(),
    ];
    if (this.settle.read(key, () => true) === null) return null;
    builds++;
    const tree = createReachTree(this.source());
    tree.ensure();
    this.tree = tree;
    return tree;
  }

  private source(): ReachSource {
    const { scene, descriptor } = this;
    const poseOf = scenePaintedPoseOf(scene);
    const pathOf = sceneShownPathOf(scene);
    const parentsOf = sceneParentsOf(scene);
    const shapes = nodeShapesOf(scene);
    const box: Box2 = [0, 0, 0, 0];
    let markers = markerGeneration();
    return {
      dim: 2,
      changesSince: (token) => {
        const changed = scene.changesSince(token);
        if (markerGeneration() === markers) return changed;
        markers = markerGeneration();
        return { ...changed, ids: 'unknown', parents: new Set(), structural: true };
      },
      childrenOf: (id) => (id === null ? scene.roots : scene.get(asNodeId(id))?.children ?? []),
      parentOf: (id) => {
        const node = scene.get(asNodeId(id));
        return node === undefined ? undefined : node.parent;
      },
      ownBox: (id, out, at) => {
        const raw = scene.get(asNodeId(id));
        if (raw === undefined) return BOX_NONE;
        // Boxed as shown, so a data override that grows a node's ink is met where it is painted.
        const node = nodeAsShown(scene.overrides, raw) as unknown as PickCandidate<unknown>;
        const parents = parentsOf(node);
        // Also hit wherever an ancestor paints a copy of it, which its own box does not cover.
        if (hasCopyingAncestor(parents)) return BOX_ALL;
        let outsetPx: number;
        try {
          const inherited = inheritsPaint(node) ? inheritedPaintOf(node, parents) : undefined;
          outsetPx = nodeBroadBox(node, poseOf(node as never), pathOf(node), inherited, descriptor, box, shapes);
        } catch {
          return BOX_ALL;
        }
        if (!Number.isFinite(outsetPx) || !box.every(Number.isFinite) || box[0] > box[2] || box[1] > box[3]) return BOX_ALL;
        if (outsetPx > this.maxOutsetPx) this.maxOutsetPx = outsetPx;
        out.set(box, at);
        return BOX_SOME;
      },
      tagsOf: (id) => {
        const node = scene.get(asNodeId(id));
        return node === undefined ? 0 : 1 << this.tagOf(node.layer);
      },
    };
  }

  /** The nodes the boxes reach, in render order, or null when that is most of the scene. */
  candidates(tree: ReachTree, broadFor: (layer: string) => PickBroad | null, order: Order): Order | null {
    const regions: (ReachRegion | undefined)[] = [];
    let wanted = 0;
    for (const layer of this.scene.layers) {
      const broad = broadFor(layer.id);
      if (broad === null) continue;
      const bit = this.tagOf(layer.id);
      wanted |= 1 << bit;
      if (bit === TAG_BITS) {
        regions[bit] = undefined;
        continue;
      }
      const { x, y, width, height } = broad.box;
      const k = broad.pxPerWorld;
      const by = this.maxOutsetPx > 0 && k !== undefined ? (k > 0 ? this.maxOutsetPx / k : Infinity) : 0;
      if (by === Infinity) {
        regions[bit] = undefined;
        continue;
      }
      regions[bit] = { box: [x - by, y - by, x + width + by, y + height + by] };
    }
    const rank = renderRanksOf(this.scene.renderOrderNodes());
    const limit = Math.floor(order.length * MAX_SHARE);
    const found: number[] = [];
    let over = false;
    tree.collect({ wanted, regions }, (id) => {
      const at = rank.get(id);
      if (at !== undefined) found.push(at);
      if (found.length <= limit) return true;
      over = true;
      return false;
    });
    if (over) return null;
    found.sort((a, b) => a - b);
    return found.map((i) => order[i]!);
  }
}

const INDEXES = createPart((_scene: object) => new WeakMap<PoseDescriptor<unknown>, PickIndex>());

function indexOf(scene: AnyScene, descriptor: PoseDescriptor<unknown>): PickIndex {
  const perScene = INDEXES(scene);
  let index = perScene.get(descriptor);
  if (index === undefined) perScene.set(descriptor, (index = new PickIndex(scene, descriptor)));
  // Registers the built-in painters first, which bumps the memo generation.
  nodeShapeEntries(nodeShapesOf(scene));
  return index;
}

/** The index for `scene` read through `descriptor`, or null when this pick walks instead. */
export function scenePickIndex(scene: AnyScene, descriptor: PoseDescriptor<unknown>): ScenePickIndex | null {
  const index = indexOf(scene, descriptor);
  return index.current() === null ? null : index;
}

/** What `PickSource.candidates` answers for a scene source with an index. */
export function indexedCandidates(
  scene: AnyScene,
  descriptor: PoseDescriptor<unknown>,
  broadFor: (layer: string | undefined) => PickBroad | null | undefined,
): readonly PickCandidate<unknown>[] | null {
  const index = indexOf(scene, descriptor);
  const tree = index.current();
  if (tree === null) return null;
  const broads = new Map<string, PickBroad | null>();
  for (const layer of index.layers) {
    const broad = broadFor(layer);
    if (broad === undefined) return null;
    if (broad !== null && Number.isNaN(broad.box.x + broad.box.y + broad.box.width + broad.box.height)) return null;
    broads.set(layer, broad);
  }
  const order = nodesAsShown(scene.overrides, scene.renderOrderNodes()) as unknown as Order;
  return index.candidates(tree, (layer) => broads.get(layer) ?? null, order);
}
