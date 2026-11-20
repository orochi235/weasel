/**
 * The render-time visibility index: a reach tree over where each node's paint
 * can reach, which `buildSceneTree` asks which children of a container can
 * paint in the view, so a subtree that cannot is never walked.
 *
 * Boxes come from the same `paintBounds` the cull reads, at the node's drawn
 * pose. A screen-sized stroke widens a box as the view zooms out, so boxes are
 * taken at the view's scale rounded down to a power of two, which holds every
 * scale up to the next one; crossing one builds a tree for the new octave.
 */
import { createPart } from '@weasel-js/registry';
import { poseFrameOf, type Rect } from '@weasel-js/geom';
import { markerGeneration } from '@weasel-js/stroke';
import type { View } from 'core/viewport/view';
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { nodeAsShown, shownLookup } from 'core/scene/nodeAsShown';
import { drawnPoseOf } from 'core/scene/outputGrid';
import { scenePaintedPoseOf } from '../derivedPath';
import { defaultPaintBounds, defaultReachBounds } from '../defaultDrawOne';
import type { PaintBoundsFn } from '../paintCull';
import { sceneCullPaintBounds } from '../sceneSlotWiring';
import type { SubtreeCullFor } from '../buildSceneTree';
import { affineImage, writeBounds } from './boxes2d';
import { createReachTree, type ReachTree } from './reachTree';
import { BOX_ALL, BOX_NONE, type ReachQuery, type ReachRegion, type ReachSource } from './reachTypes';

type AnyNode = Node<unknown, string, unknown>;
type AnyScene = Scene<unknown, string, unknown>;
type ToPose = (node: AnyNode) => unknown;

/** Layers past this share one tag, which meets everywhere. */
const TAG_BITS = 30;

/** Trees kept per index, one per zoom octave a view of it is drawn at. */
const OCTAVES_KEPT = 3;

/** Nodes below which a scene is walked whole: the walk costs less than asking the index, measured on the
 *  visibility bench (`tests/perf/scene/visibility.bench.ts`). */
export const PRUNE_FROM_NODES = 512;

/** Screen pixels a region is widened by, past the rounding between it and the exact cull. */
const SLACK_PX = 1;

/** A view's scale rounded down to a power of two, keeping its sign. */
function octave(s: number): number {
  const a = Math.abs(s);
  if (!(a > 0) || !Number.isFinite(a)) return s;
  return Math.sign(s) * 2 ** Math.floor(Math.log2(a));
}

/** The world box `rect`'s screen pixels show under `v`. */
function worldRegion(v: View, rect: Rect): ReachRegion {
  const ax = rect.x / v.scale.x + v.x, bx = (rect.x + rect.width) / v.scale.x + v.x;
  const ay = rect.y / v.scale.y + v.y, by = (rect.y + rect.height) / v.scale.y + v.y;
  const px = SLACK_PX / Math.abs(v.scale.x), py = SLACK_PX / Math.abs(v.scale.y);
  return { box: [Math.min(ax, bx) - px, Math.min(ay, by) - py, Math.max(ax, bx) + px, Math.max(ay, by) + py] };
}

class SceneVisibility {
  private readonly trees = new Map<string, ReachTree>();

  constructor(
    private readonly scene: AnyScene,
    private readonly paintBounds: PaintBoundsFn<AnyNode, unknown>,
    private readonly toPose: ToPose | undefined,
  ) {}

  /** The tree for views at these octaves, built when first asked for. */
  treeFor(key: string, octaves: ReadonlyMap<string, View>): ReachTree {
    let tree = this.trees.get(key);
    if (tree !== undefined) {
      this.trees.delete(key);
      this.trees.set(key, tree);
      return tree;
    }
    tree = createReachTree(this.source(octaves));
    this.trees.set(key, tree);
    if (this.trees.size > OCTAVES_KEPT) this.trees.delete(this.trees.keys().next().value!);
    return tree;
  }

