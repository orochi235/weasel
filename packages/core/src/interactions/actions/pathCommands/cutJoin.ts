/**
 * Cut at Crossings and Join: the path commands that change how many paths
 * there are. Join spans a gap straight; `joinPathsCommand` builds a join that
 * spans it some other way.
 */
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  anchorsToPath, closestOpenEnds, joinSubpathEnds, pathToAnchors, type AnchorSet, type JoinOptions,
  type PolygonPath,
} from '@weasel-js/geom';
import { snipPathsAtCrossings } from '@weasel-js/geom/booleans';
import type { Op } from 'core/ops/types';
import {
  deleteNode, insertAt, pathCopy, reshapeOps, selectedPathNodes, slotOf, type PathNode,
} from './pathNodes';
import { commitOps } from '../defaultCommitAdapter';
import { pathOperationTags } from '../pathGestureTags';
import { icon } from '../../../icons.gen';

const CUT_LABEL = 'Cut at Crossings';

/**
 * Cut every selected path wherever another selected path
 * crosses it (`snipPathsAtCrossings`): each cut path is replaced, in its
 * slot, by its pieces, which take its paint, and the pieces are selected.
 */
export const snipAtCrossingsAction: Action & { requires: string[] } = {
  id: 'snipAtCrossings',
  label: CUT_LABEL,
  icon: icon('cutAtCrossings'),
  group: 'path',
  tags: pathOperationTags('command'),
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

/** What a join would do to the selection, or null when it cannot. */
export interface JoinPlan {
  keep: PathNode;
  drop: PathNode | null;
  path: PolygonPath;
}

/**
 * One selected path: close its one open subpath, or join the two nearest
 * ends of its open subpaths. Two: join the nearest pair of open ends, one on
 * each, into the first selected, which takes in the second's other subpaths.
 * `options` says how ends apart are spanned (`joinSubpathEnds`).
 */
export function planJoin(nodes: readonly PathNode[], options: JoinOptions = {}): JoinPlan | null {
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
    joined = joinSubpathEnds(set, { sub: open[0], end: 'first' }, { sub: open[0], end: 'last' }, options);
  } else {
    const ends = closestOpenEnds(set, (p, q) => !drop || (p.sub < fromKeep) !== (q.sub < fromKeep));
    joined = ends !== null && joinSubpathEnds(set, ends[0], ends[1], options);
  }
  if (!joined) return null;
  return { keep, drop, path: anchorsToPath(set.anchors, set.closed, keep.path) };
}


/** A command joining the selected paths by {@link planJoin} as one undo step,
 *  spanning gaps as `options` reads from its params. Disabled in path edit,
 *  where joins act on the selected anchors. */
export function joinPathsCommand(
  base: Pick<Action, 'id' | 'label' | 'icon' | 'defaultBinding'>,
  options: (params: Record<string, unknown> | undefined) => JoinOptions,
): Action & { requires: string[] } {
  const plan = (deps: ActionDeps | undefined, params?: Record<string, unknown>) => planJoin(selectedPathNodes(deps), options(params));
  return {
    ...base,
    group: 'path',
    tags: pathOperationTags('command'),
    eligible: { capability: 'creates-shapes' },
    requires: ['selection', 'scene', 'applyOps', 'editAnchors'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const scene = deps.scene;
        if (deps.editAnchors?.editingId) return;
        const made = plan(deps, params);
        if (!scene || !made) return;
        const ops = reshapeOps(made.keep.node, made.path, base.label);
        if (made.drop) ops.push(deleteNode(scene, made.drop.node, base.label));
        commitOps(deps, ops, base.label);
        deps.selection?.set([made.keep.id] as never);
      },
    } satisfies ImmediateInvoker,
    enabled: (deps?: ActionDeps) => {
      // In path edit these are the selected anchors' commands.
      if (deps?.editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
      if (selectedPathNodes(deps).length === 0) return ActionDisabledReason.SelectionRequired;
      return plan(deps) ? true : ActionDisabledReason.NotApplicable;
    },
  };
}

/**
 * Join open paths: close a selected path's open end to its
 * start, or connect two selected paths at their nearest open ends into one
 * (`planJoin`). Ends that meet merge into one anchor; ends apart are bridged
 * straight. In path edit, `joinAnchors` joins the two selected anchors
 * instead.
 */
export const joinPathsAction = joinPathsCommand(
  { id: 'joinPaths', label: 'Join', icon: icon('join'), defaultBinding: [{ spec: { kind: 'key', key: 'j', mods: { mod: true } }, opts: { id: 'joinPaths.key' } }] },
  () => ({}),
);

