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
import { anchorDataPatch } from 'features/paths/anchorData';
import { classifyPathStorage, resolveEditablePathOf, storeEditablePath } from 'features/paths/editablePath';
import { withoutShapeGenerator } from 'features/paths/shapeGenerator';
import { withoutGeometryBoundData, type PathEditExtension } from 'features/paths/pathEditExtension';
import { createPathEditState, isSelectedNode, type PathEditState } from 'features/paths/pathEditState';
import { recordModeSwitch, resolveParams, type ActionTunings } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { createSetDataOp } from 'core/ops/setData';

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
    const tool = effectiveId ? state.getTool() : null;
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
      tool,
      setTool(id) {
        if (!effectiveId) return;
        state.setTool(id);
      },
      ...pathAccess(sc, ad, state.getExtensions()),
    };
  });
}

/** `worldPath` finished by each of `extensions` in turn, and the data they
 *  set beside it; null when one cannot finish it. */
function finish(
  extensions: readonly PathEditExtension[],
  node: EditableNode,
  worldPath: PolygonPath,
  origins?: readonly (PointOrigin | null)[],
): { path: PolygonPath; data: Record<string, unknown> | null } | null {
  let path = worldPath;
  let data: Record<string, unknown> | null = null;
  for (const ext of extensions) {
    if (!ext.finishEdit) continue;
    const done = ext.finishEdit(node, path, origins);
    if (!done) return null;
    path = done.path;
    if (done.data) data = { ...(data ?? {}), ...done.data };
  }
  return { path, data };
}

/** The members of the dep that read the scene and commit to it. */
function pathAccess(
  sc: Scene<unknown, string, unknown>,
  ad: OpsApplier,
  extensions: readonly PathEditExtension[],
): Pick<EditAnchorsDep, 'getEditablePath' | 'getStorageKind' | 'getNodeShape' | 'applyEdit' | 'editOps' | 'finishEdit' | 'store'> {
  const editOps = (id: string, worldPath: unknown, label: string, origins?: readonly (PointOrigin | null)[]): Op[] => {
    const node = sc.get(id as NodeId) as EditableNode | undefined;
    if (!node) return [];
    const done = finish(extensions, node, worldPath as PolygonPath, origins);
    if (!done) return [];
    const before = origins ? resolveEditablePathOf(node) : null;
    const patch = { ...(before && origins ? anchorDataPatch(node.data, before, done.path, origins) : {}), ...done.data };
    return reshapeOps(id, node, done.path, label, Object.keys(patch).length > 0 ? patch : null);
  };
  return {
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
    applyEdit(id: string, worldPath: unknown, label: string, origins?: readonly (PointOrigin | null)[]) {
      const ops = editOps(id, worldPath, label, origins);
      if (ops.length > 0) ad.applyOps(ops, label);
    },
    editOps,
    finishEdit(id: string, worldPath: unknown, origins?: readonly (PointOrigin | null)[]) {
      const node = sc.get(id as NodeId) as EditableNode | undefined;
      if (!node) return worldPath;
      return finish(extensions, node, worldPath as PolygonPath, origins)?.path ?? null;
    },
    store(id, worldPath, label, data) {
      const node = sc.get(id as NodeId) as EditableNode | undefined;
      const ops = node ? reshapeOps(id, node, worldPath, label, data ?? null) : [];
      if (ops.length > 0) ad.applyOps(ops, label);
    },
  };
}

type EditableNode = { pose: unknown; data: unknown };

/** The ops that store `worldPath` where `node` keeps its polygon, with `patch` laid over its data. */
function reshapeOps(
  id: string,
  node: EditableNode,
  worldPath: PolygonPath,
  label: string,
  patch: Record<string, unknown> | null,
): Op[] {
  const next = storeEditablePath(node, worldPath);
  if (!next) return [];
  const reshape = createTransformOp({ id, from: node.pose, to: next.pose, label });
  // A path edited by hand is no longer what its generator or warp makes: it becomes plain geometry.
  // Its skin and constraints stay, renumbered by the caller's patch where it has one.
  const data = withoutGeometryBoundData(
    next.data === node.data ? node.data : withoutShapeGenerator(next.data), ['skin', 'constraints'],
  );
  if (data === node.data && !patch) return [reshape];
  return [reshape, createSetDataOp({ id, from: node.data, to: { ...(data as object), ...patch }, label })];
}
