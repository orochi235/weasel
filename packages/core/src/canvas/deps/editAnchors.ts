/**
 * `useEditAnchorsDepSource` — wires the `editAnchors` dep.
 *
 * A node's editable polygon lives in one of two places: the pose itself
 * (`pose.kind === 'polygon'`), or `data.path` with a rect pose, stored pose-local.
 * `getEditablePath` returns it in **world coords** either way, and `applyEdit` commits in the
 * correct storage shape as one undoable batch, preserving the render invariant
 * `pathInWorld(stored, pose) === world`. What the node keeps per anchor — a `data.skin`, vertex
 * colors — is renumbered in that batch when the caller says where the points came from, and each path-edit extension finishes
 * the edit first (`PathEditExtension.finishEdit`). Live previews ride the standard
 * `OngoingHandle.previewIds/Pose/Data` triple — this dep doesn't own preview state.
 */
import { useState } from 'react';
import { useDepRegistry, useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import { locksOf, type EditAnchorsParams } from 'interactions/actions/edit-anchors/params';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { PointOrigin, PolygonPath } from '@weasel-js/geom';
import { anchorDataPatch } from 'domains/paths/anchorData';
import { classifyPathStorage, pathEditPathOf, resolveEditablePathOf } from 'domains/paths/editablePath';
import { representationOf } from 'domains/paths/pathRepresentation';
import type { PathEditExtension } from 'domains/paths/pathEditExtension';
import {
  finishCtx, finishEdit, otherOps, pathEditFollower, reshapeOps, type EditableNode,
} from './pathEditCommits';
import { useTransformFollower } from './transformFollowers';
import { createPathEditState, isSelectedNode, type PathEditState } from 'domains/paths/pathEditState';
import { resolveParams, type ActionTunings } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';

interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

/** The part of a `PathEditState` the dep reads and writes. */
export type EditAnchorsStateRef = Omit<PathEditState, 'subscribe' | 'getEditingIds' | 'setExtensions'>;
/** The same, with the change notice chrome reading the dep waits on. */
export type EditAnchorsStateSource = EditAnchorsStateRef & Partial<Pick<PathEditState, 'subscribe'>>;

export { resolveEditablePathOf };

function tunedHandleLock(tune: ActionTunings | undefined): EditAnchorsParams['handleLock'] {
  const params = resolveParams(tune?.editAnchors?.params as Parameters<typeof resolveParams>[0]);
  return (params as EditAnchorsParams | undefined)?.handleLock;
}

const EMPTY_ANCHOR_SELECTION: ReadonlySet<number> = new Set<number>();

/**
 * Publish the `editAnchors` dep for `scene`: its path access and commits
 * through `adapter`, and the edit state of `externalState` (or one of its
 * own), with the extensions that state holds finishing every edit.
 */
export function useEditAnchorsDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
  externalState?: EditAnchorsStateRef,
  /** `<SceneCanvas tune>`: the handle locks start from its `editAnchors`
   *  `handleLock` param until a toggle sets them. */
  tune?: ActionTunings,
): void {
  const registry = useDepRegistry();
  const tuneRef = useLatest(tune);
  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);
  const adapterRef = useLatest(adapter);

  // A caller that shares the state with nothing else gets one of its own.
  const [ownState] = useState(() => createPathEditState({
    isSelectedNode: (id) => isSelectedNode(sceneRef.current, selectionRef.current, id),
  }));
  const stateRef = useLatest(externalState ?? ownState);

  useDepSource('editAnchors', (): EditAnchorsDep => {
    const sc = sceneRef.current;
    const ad = adapterRef.current;
    const state = stateRef.current;
    const effectiveId = state.getEditingId();
    // Anchor selection and the marquee belong to one specific edited node, so never
    // hand them out alongside an empty id.
    const selectedAnchors = effectiveId ? state.getSelectedAnchors() : EMPTY_ANCHOR_SELECTION;
    const marquee = effectiveId ? state.getMarquee() : null;
    return {
      editingId: effectiveId,
      setEditingId(id: string | null) {
        const next = id ?? '';
        if (effectiveId !== next) {
          registry.get('dispatchTrace')?.recordModeSwitch(
            'editAnchors.editingId',
            effectiveId || null,
            next || null,
            next ? 'enter' : 'exit',
          );
          // Anchor indices only mean something relative to one path.
          state.setSelectedAnchors(EMPTY_ANCHOR_SELECTION);
          state.setSelectedMark(null);
          state.setMarquee(null);
        }
        stateRef.current.setEditingId(id);
      },
      selectedAnchors,
      setSelectedAnchors(next: Iterable<number>) {
        if (!effectiveId) return;
        const set = new Set(next);
        if (set.size > 0) state.setSelectedMark(null);
        state.setSelectedAnchors(set);
      },
      selectedMark: effectiveId ? state.getSelectedMark() : null,
      setSelectedMark(mark) {
        if (!effectiveId) return;
        if (mark !== null) state.setSelectedAnchors(EMPTY_ANCHOR_SELECTION);
        state.setSelectedMark(mark);
      },
      extensions: state.getExtensions(),
      marquee,
      setMarquee(rect) {
        if (!effectiveId) return;
        state.setMarquee(rect);
      },
      handleLocks: state.getHandleLocks() ?? locksOf(tunedHandleLock(tuneRef.current)),
      setHandleLocks(next) {
        state.setHandleLocks(next);
        registry.changed?.();
      },
      ...pathAccess(sc, ad, state.getExtensions()),
    };
  });
  useTransformFollower(() => pathEditFollower(sceneRef.current, stateRef.current.getExtensions()));
}

