/**
 * The kit `booleansAdapter` dep: what the Pathfinder actions, and any tool
 * reading the dep, work on over a canvas's own path leaves.
 *
 * `<SceneCanvas>` publishes it over its own scene. A consumer replaces it with
 * `useBooleansAdapter` from under the canvas — for text operands, say, which
 * this one does not read; the newest registration wins, and a canvas child
 * registers after the canvas's own.
 */
import { sceneInheritedPaintOf } from 'canvas/inheritedPaints';
import { useMemo } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import { pathInWorld } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { sceneMutators } from 'core/scene/sceneMutators';
import { asNodeId, type Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { scenePoseFrame } from 'interactions/actions/poseFrame';
import type { BooleansAdapter } from 'interactions/actions/booleans/booleans';
import { pathPaintOf, type PathPaint } from '../nodeShapes/nodePaint';
import { drawnPose, leafPath, storePiece } from './pathLeaf';
import type { OpsApplier } from './slice';

/**
 * Publish a `booleansAdapter` over `scene`'s path leaves (`data.path` drawn
 * through the pose's box). A result is minted from the source it stands in
 * for: its layer, parent, frame, and data, with the result's path, and the
 * result's paint in place of the source's when the operation gives one.
 */
export function useBooleansAdapterSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
  poseDescriptor?: PoseDescriptor<unknown>,
): void {
  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);
  const adapterRef = useLatest(adapter);
  const descriptorRef = useLatest(poseDescriptor);

  const booleans = useMemo<BooleansAdapter>(() => {
    const leafOf = (id: string) => {
      const sc = sceneRef.current;
      const node = sc.get(asNodeId(id));
      const path = node ? leafPath(sc, node) : null;
      if (!node || !path) return null;
      const frame = scenePoseFrame(sc);
      const g = poseDescriptorForNode(descriptorRef.current ?? AUTO_POSE_DESCRIPTOR, node);
      const drawn = drawnPose(g, frame.world(node.id));
      return drawn ? { node, path, drawn, frame } : null;
    };
    const tree = () => sceneMutators(sceneRef.current);
    return {
      getNode: (id) => tree().getNode(id),
      getParent: (id) => tree().getParent(id),
      getChildren: (parentId) => tree().getChildren(parentId),
      setChildOrder: (parentId, ids) => tree().setChildOrder(parentId, ids),
      getSelection: () => selectionRef.current.get(),
      getWorldPath: (id) => {
        const leaf = leafOf(id);
        return leaf ? pathInWorld(leaf.path, leaf.drawn.box) : undefined;
      },
      getPaint: (id) => {
        const leaf = leafOf(id);
        return leaf
          ? pathPaintOf(leaf.node.data as Parameters<typeof pathPaintOf>[0], sceneInheritedPaintOf(sceneRef.current)(leaf.node))
          : undefined;
      },
      compareZ: (a, b) => {
        const order = [...sceneRef.current.renderOrder()];
        return order.indexOf(asNodeId(a)) - order.indexOf(asNodeId(b));
      },
      createPathNode: (path, _op, sourceId, paint?: PathPaint) => {
        const leaf = leafOf(sourceId);
        if (!leaf) throw new Error(`[booleansAdapter] no path leaf behind source ${sourceId}`);
        const stored = storePiece(leaf.drawn, path);
        const { fill: _fill, stroke: _stroke, ...rest } = (leaf.node.data ?? {}) as Record<string, unknown>;
        const data = paint ? { ...rest, ...paint, path: stored.path } : { ...(leaf.node.data as object), path: stored.path };
        return {
          id: sceneRef.current.mintId(),
          kind: 'leaf',
          layer: leaf.node.layer,
          parent: leaf.node.parent ?? null,
          pose: leaf.frame.local(sourceId, stored.pose),
          data,
        };
      },
      applyOps: (ops, label) => adapterRef.current.applyOps(ops, label),
    };
  }, [sceneRef, selectionRef, adapterRef, descriptorRef]);

  useDepSource('booleansAdapter', () => booleans);
}
