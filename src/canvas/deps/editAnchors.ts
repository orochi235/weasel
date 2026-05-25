/**
 * `useEditAnchorsDepSource` — wires the `editAnchors` dep consumed by
 * `editAnchorsAction`, `enterPathEditAction`, `exitPathEditAction`, and
 * `insertPathAnchorAction`.
 *
 * `editingId` is explicit, set by `enterPathEditAction` (double-click)
 * and cleared by `exitPathEditAction` (Escape, or when the target leaves
 * the selection / is deleted).
 *
 * `getEditablePath(id)` returns the COMMITTED polygon in **world coords**,
 * regardless of where it's stored:
 *   - `node.pose.kind === 'polygon'` → pose IS the polygon (bezier-edit
 *     demo and similar pose-as-polygon consumers).
 *   - `node.data.path` is a polygon → kit pen-tool default. Polygon's
 *     stored coords are pose-local (aligned to pose origin); we project
 *     to world via `pathAtPose`.
 *
 * `getStorageKind(id)` returns where the polygon lives (`'pose'` /
 * `'data'` / `null`). Actions use this to emit the right preview-ghost
 * axes: `previewPose` only for pose-as-polygon, `previewPose +
 * previewData` for data.path.
 *
 * `applyEdit(id, worldPath, label)` commits in the correct storage shape.
 * Pose-as-polygon writes via `scene.setPose`; data.path writes a batched
 * setPose (new bounds) + scene.update({data}) (re-aligned local path) so
 * the kit's render invariant (`pathAtPose(stored, pose) === world`) is
 * preserved.
 *
 * Live previews ride the standard `OngoingHandle.previewIds/Pose/Data`
 * triple — this dep doesn't own preview state.
 */
import { useCallback, useRef, useState } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Path, PolygonPath } from 'features/paths/types';
import { boundsOfPath } from 'features/paths/bounds';
import { translatePath } from 'features/paths/transform';
import { pathAtPose } from 'canvas/shapePainters';
import { recordModeSwitch } from 'interactions/dispatcher/dispatcher';

interface OpsApplier {
  applyOps(ops: { apply(adapter: unknown): void }[], label?: string): void;
}

/** Optional shared state for the edit-mode `editingId`. Pass when the
 *  consumer needs to read the current editingId from a sibling component
 *  (e.g. the path-editing overlay layer rendered above the SceneCanvas
 *  subtree where the dep is published). When omitted, the hook owns
 *  local state. */
export interface EditAnchorsStateRef {
  getEditingId(): string;
  setEditingId(id: string | null): void;
}

interface RectPoseShape { x: number; y: number; width: number; height: number }

/** Resolve where a node's editable polygon lives. Returns null when the
 *  node has neither a polygon pose nor a polygon on `data.path`. */
function classifyStorage(
  node: { pose: unknown; data: unknown } | undefined | null,
): { kind: 'pose' } | { kind: 'data'; pose: RectPoseShape; data: { path: PolygonPath } } | null {
  if (!node) return null;
  const pose = node.pose as { kind?: string } | undefined;
  if (pose?.kind === 'polygon') return { kind: 'pose' };
  const data = node.data as { path?: Path } | null;
  if (data?.path && (data.path as { kind?: string }).kind === 'polygon') {
    return {
      kind: 'data',
      pose: node.pose as RectPoseShape,
      data: data as { path: PolygonPath },
    };
  }
  return null;
}

/** Resolve a node's editable polygon in world coords. Shared between the
 *  dep source and SceneCanvas's chrome wiring so both apply the same
 *  "pose IS the polygon vs data.path with rect pose" routing. Does NOT
 *  consult any preview state — callers that want live state read
 *  in-flight handles themselves. */
export function resolveEditablePathOf(
  node: { pose: unknown; data: unknown } | undefined | null,
): PolygonPath | null {
  if (!node) return null;
  const storage = classifyStorage(node);
  if (!storage) return null;
  if (storage.kind === 'pose') return (node as { pose: PolygonPath }).pose;
  return pathAtPose(storage.data.path, storage.pose) as PolygonPath;
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
    if (effectiveId) {
      const node = sc.get(effectiveId as NodeId);
      const inSelection = (s.current as NodeId[]).includes(effectiveId as NodeId);
      if (!node || !inSelection) effectiveId = '';
    }
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
        }
        if (externalRef.current) externalRef.current.setEditingId(id);
        else setLocalEditingIdRef.current(id);
      },
      getEditablePath(id: string): PolygonPath | null {
        const node = sc.get(id as NodeId);
        return resolveEditablePathOf(node as { pose: unknown; data: unknown });
      },
      getStorageKind(id: string): 'pose' | 'data' | null {
        const node = sc.get(id as NodeId);
        const storage = classifyStorage(node as { pose: unknown; data: unknown });
        return storage?.kind ?? null;
      },
      getNodeShape(id: string): { pose: unknown; data: unknown } | null {
        const node = sc.get(id as NodeId);
        if (!node) return null;
        return { pose: node.pose, data: node.data };
      },
      applyEdit(id: string, worldPath: unknown, label: string) {
        const wp = worldPath as PolygonPath;
        const node = sc.get(id as NodeId);
        if (!node) return;
        const storage = classifyStorage(node as { pose: unknown; data: unknown });
        if (!storage) return;
        if (storage.kind === 'pose') {
          ad.applyOps(
            [{ apply: (a: unknown) => (a as { setPose: (id: string, p: unknown) => void }).setPose(id, wp) }],
            label,
          );
        } else {
          const bounds = boundsOfPath(wp);
          const aligned = translatePath(wp, -bounds.x, -bounds.y) as PolygonPath;
          const newPose: RectPoseShape = {
            ...storage.pose,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          };
          const newData = { ...(node.data as object), path: aligned };
          ad.applyOps(
            [
              {
                apply: (a: unknown) => {
                  const ad2 = a as { setPose: (id: string, p: unknown) => void };
                  ad2.setPose(id, newPose);
                  sceneRef.current.update(id as NodeId, { data: newData as never });
                },
              },
            ],
            label,
          );
        }
      },
    };
  });
}
