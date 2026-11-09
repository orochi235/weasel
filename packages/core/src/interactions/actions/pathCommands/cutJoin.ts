/**
 * Cut at Crossings and Join: the path commands that change how many paths
 * there are. Join spans a gap straight; `joinPathsCommand` builds a join that
 * spans it some other way.
 */
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  anchorsToPath, closestOpenEnds, editAnchorSetTracked, forEachSegment, joinSubpathEnds, PATH_C, PATH_M, PATH_Q, PATH_Z,
  pathToAnchors, type AnchorSet, type JoinOptions, type PointOrigin, type PolygonPath,
} from '@weasel-js/geom';
import { snipPathsAtCrossings } from '@weasel-js/geom/booleans';
import type { Op } from 'core/ops/types';
import {
  deleteNode, insertAt, pathCopy, reshapeOps, selectedPathNodes, slotOf, type PathNode,
} from './pathNodes';
import { pieceOrigins } from './pieceOrigins';
import { joinedAnchorData } from './joinAnchorData';
import { commitOps } from '../defaultCommitAdapter';
import { pathOperationTags } from '../pathGestureTags';
import { icon } from '../../../icons.gen';
import { BETWEEN_GESTURES } from '@weasel-js/routing';

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
        const copies = runs.flatMap((p) => pathCopy(scene, node, p, pieceOrigins(node.path, p)) ?? []);
        copies.forEach((copy, k) => ops.push(insertAt(copy, at < 0 ? at : at + k, CUT_LABEL)));
        made.set(node.id, copies.map((c) => c.id));
      }
      const selected = deps.selection?.get() ?? [];
      commitOps(deps, ops, CUT_LABEL, { select: selected.flatMap((id) => made.get(id) ?? [id]) });
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => (selectedPathNodes(deps).length >= 2 ? true : ActionDisabledReason.SelectionRequired),
};

/** What a join would do to the selection, or null when it cannot. */
export interface JoinPlan {
  keep: PathNode;
  drop: PathNode | null;
  path: PolygonPath;
  /** Both paths' per-anchor widths and colors through the join, to lay over `keep`'s data; empty when
   *  neither carries any. */
  anchorData: Record<string, unknown>;
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
  const fromKeep = a.anchors.length;
  // Both paths as one, `keep`'s subpaths first: what the join's origins index.
  const before = drop
    ? (() => {
      const b = pathToAnchors(drop.path);
      return anchorsToPath([...a.anchors, ...b.anchors], [...a.closed, ...b.closed], keep.path);
    })()
    : keep.path;
  // The subpaths the join turns around: the first one joined by its start, the second by its end.
  const turned = new Set<number>();
  const made = editAnchorSetTracked(before, (set) => {
    const open = set.anchors.flatMap((sub, s) => (!set.closed[s] && sub.length >= 2 ? [s] : []));
    if (!drop && open.length === 1) {
      return joinSubpathEnds(set, { sub: open[0], end: 'first' }, { sub: open[0], end: 'last' }, options);
    }
    const ends = closestOpenEnds(set, (p, q) => !drop || (p.sub < fromKeep) !== (q.sub < fromKeep));
    if (ends === null) return false;
    if (ends[0].end === 'first') turned.add(ends[0].sub);
    if (ends[1].end === 'last') turned.add(ends[1].sub);
    return joinSubpathEnds(set, ends[0], ends[1], options);
  });
  if (!made) return null;
  const origins = turnedOrigins(before, made.origins, turned);
  return { keep, drop, path: made.path, anchorData: joinedAnchorData(keep, drop, before, made.path, origins) };
}


/**
 * `origins` with each point from a subpath in `turned` marked reversed. Tracking reads a direction off two
 * neighbors from one subpath, which a join leaves none of when it merges a two-anchor path's end away.
 */
function turnedOrigins(
  before: PolygonPath,
  origins: readonly (PointOrigin | null)[],
  turned: ReadonlySet<number>,
): (PointOrigin | null)[] {
  if (turned.size === 0) return [...origins];
  const subOf = new Int32Array(before.coords.length >> 1);
  let sub = -1;
  forEachSegment(before.commands, before.coords, (cmd, ci) => {
    if (cmd === PATH_M) sub++;
    if (cmd === PATH_Z) return;
    const n = cmd === PATH_C ? 6 : cmd === PATH_Q ? 4 : 2;
    for (let k = 0; k < n; k += 2) subOf[(ci + k) >> 1] = sub;
  });
  return origins.map((o) => (o && turned.has(subOf[o.a]!) ? { ...o, reversed: true as const } : o));
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
        const ops = reshapeOps(made.keep, made.path, base.label, made.anchorData);
        if (made.drop) ops.push(deleteNode(scene, made.drop.node, base.label));
        commitOps(deps, ops, base.label, { select: [made.keep.id] });
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
  { id: 'joinPaths', label: 'Join', icon: icon('join'), defaultBinding: [{ spec: { kind: 'key', key: 'j', mods: { mod: true }, phase: BETWEEN_GESTURES }, opts: { id: 'joinPaths.key' } }] },
  () => ({}),
);

