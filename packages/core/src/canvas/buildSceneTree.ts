import type { NodeShapes } from './nodeShapeRegistry';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import { ownClipOf, type ClipBearing } from './ownClip';
import { mat3, meanScale, type Affine, type Path } from '@weasel-js/geom';
import { definesFrame } from 'core/scene/effectivePose';
import { deriveParallaxView, type ParallaxOptions, type PlaneMap } from 'core/viewport/parallax';
import { createLayerPlaneLookup } from './pickWalk';
import { clipCarrier, planeTransform } from './planeClips';
import { splitOverChildren } from './overChildren';
import { hidesSubtree } from 'core/scene/nodeGates';
import type { LodWalk } from './lod/lodWalk';

/** The scene-tree reading surface `buildSceneTree` walks. A `SceneCanvasAdapter` is one. */
export interface HierarchicalAdapter<TNode, TPose> {
  getLayers(): readonly { id: string; visible: boolean; parallax?: ParallaxOptions }[];
  getNode(id: string): TNode | undefined;
  getChildren(parentId: string | null): readonly string[];
  getPose(id: string): TPose;
  /** Folds a child's local pose into its parent's frame. Absent means the
   *  scene stores absolute poses and a parent contributes no transform —
   *  see `PoseComposition`. */
  composePose?(parent: TPose, child: TPose): TPose;
  /** The frame a container gives its children from its world pose: moved by
   *  its scroll offset where the view scrolls it. Absent means the pose itself. */
  childFrame?(id: string, world: TPose): TPose;
  /** The `pickId` a node's paint carries into an id frame — `scenePickIds`
   *  for a scene. Absent, nodes carry none. */
  pickIdOf?(id: string): number;
}

/** The children of `parent` (`null` for the roots) whose subtrees can paint in the view, in their order. */
export type SubtreeCull = (parent: string | null, children: readonly string[]) => readonly string[];

/** A visibility index's answer for one walk: given the view each layer is drawn in and the layers the walk
 *  paints, the filter it prunes children by. See `sceneSubtreeCull`. */
export type SubtreeCullFor = (viewOf: (layer: string) => View, painting: ReadonlySet<string>) => SubtreeCull;

/** A clip on the chain, with the layer whose world it is drawn in, or the
 *  transform of a copy a container draws — see `GroupNode.copiesFromPose`. */
type ChainEntry = { path: Path; layer: string } | { copy: Affine };

/** Wrap `inner` in one nested group per chain entry, so the renderer intersects
 *  the clips and applies each copy's transform to everything inside it.
 *  Outermost group carries the ancestor-most entry. */
function wrapInChain(
  inner: GroupDrawCommand,
  chain: readonly ChainEntry[],
  toLayer: string,
  carry: ReturnType<typeof clipCarrier>,
): DrawCommand {
  let node = inner;
  for (let i = chain.length - 1; i >= 0; i--) {
    const e = chain[i];
    node = 'copy' in e
      ? { kind: 'group', children: [node], transform: mat3.fromAffine(e.copy) }
      : { kind: 'group', children: [node], clip: carry(e.path, e.layer, toLayer) };
  }
  return node;
}

/** What wraps a node's paint: a group carrying its `pickId`, inside the chain of clips and copies above it. */
function wrapperFor(
  pickId: number | undefined,
  chain: readonly ChainEntry[],
  layer: string,
  carry: ReturnType<typeof clipCarrier>,
): (cmds: DrawCommand[]) => DrawCommand {
  return (cmds) => {
    const inner: GroupDrawCommand = pickId === undefined
      ? { kind: 'group', children: cmds } : { kind: 'group', pickId, children: cmds };
    return chain.length > 0 ? wrapInChain(inner, chain, layer, carry) : inner;
  };
}

/** `view` as it reaches a plane `m` maps the camera's world into: the view that puts a point of
 *  the plane's world under the pixel its camera-world point lands on. */
function viewInPlane(view: View, m: PlaneMap): View {
  return {
    x: m.offset.x + m.scale.x * view.x,
    y: m.offset.y + m.scale.y * view.y,
    scale: { x: view.scale.x / m.scale.x, y: view.scale.y / m.scale.y },
  };
}

/** The view each parallax layer is painted through, or null when none is a plane. */
function planeViewsOf(
  layers: readonly { id: string; parallax?: ParallaxOptions }[],
  planes: ReturnType<typeof createLayerPlaneLookup> | null,
  view: View,
  camera: View | null,
): Map<string, View> | null {
  let out: Map<string, View> | null = null;
  for (const l of layers) {
    if (planes && l.parallax) {
      const v = camera === view ? deriveParallaxView(view, l.parallax) : viewInPlane(view, planes(l.id)!);
      (out ??= new Map()).set(l.id, v);
    }
  }
  return out;
}

