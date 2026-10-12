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
import { useCallback, useState } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId, RectPose } from 'core/scene/types';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Path, PolygonPath } from '@weasel-js/geom';
import { pathInWorld, worldEditToStorage } from '@weasel-js/geom';
import { recordModeSwitch } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { createSetDataOp } from 'core/ops/setData';

interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

/** Shared state for the edit-mode `editingId`, for a consumer that reads it from a sibling
 *  component (e.g. the path-editing overlay layer). When omitted, the hook owns local state. */
export interface EditAnchorsStateRef {
  getEditingId(): string;
  setEditingId(id: string | null): void;
  /** Selected anchors (flat indices) for the node in `editingId`. */
  getSelectedAnchors(): ReadonlySet<number>;
  setSelectedAnchors(next: ReadonlySet<number>): void;
  /** In-flight anchor-marquee rect in world coords. */
  getMarquee(): { x: number; y: number; width: number; height: number } | null;
  setMarquee(rect: { x: number; y: number; width: number; height: number } | null): void;
}

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

/** Resolve where a node's editable polygon lives. Returns null when the
 *  node has neither a polygon pose nor a polygon on `data.path`. */
function classifyStorage(
  node: { pose: unknown; data: unknown } | undefined | null,
): { kind: 'pose' } | { kind: 'data'; pose: RectPose; data: { path: PolygonPath } } | null {
  if (!node) return null;
  const pose = node.pose as { kind?: string } | undefined;
  if (pose?.kind === 'polygon') return { kind: 'pose' };
  const data = node.data as { path?: Path } | null;
  if (data?.path && (data.path as { kind?: string }).kind === 'polygon' && isRectPose(node.pose)) {
    return {
      kind: 'data',
      pose: node.pose,
      data: data as { path: PolygonPath },
    };
  }
  return null;
}

/** A node's editable polygon in world coords. Does NOT consult any preview state —
 *  callers that want live state read in-flight handles themselves. */
export function resolveEditablePathOf(
  node: { pose: unknown; data: unknown } | undefined | null,
): PolygonPath | null {
  if (!node) return null;
  const storage = classifyStorage(node);
  if (!storage) return null;
  // Pose-as-polygon: the pose IS the polygon (polygon poses can't carry
  // rotation), so it's already world.
  if (storage.kind === 'pose') return (node as { pose: PolygonPath }).pose;
  // data.path: translate to the pose origin AND bake `pose.rotation`, so anchors render on
  // the rotated contour the renderer draws.
  return pathInWorld(storage.data.path, storage.pose) as PolygonPath;
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

  const [localEditingId, setLocalEditingIdState] = useState<string>('');
  const setLocalEditingId = useCallback((id: string | null) => {
    setLocalEditingIdState(id ?? '');
  }, []);
  const externalRef = useLatest(externalState);
  const setLocalEditingIdRef = useLatest(setLocalEditingId);

  const readEditingId = (): string => {
    return externalRef.current ? externalRef.current.getEditingId() : localEditingId;
  };

  useDepSource('editAnchors', (): EditAnchorsDep => {
    const sc = sceneRef.current;
    const ad = adapterRef.current;
    const s = selectionRef.current;
    const ext = externalRef.current;
    let effectiveId = readEditingId();
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
    const selectedAnchors = effectiveId
      ? (ext?.getSelectedAnchors() ?? EMPTY_ANCHOR_SELECTION)
      : EMPTY_ANCHOR_SELECTION;
    const marquee = effectiveId ? (ext?.getMarquee() ?? null) : null;
  const editOps = (id: string, worldPath: unknown, label: string): Op[] => {
      const wp = worldPath as PolygonPath;
      const node = sc.get(id as NodeId);
      if (!node) return [];
      const storage = classifyStorage(node as { pose: unknown; data: unknown });
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
          ext?.setSelectedAnchors(EMPTY_ANCHOR_SELECTION);
          ext?.setMarquee(null);
        }
        if (externalRef.current) externalRef.current.setEditingId(id);
        else setLocalEditingIdRef.current(id);
      },
      selectedAnchors,
      setSelectedAnchors(next: Iterable<number>) {
        if (!effectiveId) return;
        ext?.setSelectedAnchors(new Set(next));
      },
      marquee,
      setMarquee(rect) {
        if (!effectiveId) return;
        ext?.setMarquee(rect);
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
        const ops = editOps(id, worldPath, label);
        if (ops.length > 0) ad.applyOps(ops, label);
      },
      editOps,
    };
  });
}
