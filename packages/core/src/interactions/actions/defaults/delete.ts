import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createDeleteOp } from 'core/ops/delete';
import { commitOps } from '../defaultCommitAdapter';
import { ActionDisabledReason, type Action, type ActionDeps } from '@weasel-js/routing';
import { requiresSelection } from './requiresSelection';
import { reachesLocked } from './lockedReach';
import { icon } from '../../../icons.gen';
import { hiddenSourcesTakenWith } from 'domains/pathEffects/hiddenSources';
import { withoutPageStructure } from 'core/scene/nodeGates';
import { BETWEEN_GESTURES } from '@weasel-js/routing';

/** `id`'s slot among the scene roots or its parent's children, or `-1`. */
function hostIndex(scene: Scene<unknown, string, unknown>, id: NodeId): number {
  const node = scene.get(id);
  const siblings = node?.parent == null ? scene.roots : scene.childrenOf(node.parent);
  return siblings.indexOf(id);
}

/** Options for {@link buildDeleteOps}. */
export interface BuildDeleteOptions {
  /** Also delete the sources a path effect with `hideSources` among `ids` hid,
   *  where nothing staying reads them — what Delete and Cut do. */
  takeHiddenSources?: boolean;
}

/**
 * Delete ops for the sources a removal of `ids` takes with it (see
 * `hiddenSourcesTakenWith`), for an action whose own ops remove `ids` some
 * other way. Append them after those ops: a delete finds its slot as it runs.
 * Sources in `keep` stay.
 */
export function hiddenSourceDeleteOps(
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  label: string,
  keep?: ReadonlySet<NodeId>,
): Op[] {
  return buildDeleteOps(scene, hiddenSourcesTakenWith(scene, ids, keep), label);
}

/**
 * Delete ops for `ids`, in the order given. Each op captures the node and its
 * host-array index BEFORE any removal, so `invert()` re-inserts at the right
 * slot and undo restores paint order. Ids with no live node are skipped.
 *
 * A page or the page run is skipped: pages are removed through the page API.
 *
 * Ids an already-emitted op will take are skipped: `removeNode` cascades both
 * the subtree and the dependents, so a second op for a node the first has taken
 * would throw `unknown node id` mid-batch — escaping the batch with the scene
 * already mutated. Selecting a container and its members does this.
 *
 * The covered set grows from the ops already emitted, not from the whole
 * selection, which is what settles a cycle: two ids that reach each other each
 * cover the other, and filtering both would delete nothing. So which ids
 * survive depends on their order, and the ops are a cover of the selection
 * rather than its minimal set of roots.
 */
export function buildDeleteOps(
  scene: Scene<unknown, string, unknown>,
  ids: readonly string[],
  label: string,
  opts: BuildDeleteOptions = {},
): Op[] {
  const all = deleteTargets(scene, ids, opts);
  const covered = new Set<string>();
  const ops: Op[] = [];
  for (const id of all) {
    const node = scene.get(id as NodeId);
    if (!node) continue;
    if (covered.has(id)) continue;
    for (const taken of scene.removalClosure([id as NodeId])) covered.add(taken);
    ops.push(createDeleteOp<Node<unknown, string, unknown>>({
      node,
      index: hostIndex(scene, id as NodeId),
      label,
    }));
  }
  return ops;
}

/** What {@link buildDeleteOps} deletes for `ids`: less page structure, plus the hidden sources when asked. */
function deleteTargets(scene: Scene<unknown, string, unknown>, ids: readonly string[], opts: BuildDeleteOptions): readonly string[] {
  const own = withoutPageStructure(scene, ids);
  return opts.takeHiddenSources ? [...own, ...hiddenSourcesTakenWith(scene, own as readonly NodeId[])] : own;
}

/** Whether deleting `ids` as Delete does would remove a locked node, which disables it (ruled 2026-11-09): a
 *  selected group holding a locked child, or a node a locked one derives from. */
function deleteReachesLocked(deps: ActionDeps, ids: readonly NodeId[]): boolean {
  const scene = deps.scene;
  return scene ? reachesLocked(scene, deleteTargets(scene, ids, { takeHiddenSources: true }) as readonly NodeId[]) : false;
}

/** Delete's `enabled`, and Cut's: a selection, none of whose removal would take a locked node. */
export function deleteEnabled(deps?: ActionDeps): true | ActionDisabledReason {
  const needs = requiresSelection(deps);
  if (needs !== true) return needs;
  return deleteReachesLocked(deps!, deps!.selection!.get() as readonly NodeId[]) ? ActionDisabledReason.Locked : true;
}

/** Options for {@link createDeleteAction}. */
export interface DeleteActionOptions {
  /** Runs in place of the default, {@link commitDeleteToScene}. */
  commit?: (ids: readonly NodeId[], deps: ActionDeps) => void;
}

/** The default commit: removes `ids`, their dependents, and the sources a
 *  path effect among them hid, as one undo entry, then empties the selection. */
export function commitDeleteToScene(ids: readonly NodeId[], deps: ActionDeps, label = 'Delete'): void {
  const { selection, scene } = deps;
  if (!selection || !scene) return;
  commitOps(deps, buildDeleteOps(scene, ids, label, { takeHiddenSources: true }), label, { select: [] });
}

/** Delete on Delete and Backspace: hands the selected ids to `commit`. */
export function createDeleteAction(opts: DeleteActionOptions = {}): Action & { requires: string[] } {
  const commit = opts.commit ?? commitDeleteToScene;
  return {
    id: 'delete',
    label: 'Delete',
    icon: icon('delete'),
    group: 'edit',
    // Suppressed while any tool is mid-gesture — accidentally hitting
    // Delete during a drag shouldn't wipe the selection out from under
    // the in-flight handle.
    defaultBinding: [{
      spec: {
        kind: 'key',
        key: ['Delete', 'Backspace'],
        phase: BETWEEN_GESTURES,
      },
      opts: { id: 'delete.key' },
    }],
    eligible: { capability: 'edits-page' },
    requires: ['scene', 'selection', 'applyOps'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        if (!deps.selection || !deps.scene) return;
        const ids = deps.selection.get() as readonly NodeId[];
        if (ids.length === 0 || deleteEnabled(deps) !== true) return;
        commit(ids, deps);
      },
    },
    enabled: deleteEnabled,
  };
}

/**
 * Removes every selected node from the scene as one undo entry. Undo restores
 * everything the removal cascaded — a container's children and a deleted
 * node's dependents come back with it, at their own slots.
 */
export const deleteAction = createDeleteAction();
