/**
 * `useEditAnchorsDepSource` — wires the `editAnchors` dep.
 *
 * A node's editable polygon lives in one of two places: the pose itself
 * (`pose.kind === 'polygon'`), or `data.path` with a rect pose, stored pose-local.
 * `getEditablePath` returns it in **world coords** either way, and `applyEdit` commits in the
 * correct storage shape as one undoable batch, preserving the render invariant
 * `pathInWorld(stored, pose) === world`. A node with a `data.skin` has it renumbered in that
 * batch when the caller says where the points came from, and its `data.constraints` made to hold and
 * renumbered the same way. Live previews ride the standard
 * `OngoingHandle.previewIds/Pose/Data` triple — this dep doesn't own preview state.
 */
import { useState } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { EditAnchorsDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { PathConstraint, PointOrigin, PolygonPath } from '@weasel-js/geom';
import type { Skin } from '@weasel-js/animator';
import { remapSkin } from '../../animation/rig/skinBinding';
import { classifyPathStorage, resolveEditablePathOf, storeEditablePath } from 'features/paths/editablePath';
import { withoutShapeGenerator } from 'features/paths/shapeGenerator';
import { constrainNodeEdit, constraintsOf, solveNodeConstraints } from 'features/paths/pathConstraints';
import { createPathEditState, isSelectedNode, type PathEditState } from 'features/paths/pathEditState';
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

const EMPTY_ANCHOR_SELECTION: ReadonlySet<number> = new Set<number>();

export function useEditAnchorsDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  adapter: OpsApplier,
  externalState?: EditAnchorsStateRef,
): void {
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
    const editOps = (id: string, worldPath: unknown, label: string, origins?: readonly (PointOrigin | null)[]): Op[] => {
      const node = sc.get(id as NodeId) as EditableNode | undefined;
      if (!node) return [];
      const solved = constrainNodeEdit(node, worldPath as PolygonPath, origins);
      if (!solved) return [];
      const skin = (node.data as { skin?: Skin } | null)?.skin;
      const patch = {
        ...(skin && origins ? { skin: remapSkin(skin, origins) } : {}),
        ...(solved.constraints !== constraintsOf(node.data) ? { constraints: solved.constraints } : {}),
      };
      return reshapeOps(id, node, solved.path, label, Object.keys(patch).length > 0 ? patch : null);
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
      applyEdit(id: string, worldPath: unknown, label: string, origins?: readonly (PointOrigin | null)[]) {
        const ops = editOps(id, worldPath, label, origins);
        if (ops.length > 0) ad.applyOps(ops, label);
      },
      editOps,
      constrainEdit(id: string, worldPath: unknown, origins?: readonly (PointOrigin | null)[]) {
        const node = sc.get(id as NodeId) as EditableNode | undefined;
        return constrainNodeEdit(node, worldPath as PolygonPath, origins)?.path ?? null;
      },
      setConstraints(id: string, constraints: readonly PathConstraint[], label: string) {
        const node = sc.get(id as NodeId) as EditableNode | undefined;
        const solved = solveNodeConstraints(node, constraints);
        if (!node || !solved) return [];
        const ops = reshapeOps(id, node, solved.path, label, { constraints: [...constraints] });
        if (ops.length > 0) ad.applyOps(ops, label);
        return solved.unsatisfied;
      },
    };
  });
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
  // A path edited by hand is no longer what its generator makes: it becomes plain geometry.
  const data = next.data === node.data ? node.data : withoutShapeGenerator(next.data);
  if (data === node.data && !patch) return [reshape];
  return [reshape, createSetDataOp({ id, from: node.data, to: { ...(data as object), ...patch }, label })];
}
