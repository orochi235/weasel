/**
 * `useEditAnchorsDepSource` — wires the `editAnchors` dep.
 *
 * A node's editable polygon lives in one of two places: the pose itself
 * (`pose.kind === 'polygon'`), or `data.path` with a rect pose, stored pose-local.
 * `getEditablePath` returns it in **world coords** either way, and `applyEdit` commits in the
 * correct storage shape as one undoable batch, preserving the render invariant
 * `pathInWorld(stored, pose) === world`. Live previews ride the standard
 * `OngoingHandle.previewIds/Pose/Data` triple — this dep doesn't own preview state.
 */
import { useState } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { PolygonPath } from '@weasel-js/geom';
import { worldEditToStorage } from '@weasel-js/geom';
import { classifyPathStorage, resolveEditablePathOf } from 'features/paths/editablePath';
import { createPathEditState, type PathEditState } from 'features/paths/pathEditState';
import { recordModeSwitch } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { createSetDataOp } from 'core/ops/setData';

interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

/** The part of a `PathEditState` the dep reads and writes. */
export type EditAnchorsStateRef = Omit<PathEditState, 'subscribe' | 'getEditingIds'>;

export { resolveEditablePathOf };

/** Extra wiring for {@link useEditAnchorsDepSource}. */
export interface EditAnchorsDepOptions {
  /**
   * Whether the host currently permits anchor editing — whether the active mode allows the
   * `edits-anchors` capability.
   *
   * **Omit this when no mode registry is wired.** Absent means "no modality, so nothing
   * revokes edit mode"; a predicate built from an empty capability set would revoke edit
   * mode instantly.
   *
   * When supplied and it returns false, `editingId` reads as empty — the overlay stops
   * drawing, the anchors stop being hittable, and the anchor selection is dropped — so
   * leaving path-edit mode by ANY route tears down edit state.
   */
  anchorEditingAllowed?: () => boolean;
}

const EMPTY_ANCHOR_SELECTION: ReadonlySet<number> = new Set<number>();

export function useEditAnchorsDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
  externalState?: EditAnchorsStateRef,
  options?: EditAnchorsDepOptions,
): void {
  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);
  const adapterRef = useLatest(adapter);
  const allowedRef = useLatest(options?.anchorEditingAllowed);

  // A caller that shares the state with nothing else gets one of its own.
  const [ownState] = useState(createPathEditState);
  const stateRef = useLatest(externalState ?? ownState);

  useDepSource('editAnchors', (): EditAnchorsDep => {
    const sc = sceneRef.current;
    const ad = adapterRef.current;
    const s = selectionRef.current;
    const state = stateRef.current;
    let effectiveId = state.getEditingId();
    if (effectiveId) {
      const node = sc.get(effectiveId as NodeId);
      const inSelection = (s.current as NodeId[]).includes(effectiveId as NodeId);
      // A mode registry that no longer permits `edits-anchors` revokes
      // edit mode wholesale — see EditAnchorsDepOptions.anchorEditingAllowed.
      const permitted = allowedRef.current ? allowedRef.current() : true;
      if (!node || !inSelection || !permitted) effectiveId = '';
    }
    // Anchor selection and the marquee belong to one specific edited node, so never
    // hand them out alongside an empty id.
    const selectedAnchors = effectiveId ? state.getSelectedAnchors() : EMPTY_ANCHOR_SELECTION;
    const marquee = effectiveId ? state.getMarquee() : null;
    const editOps = (id: string, worldPath: unknown, label: string): Op[] => {
      const wp = worldPath as PolygonPath;
      const node = sc.get(id as NodeId);
      if (!node) return [];
      const storage = classifyPathStorage(node as { pose: unknown; data: unknown });
      if (!storage) return [];
      if (storage.kind === 'pose') return [createTransformOp({ id, from: node.pose, to: wp, label })];
      // The edited path arrives in world coords; invert it back to the unrotated stored
      // shape so `pose.rotation` is preserved and edits round-trip.
      const { pose: newPose, path: aligned } = worldEditToStorage(storage.pose, wp);
      return [
        createTransformOp({ id, from: node.pose, to: newPose, label }),
        createSetDataOp({ id, from: node.data, to: { ...(node.data as object), path: aligned }, label }),
      ];
    };
    return {
      editingId: effectiveId,
      setEditingId(id: string | null) {
        const next = id ?? '';
        if (effectiveId !== next) {
          recordModeSwitch(
            'editAnchors.editingId',
            effectiveId || null,
            next || null,
            next ? 'enter' : 'exit',
          );
          // Anchor indices only mean something relative to one path.
          state.setSelectedAnchors(EMPTY_ANCHOR_SELECTION);
          state.setMarquee(null);
        }
        stateRef.current.setEditingId(id);
      },
      selectedAnchors,
      setSelectedAnchors(next: Iterable<number>) {
        if (!effectiveId) return;
        state.setSelectedAnchors(new Set(next));
      },
      marquee,
      setMarquee(rect) {
        if (!effectiveId) return;
        state.setMarquee(rect);
      },
      getEditablePath(id: string): PolygonPath | null {
        const node = sc.get(id as NodeId);
        return resolveEditablePathOf(node as { pose: unknown; data: unknown });
      },
      getStorageKind(id: string): 'pose' | 'data' | null {
        const node = sc.get(id as NodeId);
        const storage = classifyPathStorage(node as { pose: unknown; data: unknown });
        return storage?.kind ?? null;
      },
      getNodeShape(id: string): { pose: unknown; data: unknown } | null {
        const node = sc.get(id as NodeId);
        if (!node) return null;
        return { pose: node.pose, data: node.data };
      },
      applyEdit(id: string, worldPath: unknown, label: string) {
        const ops = editOps(id, worldPath, label);
        if (ops.length > 0) ad.applyOps(ops, label);
      },
      editOps,
    };
  });
}