  private source(octaves: ReadonlyMap<string, View>): ReachSource {
    const { scene, toPose } = this;
    const reachBounds = this.paintBounds === defaultPaintBounds ? defaultReachBounds : this.paintBounds;
    const bounds = sceneCullPaintBounds(scene, reachBounds, shownLookup(scene), toPose);
    const painted = scenePaintedPoseOf(scene, toPose as never) as (node: AnyNode) => unknown;
    const drawnAt = drawnPoseOf(scene);
    const fallback = octaves.values().next().value as View | undefined;
    let markers = markerGeneration();
    return {
      dim: 2,
      changesSince: (token) => {
        const changed = scene.changesSince(token);
        // A marker's shape lands outside the scene, and moves every box that draws one.
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
        const node = scene.get(asNodeId(id));
        if (node === undefined) return BOX_NONE;
        const pose = painted(node);
        const drawn = drawnAt ? drawnAt(nodeAsShown(scene.overrides, node), pose) : pose;
        const view = octaves.get(node.layer) ?? fallback;
        if (view === undefined) return BOX_ALL;
        let b;
        try {
          b = bounds(node, drawn, view);
        } catch {
          b = null;
        }
        return writeBounds(b, poseFrameOf(drawn), out, at);
      },
      tagsOf: (id) => {
        const node = scene.get(asNodeId(id));
        return node === undefined ? 0 : 1 << this.tagOf(node.layer);
      },
      imagesOf: (id) => {
        const node = scene.get(asNodeId(id)) as (AnyNode & { copiesFromPose?: (p: unknown, n: unknown) => readonly import('@weasel-js/geom').Affine[] | null }) | undefined;
        if (typeof node?.copiesFromPose !== 'function') return null;
        const copies = node.copiesFromPose(painted(node), node);
        return copies && copies.length > 0 ? copies.map(affineImage) : null;
      },
    };
  }

  private bits: { layers: readonly unknown[]; of: Map<string, number> } | null = null;

  /** The tag bit of `layer`: its place in the scene's stack, the last ones sharing one. */
  tagOf(layer: string): number {
    const { layers } = this.scene;
    if (this.bits?.layers !== layers) this.bits = { layers, of: new Map(layers.map((l, i) => [l.id, Math.min(i, TAG_BITS)])) };
    return this.bits.of.get(layer) ?? TAG_BITS;
  }
}

const INDEXES = createPart((_scene: object) => new Map<unknown, Map<unknown, SceneVisibility>>());
const NO_POSE = {};

/** The visibility index of `scene` boxed by `paintBounds`, one per pair. */
function visibilityOf(scene: AnyScene, paintBounds: PaintBoundsFn<AnyNode, unknown>, toPose?: ToPose): SceneVisibility {
  const byBounds = INDEXES(scene);
  let byPose = byBounds.get(paintBounds);
  if (byPose === undefined) byBounds.set(paintBounds, (byPose = new Map()));
  let index = byPose.get(toPose ?? NO_POSE);
  if (index === undefined) byPose.set(toPose ?? NO_POSE, (index = new SceneVisibility(scene, paintBounds, toPose)));
  return index;
}

let enabled = true;

/** Test seam: run `fn` with nothing pruned, for a reference to hold a pruned walk against. Not re-exported. */
export function __withoutSubtreeCullForTest<T>(fn: () => T): T {
  enabled = false;
  try {
    return fn();
  } finally {
    enabled = true;
  }
}

/**
 * What `buildSceneTree` prunes by for `scene` drawn into `rect` (screen pixels):
 * the children of each container whose paint, by `paintBounds`, can reach the
 * view of one of the layers the walk draws. `paintBounds` is the slot's own,
 * before the scene's wrapping; `toPose` the slot's.
 */
export function sceneSubtreeCull<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  paintBounds: PaintBoundsFn<Node<TData, TLayer, TPose>, TPose>,
  rect: Rect,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): SubtreeCullFor | undefined {
  if (!enabled || scene.nodes.size < PRUNE_FROM_NODES) return undefined;
  const index = visibilityOf(scene as AnyScene, paintBounds as PaintBoundsFn<AnyNode, unknown>, toPose as ToPose | undefined);
  return (viewOf, wanted) => {
    const octaves = new Map<string, View>();
    const keys: number[] = [];
    for (const l of scene.layers) {
      const v = viewOf(l.id);
      const sx = octave(v.scale.x), sy = octave(v.scale.y);
      octaves.set(l.id, { x: v.x, y: v.y, scale: { x: sx, y: sy } });
      keys.push(sx, sy);
    }
    const tree = index.treeFor(keys.join(','), octaves);
    tree.ensure();
    const regions: (ReachRegion | undefined)[] = [];
    let bits = 0;
    for (const layer of wanted) {
      const bit = index.tagOf(layer);
      bits |= 1 << bit;
      if (bit < TAG_BITS) regions[bit] = worldRegion(viewOf(layer), rect);
    }
    const q: ReachQuery = { wanted: bits, regions };
    return (parent, children) => tree.childrenMeeting(parent, children, q);
  };
}
