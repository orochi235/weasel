/**
 * Cut at Crossings: the path command that cuts paths into pieces where they
 * cross.
 */
import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { PolygonPath } from '@weasel-js/geom';
import { snipPathsAtCrossings } from '@weasel-js/geom/booleans';
import type { Op } from 'core/ops/types';
import {
  commitOps, deleteNode, insertAt, pathCopy, selectedPathNodes, slotOf, type PathNode,
} from './pathNodes';

const CUT_LABEL = 'Cut at Crossings';

/**
 * @experimental Cut every selected path wherever another selected path
 * crosses it (`snipPathsAtCrossings`): each cut path is replaced, in its
 * slot, by its pieces, which take its paint, and the pieces are selected.
 */
export const snipAtCrossingsAction: Action & { requires: string[] } = {
  id: 'snipAtCrossings',
  label: CUT_LABEL,
  group: 'path',
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene;
      const nodes = selectedPathNodes(deps);
      if (!scene || nodes.length < 2) return;
      const pieces = snipPathsAtCrossings(nodes.map((n) => n.path));
      const cut = nodes
        .map((node, i) => ({ node, pieces: pieces[i], at: slotOf(scene, node.id) }))
        .filter((c): c is { node: PathNode; pieces: PolygonPath[]; at: number } => c.pieces !== null)
        .sort((a, b) => b.at - a.at);
      if (cut.length === 0) return;
      const ops: Op[] = [];
      const made = new Map<string, string[]>();
      for (const { node, pieces: runs, at } of cut) {
        ops.push(deleteNode(scene, node.node, CUT_LABEL));
        const copies = runs.flatMap((p) => pathCopy(scene, node.node, p) ?? []);
        copies.forEach((copy, k) => ops.push(insertAt(copy, at < 0 ? at : at + k, CUT_LABEL)));
        made.set(node.id, copies.map((c) => c.id));
      }
      commitOps(deps, ops, CUT_LABEL);
      const selected = deps.selection?.get() ?? [];
      deps.selection?.set(selected.flatMap((id) => made.get(id) ?? [id]) as never);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => (selectedPathNodes(deps).length >= 2 ? true : ActionDisabledReason.SelectionRequired),
};
