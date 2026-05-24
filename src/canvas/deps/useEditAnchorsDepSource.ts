/**
 * `useEditAnchorsDepSource` — wires the `editAnchors` dep consumed by
 * `editAnchorsAction`, `enterPathEditAction`, `exitPathEditAction`, and
 * `insertPathAnchorAction`.
 *
 * `editingId` is explicit, set by `enterPathEditAction` (double-click)
 * and cleared by `exitPathEditAction` (Escape, or when the target leaves
 * the selection / is deleted).
 *
 * `getEditablePath(id)` returns the editable polygon in **world coords**,
 * regardless of where it's stored:
 *   - `node.pose.kind === 'polygon'` → pose IS the polygon (bezier-edit
 *     demo and similar pose-as-polygon consumers).
 *   - `node.data.path` is a polygon → kit pen-tool default. Polygon's
 *     stored coords are pose-local (aligned to pose origin); we project
 *     to world via `pathAtPose`.
 *
 * `applyEdit(id, worldPath, label)` commits in the correct storage shape.
 * Pose-as-polygon writes via `scene.setPose`; data.path writes a batched
 * setPose (new bounds) + scene.update({data}) (re-aligned local path) so
 * the kit's render invariant (`pathAtPose(stored, pose) === world`) is
 * preserved.
 *
 * `setPreviewPath(id, worldPath | null)` holds an uncommitted preview
 * that `getEditablePath` returns ahead of committed storage. Lets the
 * chrome layer reflect live drag state without dispatcher previewPose
 * support (which only carries `pose`, not `data.path` updates).
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

/** Optional shared state for the edit-mode `editingId` and the in-flight
 *  preview polygon. Pass when the consumer needs to read both from a
 *  sibling component (e.g. the path-editing overlay layer rendered above
 *  the SceneCanvas subtree where the dep is published). When omitted,
 *  the hook owns local state for both. */
export interface EditAnchorsStateRef {
  getEditingId(): string;
  setEditingId(id: string | null): void;
  getPreviewPath(id: string): PolygonPath | null;
  setPreviewPath(id: string, worldPath: PolygonPath | null): void;
}

/** Resolve a node's editable polygon in world coords. Shared between the
 *  dep source and SceneCanvas's chrome wiring so both apply the same
 *  "pose IS the polygon vs data.path with rect pose" routing. */
export function resolveEditablePathOf(
  node: { pose: unknown; data: unknown } | undefined | null,
): PolygonPath | null {
  if (!node) return null;
  const pose = node.pose as { kind?: string } | undefined;
  if (pose?.kind === 'polygon') return node.pose as PolygonPath;
  const data = node.data as { path?: Path } | null;
  if (data?.path && (data.path as { kind?: string }).kind === 'polygon') {
    return pathAtPose(data.path, node.pose as RectPoseShape) as PolygonPath;
  }
  return null;
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

  // Local preview state (used only when no externalState is provided).
  // Ref-only — no re-renders per pointermove; the canvas already repaints
  // each frame during a drag because the dispatcher pumps requestRedraw.
  const localPreviewRef = useRef<{ id: string; worldPath: PolygonPath } | null>(null);

  const readEditingId = (): string => {
    return externalRef.current ? externalRef.current.getEditingId() : localEditingId;
  };
  const readPreviewPath = (id: string): PolygonPath | null => {
    if (externalRef.current) return externalRef.current.getPreviewPath(id);
    const p = localPreviewRef.current;
    return p && p.id === id ? p.worldPath : null;
  };
  const writePreviewPath = (id: string, worldPath: PolygonPath | null): void => {
    if (externalRef.current) {
      externalRef.current.setPreviewPath(id, worldPath);
    } else if (worldPath == null) {
      localPreviewRef.current = null;
    } else {
      localPreviewRef.current = { id, worldPath };
    }
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
        // Clear any stale preview when edit mode changes targets.
        writePreviewPath(effectiveId, null);
      },
      getEditablePath(id: string): PolygonPath | null {
        // Live preview wins — chrome and inspectors see in-flight state.
        const preview = readPreviewPath(id);
        if (preview) return preview;
        const node = sc.get(id as NodeId);
        return resolveEditablePathOf(node as { pose: unknown; data: unknown });
      },
      setPreviewPath(id: string, worldPath: unknown | null) {
        writePreviewPath(id, worldPath as PolygonPath | null);
      },
      applyEdit(id: string, worldPath: unknown, label: string) {
        const wp = worldPath as PolygonPath;
        const node = sc.get(id as NodeId);
        if (!node) return;
        const storage = classifyStorage(node as { pose: unknown; data: unknown });
        if (!storage) return;
        // Apply through the adapter's batched ops surface so the edit
        // lands as one undo entry.
        if (storage.kind === 'pose') {
          // Polygon IS the pose — write it directly via scene.setPose.
          ad.applyOps(
            [{ apply: (a: unknown) => (a as { setPose: (id: string, p: unknown) => void }).setPose(id, wp) }],
            label,
          );
        } else {
          // data.path case: re-align to pose. The new polygon has world-
          // coord anchors; compute the new bounds, set pose to those,
          // and store path translated to pose-local space so the render
          // invariant `pathAtPose(stored, pose) === world` holds.
          const bounds = boundsOfPath(wp);
          const aligned = translatePath(wp, -bounds.x, -bounds.y) as PolygonPath;
          const newPose: RectPoseShape = {
            ...storage.pose,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          };
          const oldData = storage.data;
          const newData = { ...(node!.data as object), path: aligned };
          ad.applyOps(
            [
              {
                apply: (a: unknown) => {
                  const ad2 = a as {
                    setPose: (id: string, p: unknown) => void;
                  };
                  ad2.setPose(id, newPose);
                  // The bridge adapter doesn't expose a setData primitive;
                  // commit directly via the scene so the change rides
                  // inside the same scene.batch(label) the bridge opens.
                  sceneRef.current.update(id as NodeId, { data: newData as never });
                },
              },
            ],
            label,
          );
          void oldData;
        }
        // Edit committed — drop the preview.
        writePreviewPath(id, null);
      },
    };
  });
}
