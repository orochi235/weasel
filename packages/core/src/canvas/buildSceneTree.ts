import type { DrawCommand, GroupDrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';
import { findShapeSilhouette } from './NodeShape';
import type { Node } from 'core/scene/types';
import type { Path } from 'features/paths/types';

/**
 * The scene-tree reading surface `buildSceneTree` walks. A `SceneCanvasAdapter`
 * satisfies this; flat (non-hierarchical) adapters don't. Canvas exposes these
 * as *optional* methods on `CanvasProps.adapter` (see `OptionalSceneHierarchy`)
 * and feature-detects them at draw time.
 */
export interface HierarchicalAdapter<TNode, TPose> {
  getLayers(): readonly { id: string; visible: boolean }[];
  getNode(id: string): TNode | undefined;
  getChildren(parentId: string | null): readonly string[];
  getPose(id: string): TPose;
}

/** Wrap `cmds` in one nested group per clip so the renderer intersects them.
 *  Outermost group carries the ancestor-most clip; innermost holds `cmds`. */
function wrapInClips(
  cmds: DrawCommand[],
  clips: readonly GroupDrawCommand['clip'][],
): DrawCommand {
  let node: GroupDrawCommand = { kind: 'group', children: cmds };
  for (let i = clips.length - 1; i >= 0; i--) {
    node = { kind: 'group', children: [node], clip: clips[i] };
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
 * caller wraps the whole thing in the view transform). The tree nesting is NOT
 * used for geometry — only to accumulate the **clip chain**. Because a node may
 * be drawn outside its parent's group, each node's commands are wrapped in the
 * clips of all its ancestor containers (and its own, if it is a container), so
 * container clipping survives the per-layer regrouping. Clips therefore must be
 * world-space too — `clipFromPose` consumers should return world silhouettes.
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
): DrawCommand[] {
  const layers = adapter.getLayers();
  const buckets = new Map<string, DrawCommand[]>();
  for (const l of layers) buckets.set(l.id, []);

  function visit(id: string, ancestorClips: readonly GroupDrawCommand['clip'][]): void {
    const node = adapter.getNode(id);
    if (!node) return;
    const pose = adapter.getPose(id);
    // Skip the (potentially expensive) painter for nodes we won't emit; their
    // clip still extends the chain for descendants below.
    const paints = forLayer === undefined || node.layer === forLayer;
    const self = paints ? drawOne(node, pose, view) : [];

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
      if (clip) ownClips = [...ancestorClips, clip as GroupDrawCommand['clip']];
    }

    // Emit this node's own paint into its own layer's bucket, clipped by the
    // accumulated chain (ancestors + own). Every node emits a wrapper group
    // even with empty paint, keeping the per-node tree shape stable.
    if (paints) {
      const bucket = buckets.get(node.layer);
      if (bucket) {
        bucket.push(ownClips.length > 0 ? wrapInClips(self, ownClips) : { kind: 'group', children: self });
      }
    }

    for (const cid of adapter.getChildren(id)) visit(cid, ownClips);
  }

  for (const rootId of adapter.getChildren(null)) visit(rootId, []);

  const out: DrawCommand[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    if (forLayer !== undefined && layer.id !== forLayer) continue;
    out.push({ kind: 'group', children: buckets.get(layer.id) ?? [] });
  }
  return out;
}
