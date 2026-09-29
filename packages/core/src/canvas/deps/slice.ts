/**
 * The `slice` dep `sliceAction` and `useSliceTool` commit their cuts through.
 *
 * `<SceneCanvas>` publishes `useSliceDepSource` over its own scene. A consumer
 * replaces it with `useSliceDep` (or `useDepSource('slice', …)`) from under
 * the canvas; the newest registration wins, and a canvas child registers
 * after the canvas's own.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { SliceDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId, Node } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { Path } from '@weasel-js/geom';
import { isRectPose } from 'interactions/actions/resize/autoPoseDescriptor';
import { pathInWorld } from 'features/paths/pathInWorld';
import { scenePoseFrame } from 'interactions/actions/poseFrame';
import { freshNodeId } from 'interactions/actions/defaults/freshNodeId';
import { computeSliceOps, type SliceLeaf } from 'interactions/actions/defaults/sliceOps';
import type { PoseComposition } from 'features/groups/composePose';

/** Publish how a slice (knife cut) is performed, so the `slice` action can
 *  run against the consumer's geometry. */
export function useSliceDep(dep: SliceDep): void {
  const depRef = useLatest(dep);

  useDepSource('slice', (): SliceDep => depRef.current);
}

interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

/**
 * The kit `slice` dep: cut every leaf the cut crosses and swap it for its
 * pieces in one undoable batch.
 *
 * A leaf is cut when its `data.path` is a `Path` and its pose is a rect pose;
 * a leaf on a locked layer, or one whose geometry derives from other nodes,
 * is passed over. Each path is baked to world space, so a child is cut where
 * it is drawn, and each piece is stored back in its parent's frame through
 * `poseComposition`. The pieces of a selected leaf take its place in the
 * selection.
 */
export function useSliceDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
  poseComposition?: PoseComposition<unknown>,
): void {
  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);
  const adapterRef = useLatest(adapter);
  const compositionRef = useLatest(poseComposition);

  useDepSource('slice', (): SliceDep => ({
    commit(cut) {
      const sc = sceneRef.current;
      const frame = scenePoseFrame(sc, compositionRef.current);
      const leaves: SliceLeaf<Node<unknown, string, unknown>>[] = [];
      for (const node of sc.renderOrderNodes()) {
        const path = sliceablePath(sc, node);
        if (!path) continue;
        const world = frame.world(node.id);
        if (!isRectPose(world)) continue;
        leaves.push({ node, index: siblingIndex(sc, node), worldPath: pathInWorld(path, world) });
      }

      const sel = selectionRef.current;
      const { ops, nextSelection } = computeSliceOps({
        leaves,
        cut,
        nextId: freshNodeId,
        selection: sel.get(),
        placePiece: (leaf, bounds) => frame.local(leaf.node.id, bounds),
      });
      if (ops.length === 0) return;
      adapterRef.current.applyOps(ops, 'Slice');
      if (nextSelection) sel.set(nextSelection as NodeId[]);
    },
  }));
}

function sliceablePath(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>): Path | null {
  if (node.kind !== 'leaf' || node.derivePath || node.derivePose) return null;
  if (!isRectPose(node.pose) || scene.isLocked(node.id)) return null;
  const path = (node.data as { path?: unknown } | null)?.path as Path | undefined;
  return path && (path.kind === 'rect' || path.kind === 'polygon') ? path : null;
}

function siblingIndex(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>): number {
  const siblings = node.parent == null ? scene.roots : scene.childrenOf(node.parent);
  return siblings.indexOf(node.id);
}
