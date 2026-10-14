/**
 * Cut at Crossings and Join: the path commands that change how many paths
 * there are.
 */
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  anchorsToPath, closestOpenEnds, joinSubpathEnds, pathToAnchors, type AnchorSet, type PolygonPath,
} from '@weasel-js/geom';
import { snipPathsAtCrossings } from '@weasel-js/geom/booleans';
import type { Op } from 'core/ops/types';
import {
  commitOps, deleteNode, insertAt, pathCopy, reshapeOps, selectedPathNodes, slotOf, type PathNode,
} from './pathNodes';

const CUT_LABEL = 'Cut at Crossings';
const JOIN_LABEL = 'Join';

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

/** What Join would do to the selection, or null when it cannot. */
interface JoinPlan {
  keep: PathNode;
  drop: PathNode | null;
  path: PolygonPath;
}

/**
 * One selected path: close its one open subpath, or join the two nearest
 * ends of its open subpaths. Two: join the nearest pair of open ends, one on
 * each, into the first selected, which takes in the second's other subpaths.
 */
export function planJoin(nodes: readonly PathNode[]): JoinPlan | null {
  if (nodes.length === 0 || nodes.length > 2) return null;
  const [keep, drop = null] = nodes;
  const a = pathToAnchors(keep.path) as AnchorSet;
  const set: AnchorSet = drop
    ? (() => {
      const b = pathToAnchors(drop.path);
      return { anchors: [...a.anchors, ...b.anchors], closed: [...a.closed, ...b.closed] };
    })()
    : a;
  const fromKeep = a.anchors.length;
  const open = set.anchors.flatMap((sub, s) => (!set.closed[s] && sub.length >= 2 ? [s] : []));
  let joined: boolean;
  if (!drop && open.length === 1) {
    joined = joinSubpathEnds(set, { sub: open[0], end: 'first' }, { sub: open[0], end: 'last' });
  } else {
    const ends = closestOpenEnds(set, (p, q) => !drop || (p.sub < fromKeep) !== (q.sub < fromKeep));
    joined = ends !== null && joinSubpathEnds(set, ends[0], ends[1]);
  }
  if (!joined) return null;
  return { keep, drop, path: anchorsToPath(set.anchors, set.closed, keep.path) };
}

/**
 * @experimental Join open paths: close a selected path's open end to its
 * start, or connect two selected paths at their nearest open ends into one
 * (`planJoin`). Ends that meet merge into one anchor; ends apart are bridged
 * straight. In path edit, `joinAnchors` joins the two selected anchors
 * instead.
 */
export const joinPathsAction: Action & { requires: string[] } = {
  id: 'joinPaths',
  label: JOIN_LABEL,
  group: 'path',
  defaultBinding: { kind: 'key', key: 'j', mods: { mod: true } },
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'scene', 'applyOps', 'editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene;
      if (deps.editAnchors?.editingId) return;
      const plan = planJoin(selectedPathNodes(deps));
      if (!scene || !plan) return;
      const ops = reshapeOps(plan.keep.node, plan.path, JOIN_LABEL);
      if (plan.drop) ops.push(deleteNode(scene, plan.drop.node, JOIN_LABEL));
      commitOps(deps, ops, JOIN_LABEL);
      deps.selection?.set([plan.keep.id] as never);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps?: ActionDeps) => {
    // In path edit Join is the selected anchors' (`joinAnchors`).
    if (deps?.editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
    const nodes = selectedPathNodes(deps);
    if (nodes.length === 0) return ActionDisabledReason.SelectionRequired;
    return planJoin(nodes) ? true : ActionDisabledReason.NotApplicable;
  },
};