/** The filter `prune` answers for a walk painting the visible layers, or `forLayer` alone. */
function pruneFor(
  prune: SubtreeCullFor,
  layers: readonly { id: string; visible: boolean }[],
  forLayer: string | undefined,
  viewOf: (layer: string) => View,
): SubtreeCull {
  const painting = new Set<string>();
  for (const l of layers) if (l.visible && (forLayer === undefined || l.id === forLayer)) painting.add(l.id);
  return prune(viewOf, painting);
}

/**
 * Walk the adapter's scene tree once and emit each node's own paint into the bucket for
 * **that node's own `layer`** — not its parent's. A node carrying `hidden` is skipped with
 * its whole subtree; see `nodeGates`. So a child whose `layer` differs from its
 * parent draws in its own layer's pass while staying a tree child for hit-testing / move /
 * reparent. Output is one group per visible layer, in adapter (`getLayers`) order. A node that
 * consumes its children paints none of them.
 *
 * A node paints before its children. What its `drawOne` wraps in `overChildren` paints after
 * them instead, in the node's own layer.
 *
 * `drawOne` returns world-coord commands. Because a node may be drawn outside its parent's
 * group, the tree nesting cannot carry geometry as renderer state; the walk folds each node's
 * pose into its parent's frame on the way down and hands the painter a **world** pose. Clips
 * are accumulated the same way — each in its container's plane, carried into the plane of the
 * node it clips. With no `composePose` on the adapter the fold is the identity.
 *
 * A layer carrying `parallax` is a plane placed from `camera`: its painters and its cull see
 * `view` as it reaches that plane, and its group carries the transform from the plane's world
 * to the camera's, so the caller's single wrap in `view` still lands it right. With `camera`
 * null no layer is a plane, and every node draws at its world pose.
 */
export function buildSceneTree<
  TNode extends { id: string; layer: string; hidden?: boolean; consumesChildren?: boolean },
  TPose,
