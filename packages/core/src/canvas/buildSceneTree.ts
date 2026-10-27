import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import { ownClipOf, type ClipBearing } from './ownClip';
import { mat3, type Affine, type Path } from '@weasel-js/geom';
import { definesFrame } from 'core/scene/effectivePose';
import { deriveParallaxView, planeMap, type ParallaxOpts } from 'core/viewport/parallax';
import { scenePlaneOf } from './pickWalk';
import { clipCarrier, planeTransform } from './planeClips';
import { splitOverChildren } from './overChildren';
import { hidesSubtree } from 'core/scene/nodeGates';

/** The scene-tree reading surface `buildSceneTree` walks. A `SceneCanvasAdapter` is one. */
export interface HierarchicalAdapter<TNode, TPose> {
  getLayers(): readonly { id: string; visible: boolean; parallax?: ParallaxOpts }[];
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
}

/** A clip on the chain, with the layer whose world it is drawn in, or the
 *  transform of a copy a container draws — see `GroupNode.copiesFromPose`. */
type ChainEntry = { path: Path; layer: string } | { copy: Affine };

/** Wrap `cmds` in one nested group per chain entry, so the renderer intersects
 *  the clips and applies each copy's transform to everything inside it.
 *  Outermost group carries the ancestor-most entry; innermost holds `cmds`. */
function wrapInChain(
  cmds: DrawCommand[],
  chain: readonly ChainEntry[],
  toLayer: string,
  carry: ReturnType<typeof clipCarrier>,
): DrawCommand {
  let node: GroupDrawCommand = { kind: 'group', children: cmds };
  for (let i = chain.length - 1; i >= 0; i--) {
    const e = chain[i];
    node = 'copy' in e
      ? { kind: 'group', children: [node], transform: mat3.fromAffine(e.copy) }
      : { kind: 'group', children: [node], clip: carry(e.path, e.layer, toLayer) };
  }
  return node;
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
 * A layer carrying `parallax` is a plane: its painters and its cull see the view derived for
 * it, and its group carries the transform from its world to the camera's, so the caller's
 * single camera wrap still lands it right.
 */
export function buildSceneTree<
  TNode extends { id: string; layer: string; hidden?: boolean; consumesChildren?: boolean },
  TPose,
>(
  adapter: HierarchicalAdapter<TNode, TPose>,
  drawOne: (obj: TNode, pose: TPose, view: View) => DrawCommand[],
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
): DrawCommand[] {
  const layers = adapter.getLayers();
  // A hidden layer gets no bucket, and a node with no bucket is not painted.
  const buckets = new Map<string, DrawCommand[]>();
  for (const l of layers) if (l.visible) buckets.set(l.id, []);
  let planeViews: Map<string, View> | null = null;
  for (const l of layers) {
    if (l.parallax) (planeViews ??= new Map()).set(l.id, deriveParallaxView(view, l.parallax));
  }

  const compose = adapter.composePose?.bind(adapter);
  const scrolled = compose ? adapter.childFrame?.bind(adapter) : undefined;
  const carry = clipCarrier(planeViews ? scenePlaneOf(layers, view) : null);

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
    const { under: self, over } = splitOverChildren(
      bucket && (copied || !culled?.(node, pose, v)) ? drawOne(node, pose, v) : [],
    );

    let ownClips = ancestorClips;
    let ownClip: ChainEntry | null = null;
    const maybeContainer = node as ClipBearing<TPose> & {
      copiesFromPose?: (pose: TPose, node: unknown) => readonly Affine[] | null;
    };
    const clip = ownClipOf(maybeContainer, pose, () => derivedPathOf?.(node, pose));
    if (clip) {
      ownClip = { path: clip, layer: node.layer };
      ownClips = [...ancestorClips, ownClip];
    }

    // Every node emits a wrapper group even with empty paint, keeping the per-node tree
    // shape stable. A node's own clip is its children's, so its own paint, over
    // its children or under them, takes only the clips above it.
    const wrap = (cmds: DrawCommand[]): DrawCommand => (ancestorClips.length > 0
      ? wrapInChain(cmds, ancestorClips, node.layer, carry) : { kind: 'group', children: cmds });
    if (bucket) bucket.push(wrap(self));

    // An envelope's children share its own parent's frame.
    const childFrame = definesFrame(node as never) ? (scrolled ? scrolled(id, pose) : pose) : parentFrame;
    const children = node.consumesChildren === true ? [] : adapter.getChildren(id);
    for (const cid of children) visit(cid, ownClips, childFrame, copied);

    // A copy is a copy of the clipped content, so its transform encloses the
    // container's own clip and sits inside every clip above it.
    const copies = typeof maybeContainer.copiesFromPose === 'function'
      ? maybeContainer.copiesFromPose(pose, node) : null;
    for (const copy of copies ?? []) {
      const chain: ChainEntry[] = [...ancestorClips, { copy }, ...(ownClip ? [ownClip] : [])];
      for (const cid of children) visit(cid, chain, childFrame, true);
    }

    if (bucket && over.length > 0) bucket.push(wrap(over));
  }

  for (const rootId of adapter.getChildren(null)) visit(rootId, [], null, false);

  const out: DrawCommand[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    if (forLayer !== undefined && layer.id !== forLayer) continue;
    const children = buckets.get(layer.id) ?? [];
    const transform = layer.parallax ? planeTransform(planeMap(view, layer.parallax), null) : undefined;
    out.push(transform ? { kind: 'group', transform, children } : { kind: 'group', children });
  }
  return out;
}
