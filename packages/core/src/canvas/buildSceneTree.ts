import type { DrawCommand, GroupDrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';
import { findShapeSilhouette } from './NodeShape';
import type { Node } from 'core/scene/types';
import type { Path } from '@weasel-js/geom';
import { definesFrame } from 'core/scene/effectivePose';
import { deriveParallaxView, planeMap, type ParallaxOpts } from 'core/viewport/parallax';
import { scenePlaneOf } from './pickWalk';
import { clipCarrier, planeTransform } from './planeClips';

/**
 * The scene-tree reading surface `buildSceneTree` walks. A `SceneCanvasAdapter`
 * satisfies this; flat (non-hierarchical) adapters don't. Canvas exposes these
 * as *optional* methods on `CanvasProps.adapter` (see `OptionalSceneHierarchy`)
 * and feature-detects them at draw time.
 */
export interface HierarchicalAdapter<TNode, TPose> {
  getLayers(): readonly { id: string; visible: boolean; parallax?: ParallaxOpts }[];
  getNode(id: string): TNode | undefined;
  getChildren(parentId: string | null): readonly string[];
  getPose(id: string): TPose;
  /** Folds a child's local pose into its parent's frame. Absent means the
   *  scene stores absolute poses and a parent contributes no transform —
   *  see `PoseComposition`. */
  composePose?(parent: TPose, child: TPose): TPose;
}

/** A clip on the chain, with the layer whose world it is drawn in. */
interface ChainClip { path: Path; layer: string }

/** Wrap `cmds` in one nested group per clip so the renderer intersects them.
 *  Outermost group carries the ancestor-most clip; innermost holds `cmds`. */
function wrapInClips(
  cmds: DrawCommand[],
  clips: readonly ChainClip[],
  toLayer: string,
  carry: ReturnType<typeof clipCarrier>,
): DrawCommand {
  let node: GroupDrawCommand = { kind: 'group', children: cmds };
  for (let i = clips.length - 1; i >= 0; i--) {
    node = { kind: 'group', children: [node], clip: carry(clips[i].path, clips[i].layer, toLayer) };
  }
  return node;
}

/**
 * Walk the adapter's scene tree once and emit each node's own paint into the
 * bucket for **that node's own `layer`** — not its parent's. So a child whose
 * `layer` differs from its parent (e.g. a planting tagged into a top-most
 * `plantings` layer while remaining a scene child of its container) draws in
 * its own layer's pass, on top of every container body, while staying a tree
 * child for hit-testing / move / reparent.
 *
 * Output is one group per visible layer, in adapter (`getLayers`) order.
 *
 * **Positioning** is world-space: `drawOne` returns world-coord commands (the
 * caller wraps the whole thing in the view transform). Because a node may be
 * drawn outside its parent's group, the tree nesting cannot carry geometry as
 * renderer state; instead the walk folds each node's pose into its parent's
 * frame on the way down and hands the painter a **world** pose. Clips are
 * accumulated the same way and are world-space for the same reason — each in
 * its container's plane, carried into the plane of the node it clips.
 *
 * With no `composePose` on the adapter the fold is the identity, every node
 * paints at its stored pose, and this is the absolute-pose behavior the kit
 * shipped before frames existed.
 *
 * A layer carrying `parallax` is a plane: its painters and its cull see the
 * view derived for it, and its group carries the transform from its world to
 * the camera's, so the caller's single camera wrap still lands it right.
 */
export function buildSceneTree<
  TNode extends { id: string; layer: string },
  TPose,
>(
  adapter: HierarchicalAdapter<TNode, TPose>,
  drawOne: (obj: TNode, pose: TPose, view: View) => DrawCommand[],
  view: View,
  /** When set, only nodes on this layer paint (others are still walked for
   *  ancestor clips) and only this layer's group is returned. Used to render
   *  scene layers as separate, individually-orderable canvas slots. */
  forLayer?: string,
  /** The path a container computes from its dependencies' poses. Only a
   *  scene-backed caller can answer — deriving needs the dependencies' poses —
   *  so the bare-adapter path omits it and a derived container contributes no
   *  clip there, exactly as before. */
  derivedPathOf?: (node: TNode, pose: TPose) => Path | null,
  /** True for a node whose paint cannot be seen — see `paintMissesView`. Its
   *  painter is not called; its clip and its children are walked as usual. */
  culled?: (node: TNode, pose: TPose, view: View) => boolean,
): DrawCommand[] {
  const layers = adapter.getLayers();
  const buckets = new Map<string, DrawCommand[]>();
  for (const l of layers) buckets.set(l.id, []);
  let planeViews: Map<string, View> | null = null;
  for (const l of layers) {
    if (l.parallax) (planeViews ??= new Map()).set(l.id, deriveParallaxView(view, l.parallax));
  }

  const compose = adapter.composePose?.bind(adapter);
  const carry = clipCarrier(planeViews ? scenePlaneOf(layers, view) : null);

  function visit(
    id: string,
    ancestorClips: readonly ChainClip[],
    parentFrame: TPose | null,
  ): void {
    const node = adapter.getNode(id);
    if (!node) return;
    const local = adapter.getPose(id);
    // Fold once, on the way down: O(1) per node where walking the parent chain
    // per node would be O(depth).
    const pose = compose && parentFrame !== null ? compose(parentFrame, local) : local;
    // Skip the (potentially expensive) painter for nodes we won't emit; their
    // clip still extends the chain for descendants below.
    const paints = forLayer === undefined || node.layer === forLayer;
    const v = planeViews?.get(node.layer) ?? view;
    const self = paints && !culled?.(node, pose, v) ? drawOne(node, pose, v) : [];

    // Extend the clip chain with this node's own clip when it is a container.
    let ownClips = ancestorClips;
    const maybeContainer = node as { kind?: string; clipFromPose?: (pose: TPose) => unknown };
    if (maybeContainer.kind === 'container') {
      let clip: unknown;
      if (typeof maybeContainer.clipFromPose === 'function') {
        // Explicit per-node clip wins — no fallback to the painter silhouette.
        clip = maybeContainer.clipFromPose(pose);
      } else {
        // No explicit clip → fall back to the painter silhouette for the
        // container's shape kind. Built-ins give rect-fallback containers
        // their own AABB as a clip; consumer painters can provide arbitrary
        // closed shapes (ellipse, polygon, …) without per-node wiring.
        clip = findShapeSilhouette(
          node as unknown as Node<unknown, string, TPose>,
          pose,
          { derivedPath: derivedPathOf?.(node, pose) },
        );
      }
      if (clip) ownClips = [...ancestorClips, { path: clip as Path, layer: node.layer }];
    }

    // Emit this node's own paint into its own layer's bucket, clipped by the
    // accumulated chain (ancestors + own). Every node emits a wrapper group
    // even with empty paint, keeping the per-node tree shape stable.
    if (paints) {
      const bucket = buckets.get(node.layer);
      if (bucket) {
        bucket.push(ownClips.length > 0 ? wrapInClips(self, ownClips, node.layer, carry) : { kind: 'group', children: self });
      }
    }

    // An envelope's children share its own parent's frame.
    const childFrame = definesFrame(node as never) ? pose : parentFrame;
    for (const cid of adapter.getChildren(id)) visit(cid, ownClips, childFrame);
  }

  for (const rootId of adapter.getChildren(null)) visit(rootId, [], null);

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
