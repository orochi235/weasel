/**
 * `useEditAnchorsDepSource` — wires the `editAnchors` dep consumed by
 * `editAnchorsAction`.
 *
 * Default `editingId` is a heuristic: the first selected node with a polygon
 * pose, or `''` when nothing polygon-shaped is selected. Consumers driving
 * anchor-edit via explicit tool state should override the dep.
 *
 * `getPose(id)` returns the node's raw pose (actions narrow to PolygonPath).
 * `applyOps` delegates to the bridge adapter so edits are undoable.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';

interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

export function useEditAnchorsDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
): void {
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  useDepSource('editAnchors', (): EditAnchorsDep => {
    const sc = sceneRef.current;
    const s = selectionRef.current;
    const ad = adapterRef.current;
    const sel = s.current as NodeId[];
    let editingId: string | null = null;
    for (const id of sel) {
      const node = sc.get(id);
      if (node && (node.pose as { kind?: string })?.kind === 'polygon') {
        editingId = id;
        break;
      }
    }
    return {
      editingId: editingId ?? '',
      getPose(id: string) {
        return sc.get(id as NodeId)?.pose ?? null;
      },
      applyOps(ops, label) {
        ad.applyOps(ops as Op[], label);
      },
    };
  });
}
