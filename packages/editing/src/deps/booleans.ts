/**
 * The kit `booleansAdapter` dep: what the Pathfinder actions, and any tool
 * reading the dep, work on over a canvas's own path leaves.
 *
 * `booleansPreset` publishes it over the canvas's scene. A consumer replaces it
 * with `useBooleansAdapter` from under the canvas — for text operands, say,
 * which this one does not read; the newest registration wins, and a canvas
 * child registers after the presets' components.
 */
import { sceneInheritedPaintOf, storesEdits, pathPaintOf, type PathPaint, drawnPose, leafPath, storePiece } from '@weasel-js/core';
import { useMemo } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import { pathInWorld } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR, poseDescriptorForNode, type PoseDescriptor, sceneMutators, asNodeId, type Scene, withoutPageStructure, scenePoseFrame } from '@weasel-js/core/engine';
import type { OperandsDep } from '@weasel-js/core/engine';
import type { BooleansAdapter } from '../booleans/booleans';
import type { OpsApplier } from '@weasel-js/core';

/**
 * Publish a `booleansAdapter` over `scene`'s path leaves (`data.path` drawn
 * through the pose's box), acting on `operands`. A result is minted from the source it stands in
 * for: its layer, parent, frame, and data, with the result's path, and the
 * result's paint in place of the source's when the operation gives one.
 */
export function useBooleansAdapterDepSource(
  scene: Scene<unknown, string, unknown>,
  operands: OperandsDep,
  adapter: OpsApplier,
  poseDescriptor?: PoseDescriptor<unknown>,
): void {
  const sceneRef = useLatest(scene);
  const operandsRef = useLatest(operands);
  const adapterRef = useLatest(adapter);
  const descriptorRef = useLatest(poseDescriptor);

  const booleans = useMemo<BooleansAdapter>(() => {
    const leafOf = (id: string) => {
      const sc = sceneRef.current;
      const node = sc.get(asNodeId(id));
      const path = node ? leafPath(sc, node) : null;
      // A leaf in a singular frame draws flat, and no result could be stored in its place.
      if (!node || !path || !storesEdits(sc, node)) return null;
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
      getSelection: () => withoutPageStructure(sceneRef.current, operandsRef.current.get()),
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
          kind: 'mark',
          layer: leaf.node.layer,
          parent: leaf.node.parent ?? null,
          pose: leaf.frame.local(sourceId, stored.pose),
          data,
        };
      },
      applyOps: (ops, label) => adapterRef.current.applyOps(ops, label),
    };
  }, [sceneRef, operandsRef, adapterRef, descriptorRef]);

  useDepSource('booleansAdapter', () => booleans);
}
