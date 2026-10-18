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
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { pathInWorld } from '@weasel-js/geom';
import { drawnPose, leafPath, storePiece, type DrawnPose } from './pathLeaf';
import { scenePoseFrame } from 'interactions/actions/poseFrame';
import { computeSliceOps, type SliceLeaf } from 'interactions/actions/defaults/sliceOps';

/** Publish how a slice (knife cut) is performed, so the `slice` action can
 *  run against the consumer's geometry. */
export function useSliceDep(dep: SliceDep): void {
  const depRef = useLatest(dep);

  useDepSource('slice', (): SliceDep => depRef.current);
}

/** What the `slice` dep writes its batch through. An adapter satisfies it. */
export interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

/**
 * The kit `slice` dep: cut every leaf the cut crosses and swap it for its
 * pieces in one undoable batch.
 *
 * A leaf is cut when its `data.path` is a `Path` and `poseDescriptor` can read
 * its world pose as a box and a rotation; a leaf on a locked layer, or one
 * whose geometry derives from other nodes, is passed over. A piece keeps the
 * source's rotation in its pose when the descriptor can write one
 * (`withRotation`), and has the rotation baked into its path otherwise. The
 * pieces of a selected leaf take its place in the selection.
 */
export function useSliceDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
  poseDescriptor?: PoseDescriptor<unknown>,
): void {
  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);
  const adapterRef = useLatest(adapter);
  const descriptorRef = useLatest(poseDescriptor);

  useDepSource('slice', (): SliceDep => ({
    commit(cut) {
      const sc = sceneRef.current;
      const frame = scenePoseFrame(sc);
      const descriptor = descriptorRef.current ?? AUTO_POSE_DESCRIPTOR;
      const leaves: SliceLeaf<Node<unknown, string, unknown>>[] = [];
      const drawnAt = new Map<string, DrawnPose>();
      for (const node of sc.renderOrderNodes()) {
        if (sc.isHidden(node.id)) continue;
        const path = leafPath(sc, node);
        if (!path) continue;
        const drawn = drawnPose(poseDescriptorForNode(descriptor, node), frame.world(node.id));
        if (!drawn) continue;
        drawnAt.set(node.id, drawn);
        leaves.push({ node, index: siblingIndex(sc, node), worldPath: pathInWorld(path, drawn.box) });
      }

      const sel = selectionRef.current;
      const { ops, nextSelection } = computeSliceOps({
        leaves,
        cut,
        nextId: () => sc.mintId(),
        selection: sel.get(),
        placePiece: (leaf, piece) => {
          const stored = storePiece(drawnAt.get(leaf.node.id)!, piece);
          return { pose: frame.local(leaf.node.id, stored.pose), path: stored.path };
        },
      });
      if (ops.length === 0) return;
      adapterRef.current.applyOps(ops, 'Slice');
      if (nextSelection) sel.set(nextSelection as NodeId[]);
    },
  }));
}

function siblingIndex(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>): number {
  const siblings = node.parent == null ? scene.roots : scene.childrenOf(node.parent);
  return siblings.indexOf(node.id);
}
