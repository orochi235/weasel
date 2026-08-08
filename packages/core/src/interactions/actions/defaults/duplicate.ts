import type { Action } from '../registry';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { freshNodeId } from './freshNodeId';
import { requiresSelection } from './requiresSelection';

/** Same nudge `sceneToAdapter.getPasteOffset` gives a paste, so duplicate and
 *  paste land in the same place rather than disagreeing by a few units. */
const DUPLICATE_OFFSET = 12;

function translatePose(pose: unknown, dx: number, dy: number): unknown {
  const p = pose as Record<string, unknown>;
  return { ...p, x: ((p['x'] as number) ?? 0) + dx, y: ((p['y'] as number) ?? 0) + dy };
}

/** True when any ancestor of `id` is also in `set` — that ancestor's copy
 *  already brings this node along, so duplicating it again would double it. */
function hasSelectedAncestor(
  scene: Scene<unknown, string, unknown>,
  id: NodeId,
  set: ReadonlySet<string>,
): boolean {
  let parent = scene.get(id)?.parent ?? null;
  while (parent != null) {
    if (set.has(parent)) return true;
    parent = scene.get(parent)?.parent ?? null;
  }
  return false;
}

/**
 * Copy `id`'s whole subtree, appending one insert op per node in pre-order so
 * a parent always exists before its children are inserted. Returns the new
 * root's id.
 *
 * `offsetDescendants` is false for local-pose consumers (those that registered
 * a `poseComposition`): a child's pose is relative there, so offsetting the
 * root already carries the subtree, and offsetting again would double it. With
 * the default absolute poses every node stores world coords and every one
 * moves.
 */
function copySubtree(
  scene: Scene<unknown, string, unknown>,
  id: NodeId,
  parent: NodeId | null,
  offset: { dx: number; dy: number },
  offsetDescendants: boolean,
  ops: Op[],
): NodeId | null {
  const node = scene.get(id);
  if (!node) return null;
  const newId = freshNodeId();
  const copy = {
    ...node,
    id: newId,
    pose: translatePose(node.pose, offset.dx, offset.dy),
    parent,
  } as Node<unknown, string, unknown>;
  ops.push(createInsertOp<Node<unknown, string, unknown>>({ node: copy, label: 'Duplicate' }));
  const childOffset = offsetDescendants ? offset : { dx: 0, dy: 0 };
  for (const child of scene.childrenOf(id)) {
    copySubtree(scene, child, newId, childOffset, offsetDescendants, ops);
  }
  return newId;
}

/**
 * @experimental
 * Static descriptor for the `duplicate` Action. Copies each selected node —
 * with its subtree, so duplicating a group produces a populated group — offset
 * by a small nudge, as one undoable batch, then selects the copies.
 */
export const duplicateAction: Action & { requires: string[] } = {
  id: 'duplicate',
  label: 'Duplicate',
  defaultBinding: { kind: 'key', key: 'd', mods: { mod: true } },
  eligible: { capability: ['edits-page', 'creates-selection'] },
  // `selection` is read by the `enabled` gate as well as the invoker. An
  // undeclared read throws inside the dev-build deps Proxy before the gate can
  // answer, which is how this action spent a while doing nothing at all.
  requires: ['scene', 'selection', 'applyOps', 'poseComposition'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
      if (!selection || !scene) return;
      const ids = selection.get();
      if (ids.length === 0) return;

      const set = new Set<string>(ids);
      const offset = { dx: DUPLICATE_OFFSET, dy: DUPLICATE_OFFSET };
      const ops: Op[] = [];
      const newIds: NodeId[] = [];
      for (const id of ids) {
        const nid = asNodeId(id);
        const node = scene.get(nid);
        if (!node) continue;
        if (hasSelectedAncestor(scene, nid, set)) continue;
        const newId = copySubtree(scene, nid, node.parent ?? null, offset, deps.poseComposition === undefined, ops);
        if (newId) newIds.push(newId);
      }

      if (ops.length === 0) return;
      if (applyOps) applyOps(ops, 'Duplicate');
      else scene.applyBatch(ops, 'Duplicate', defaultCommitAdapter(scene));
      selection.set(newIds);
    },
  },
  enabled: requiresSelection,
};