>(
  adapter: HierarchicalAdapter<TNode, TPose>,
  /** `rung` is the representation `lod` chose for the node, when it has more than one. */
  drawOne: (obj: TNode, pose: TPose, view: View, rung?: string) => DrawCommand[],
  view: View,
  /** When set, only nodes on this layer paint (others are still walked for
   *  ancestor clips) and only this layer's group is returned. */
  forLayer?: string,
  /** The path a container computes from its dependencies' poses: the scene's
   *  lookup, or `adapterDerivedPathOf` for an adapter with no scene. Left out,
   *  a derived container contributes no clip. */
  derivedPathOf?: (node: TNode, pose: TPose) => Path | null,
  /** True for a node whose paint cannot be seen — see `paintMissesView`. Its
   *  painter is not called; its clip and its children are walked as usual. */
  culled?: (node: TNode, pose: TPose, view: View) => boolean,
  /** Where a node is drawn, given its world pose: the scene's output grid moves it. Its cull
   *  and its painter both read this pose. Absent, a node is drawn at its world pose. */
  drawnPose?: (node: TNode, pose: TPose) => TPose,
  /** The camera parallax planes are placed from. Default `view`, as on screen; a render that
   *  resamples a camera's frame at another scale passes that camera, and null draws no planes. */
  camera: View | null = view,
  /** The painters a `clip: 'outline'` container is outlined by. Default `defaultNodeShapes`. */
  shapes?: NodeShapes,
  /** A visibility index: a subtree it says cannot paint in the view is not walked at all, so it
   *  emits no painter, no clip and no wrapper group. Copies are walked whole. */
  prune?: SubtreeCullFor,
  /** Level of detail: the rung each node shows at its size on screen. A rung that skips children
   *  draws in place of the subtree, which is not visited; `'none'` draws nothing. */
  lod?: LodWalk<TNode, TPose>,
): DrawCommand[] {
  const layers = adapter.getLayers();
  // A hidden layer gets no bucket, and a node with no bucket is not painted.
  const buckets = new Map<string, DrawCommand[]>();
  for (const l of layers) if (l.visible) buckets.set(l.id, []);
  const planes = camera === null ? null : createLayerPlaneLookup(layers, camera);
  const planeViews = planeViewsOf(layers, planes, view, camera);
  const keep = prune ? pruneFor(prune, layers, forLayer, (layer) => planeViews?.get(layer) ?? view) : null;

  const compose = adapter.composePose?.bind(adapter);
  const scrolled = compose ? adapter.childFrame?.bind(adapter) : undefined;
  const carry = clipCarrier(planes);

  /** The children of `node`, as authored and under each copy it draws. */
  function visitBelow(
    id: string,
    node: TNode,
    pose: TPose,
    ancestorClips: readonly ChainEntry[],
    ownClip: ChainEntry | null,
    parentFrame: TPose | null,
    copied: boolean,
  ): void {
    const ownClips = ownClip ? [...ancestorClips, ownClip] : ancestorClips;
    // An envelope's children share its own parent's frame.
    const childFrame = definesFrame(node as never) ? (scrolled ? scrolled(id, pose) : pose) : parentFrame;
    const children = node.consumesChildren === true ? [] : adapter.getChildren(id);
    for (const cid of keep && !copied && children.length > 0 ? keep(id, children) : children) visit(cid, ownClips, childFrame, copied);

    // A copy is a copy of the clipped content, so its transform encloses the
    // container's own clip and sits inside every clip above it.
    const container = node as { copiesFromPose?: (pose: TPose, node: unknown) => readonly Affine[] | null };
    const copies = typeof container.copiesFromPose === 'function' ? container.copiesFromPose(pose, node) : null;
    for (const copy of copies ?? []) {
      const chain: ChainEntry[] = [...ancestorClips, { copy }, ...(ownClip ? [ownClip] : [])];
      for (const cid of children) visit(cid, chain, childFrame, true);
    }
  }

  function visit(
    id: string,
    ancestorClips: readonly ChainEntry[],
    parentFrame: TPose | null,
    /** Under a copy: the pose is not where it paints, so the cull cannot judge it. */
    copied: boolean,
  ): void {
    const node = adapter.getNode(id);
    if (!node || hidesSubtree(node)) return;
    const local = adapter.getPose(id);
    // Fold once, on the way down: O(1) per node where walking the parent chain
    // per node would be O(depth).
    const pose = compose && parentFrame !== null ? compose(parentFrame, local) : local;
    // Skip the (potentially expensive) painter for nodes we won't emit; their
    // clip still extends the chain for descendants below.
    const bucket = forLayer === undefined || node.layer === forLayer
      ? buckets.get(node.layer) : undefined;
    const v = planeViews?.get(node.layer) ?? view;
    const drawn = bucket && drawnPose ? drawnPose(node, pose) : pose;
    const pick = lod?.pick(node, pose, v) ?? null;
    if (pick?.rung === 'none') return;
    const { under: self, over } = splitOverChildren(
      bucket && (copied || !culled?.(node, drawn, v)) ? drawOne(node, drawn, v, pick?.rung) : [],
    );

    let ownClip: ChainEntry | null = null;
    const clip = ownClipOf(node as ClipBearing<TPose>, pose, () => derivedPathOf?.(node, pose), shapes, meanScale(v.scale));
    if (clip) {
      ownClip = { path: clip, layer: node.layer };
    }

    // Every node walked emits a wrapper group even with empty paint, keeping the per-node tree
    // shape stable. A node's own clip is its children's, so its own paint, over
    // its children or under them, takes only the clips above it.
    const wrap = wrapperFor(adapter.pickIdOf?.(id), ancestorClips, node.layer, carry);
    if (bucket) bucket.push(wrap(self));
    // A rung that skips children draws in their place.
    if (pick?.skip !== true) visitBelow(id, node, pose, ancestorClips, ownClip, parentFrame, copied);

    if (bucket && over.length > 0) bucket.push(wrap(over));
  }

  const roots = adapter.getChildren(null);
  for (const rootId of keep ? keep(null, roots) : roots) visit(rootId, [], null, false);
  lod?.end();

  return layerGroupsOf(layers, forLayer, buckets, planes);
}

/** One group per visible layer the walk paints, in `layers` order, a plane's carrying its transform. */
function layerGroupsOf(
  layers: readonly { id: string; visible: boolean }[],
  forLayer: string | undefined,
  buckets: ReadonlyMap<string, DrawCommand[]>,
  planes: ReturnType<typeof createLayerPlaneLookup> | null,
): DrawCommand[] {
  const out: DrawCommand[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    if (forLayer !== undefined && layer.id !== forLayer) continue;
    const children = buckets.get(layer.id) ?? [];
    const map = planes?.(layer.id) ?? null;
    const transform = map ? planeTransform(map, null) : undefined;
    out.push(transform ? { kind: 'group', transform, children } : { kind: 'group', children });
  }
  return out;
}
