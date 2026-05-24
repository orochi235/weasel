/**
 * `useEditAnchorsDepSource` — wires the `editAnchors` dep consumed by
 * `editAnchorsAction`.
 *
 * `editingId` is explicit, not implied by selection: it's set by
 * `enterPathEditAction` (double-click) or cleared by `exitPathEditAction`
 * (Escape, or click on empty). Consumers can also call `setEditingId`
 * directly to drive edit mode programmatically.
 *
 * `getPose(id)` returns the node's raw pose (actions narrow to PolygonPath).
 * `applyOps` delegates to the bridge adapter so edits are undoable.
 */
import { useCallback, useRef, useState } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';

interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

/** Optional shared state for the edit-mode `editingId`. Pass when the
 *  consumer needs to read the current editingId from a sibling component
 *  (e.g. the path-editing overlay layer rendered above SceneCanvas's
 *  child where the dep is published). When omitted, the hook owns its
 *  own local state. */
export interface EditAnchorsStateRef {
  getEditingId(): string;
  setEditingId(id: string | null): void;
}

export function useEditAnchorsDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
  externalState?: EditAnchorsStateRef,
): void {
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  // Local fallback state. When the caller supplies `externalState`, the
  // local state is unused and the hook delegates reads/writes through the
  // ref. Keeping both branches lets simple consumers wire just the three
  // required args while richer consumers (SceneCanvas) coordinate edit
  // mode across multiple subtrees.
  const [localEditingId, setLocalEditingIdState] = useState<string>('');
  const setLocalEditingId = useCallback((id: string | null) => {
    setLocalEditingIdState(id ?? '');
  }, []);
  const externalRef = useRef(externalState);
  externalRef.current = externalState;
  const setLocalEditingIdRef = useRef(setLocalEditingId);
  setLocalEditingIdRef.current = setLocalEditingId;

  const readEditingId = (): string => {
    return externalRef.current ? externalRef.current.getEditingId() : localEditingId;
  };

  useDepSource('editAnchors', (): EditAnchorsDep => {
    const sc = sceneRef.current;
    const ad = adapterRef.current;
    const s = selectionRef.current;
    let effectiveId = readEditingId();
    // Validate: if the current editing target is gone (deleted) or no longer
    // selected, present a cleared editingId. Don't mutate state here (would
    // re-render inside a render).
    if (effectiveId) {
      const node = sc.get(effectiveId as NodeId);
      const inSelection = (s.current as NodeId[]).includes(effectiveId as NodeId);
      if (!node || !inSelection) effectiveId = '';
    }
    return {
      editingId: effectiveId,
      setEditingId(id: string | null) {
        if (externalRef.current) externalRef.current.setEditingId(id);
        else setLocalEditingIdRef.current(id);
      },
      getPose(id: string) {
        return sc.get(id as NodeId)?.pose ?? null;
      },
      applyOps(ops, label) {
        ad.applyOps(ops as Op[], label);
      },
    };
  });
}