/** The members of the dep that read the scene and commit to it. */
function pathAccess(
  sc: Scene<unknown, string, unknown>,
  ad: OpsApplier,
  extensions: readonly PathEditExtension[],
): Pick<
  EditAnchorsDep,
  | 'getEditablePath' | 'getOutlinePath' | 'getStorageKind' | 'getNodeShape' | 'applyEdit' | 'editOps' | 'finishEdit'
  | 'store'
> {
  const editOps = (id: string, worldPath: unknown, label: string, origins?: readonly (PointOrigin | null)[]): Op[] => {
    const node = sc.get(id as NodeId) as EditableNode | undefined;
    if (!node) return [];
    const done = finishEdit(extensions, node, worldPath as PolygonPath, origins, finishCtx(sc, id, extensions));
    if (!done) return [];
    // A form's origins number the anchors of its edit path, not data.path's.
    const before = origins && !representationOf(extensions, node.data) ? resolveEditablePathOf(node) : null;
    const patch = { ...(before && origins ? anchorDataPatch(node.data, before, done.path, origins) : {}), ...done.data };
    return [
      ...reshapeOps(id, node, done.path, label, Object.keys(patch).length > 0 ? patch : null, extensions),
      ...otherOps(sc, done.others, label, extensions),
    ];
  };
  return {
    getEditablePath(id: string): PolygonPath | null {
      const node = sc.get(id as NodeId);
      return pathEditPathOf(node as { pose: unknown; data: unknown }, extensions);
    },
    getOutlinePath(id: string): PolygonPath | null {
      return resolveEditablePathOf(sc.get(id as NodeId) as { pose: unknown; data: unknown });
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
    applyEdit(id: string, worldPath: unknown, label: string, origins?: readonly (PointOrigin | null)[]) {
      const ops = editOps(id, worldPath, label, origins);
      if (ops.length > 0) ad.applyOps(ops, label);
    },
    editOps,
    finishEdit(id: string, worldPath: unknown, origins?: readonly (PointOrigin | null)[]) {
      const node = sc.get(id as NodeId) as EditableNode | undefined;
      if (!node) return { path: worldPath, others: [] };
      const done = finishEdit(extensions, node, worldPath as PolygonPath, origins, finishCtx(sc, id, extensions));
      if (!done) return null;
      const others = [...done.others.values()].flatMap((o) => (o.path && !o.remove ? [{ id: o.id, path: o.path }] : []));
      return { path: done.path, others };
    },
    store(id, worldPath, label, data) {
      const node = sc.get(id as NodeId) as EditableNode | undefined;
      const ops = node ? reshapeOps(id, node, worldPath, label, data ?? null, extensions) : [];
      if (ops.length > 0) ad.applyOps(ops, label);
    },
  };
}
