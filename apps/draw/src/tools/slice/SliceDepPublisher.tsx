import { useRef, useMemo } from 'react';
import {
  useSliceDep,
  pathInWorld,
  asNodeId,
  type NodeId,
  type useSelection,
} from '@weasel-js/core';
import { computeSliceOps, type SliceLeaf, type WDLeafNode } from './sliceCommit';

/** WeaselDraw-specific type aliases — mirrored from App.tsx. */
interface WDPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface WDData {
  path?: import('@weasel-js/core').Path;
  text?: string;
  fill?: string | import('@weasel-js/core').FillStyle;
  stroke?: unknown;
  strokeWidth?: number;
  label?: string;
}

type WDLayer = 'default';
type WDScene = ReturnType<typeof import('@weasel-js/core').useScene<WDData, WDLayer, WDPose>>;

/** Minimal adapter surface required by `createDeleteOp`/`createInsertOp`. */
interface SliceAdapter {
  insertNode(node: WDLeafNode, index?: number): void;
  removeNode(id: string): void;
}

/**
 * Registers the WeaselDraw slice commit dep via `useSliceDep`.
 *
 * Must be rendered as a child of `<SceneCanvas>` (which provides the
 * `DepRegistryProvider` that `useSliceDep` requires). Mirrors the
 * `BooleansAdapterPublisher` pattern in App.tsx.
 */
export function SliceDepPublisher({
  scene,
  selection,
}: {
  scene: WDScene;
  selection: ReturnType<typeof useSelection>;
}): null {
  const idCounterRef = useRef(0);

  // Minimal adapter that op.apply() needs — insert/remove for the slice ops
  // and setSelection for the trailing selection-inheritance op.
  // Memoized so it doesn't re-create on every render (mirrors
  // BooleansAdapterPublisher's useMemo pattern).
  const adapter = useMemo<SliceAdapter>(
    () => ({
      insertNode(node: WDLeafNode, index?: number) {
        scene.add({
          kind: node.kind,
          layer: node.layer,
          pose: node.pose,
          data: node.data,
          id: node.id as NodeId,
          ...(index !== undefined ? { index } : {}),
          ...(node.parent !== null ? { parent: node.parent } : {}),
        });
      },
      removeNode(id: string) {
        scene.remove(asNodeId(id));
      },
    }),
    [scene],
  );

  useSliceDep(
    useMemo(
      () => ({
        commit(a: { x: number; y: number }, b: { x: number; y: number }) {
          const order = [...scene.renderOrder()];
          const leaves: SliceLeaf[] = [];

          for (let i = 0; i < order.length; i++) {
            const id = order[i];
            const node = scene.get(id);
            if (!node || node.kind !== 'leaf') continue;
            const data = node.data as WDData;
            if (!data.path) continue;
            const pose = node.pose as WDPose;
            const worldPath = pathInWorld(data.path, pose);
            leaves.push({ node: node as WDLeafNode, index: i, worldPath });
          }

          const { ops, nextSelection } = computeSliceOps({
            leaves,
            a,
            b,
            nextId: () => `s-${idCounterRef.current++}`,
            // Pass the live selection so sliced pieces inherit their source's
            // selected state.
            selection: selection.get(),
          });

          if (ops.length) {
            scene.applyBatch(ops, 'Slice', adapter);
            // Apply the post-op selection imperatively, AFTER the geometry
            // batch. It can't ride in the op batch: `scene.applyBatch` routes
            // through the modality journal, which applies ops via
            // `op.apply(scene)` and `Scene` has no `setSelection`.
            if (nextSelection) selection.set(nextSelection.map(asNodeId));
          }
        },
      }),
      [scene, adapter, selection],
    ),
  );

  return null;
}
