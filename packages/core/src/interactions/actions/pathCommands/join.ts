/**
 * Join and Bridge: the path commands that connect open ends, closing one path
 * or making two into one. Join spans a gap straight; Bridge with a curve that
 * meets each end tangentially.
 */
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  anchorsToPath, closestOpenEnds, joinSubpathEnds, pathToAnchors, type AnchorSet, type JoinOptions, type PolygonPath,
} from '@weasel-js/geom';
import { commitOps, deleteNode, reshapeOps, selectedPathNodes, type PathNode } from './pathNodes';

/** What a join would do to the selection, or null when it cannot. */
interface JoinPlan {
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

type Params = Record<string, unknown> | undefined;

/** A command joining the selected paths by {@link planJoin} as one undo step,
 *  spanning gaps as `options` reads from its params. */
function joinPathsCommand(
  base: Pick<Action, 'id' | 'label' | 'defaultBinding'>,
  options: (params: Params) => JoinOptions,
): Action & { requires: string[] } {
  const plan = (deps: ActionDeps | undefined, params?: Params) => planJoin(selectedPathNodes(deps), options(params));
  return {
    ...base,
    group: 'path',
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

/** How long Bridge makes each handle, as a fraction of the gap, when its
 *  params name no `tension`. */
export const DEFAULT_BRIDGE_TENSION = 0.4;

/** A bridge's `params.tension`, or the default. Negative reads as `0`. */
export function bridgeTensionOf(params: Params): number {
  const t = params?.tension;
  return typeof t === 'number' && Number.isFinite(t) ? Math.max(0, t) : DEFAULT_BRIDGE_TENSION;
}

/**
 * @experimental Join open paths: close a selected path's open end to its
 * start, or connect two selected paths at their nearest open ends into one
 * (`planJoin`). Ends that meet merge into one anchor; ends apart are bridged
 * straight. In path edit, `joinAnchors` joins the two selected anchors
 * instead.
 */
export const joinPathsAction = joinPathsCommand(
  { id: 'joinPaths', label: 'Join', defaultBinding: { kind: 'key', key: 'j', mods: { mod: true } } },
  () => ({}),
);

/**
 * @experimental Bridge open paths: as `joinPaths`, but the gap is spanned by
 * a curve leaving each end along the direction its path was heading, each
 * handle `params.tension` times the gap long (default
 * {@link DEFAULT_BRIDGE_TENSION}). Two paths become one. In path edit,
 * `bridgeAnchors` bridges the two selected anchors instead.
 */
export const bridgePathsAction = joinPathsCommand(
  {
    id: 'bridgePaths',
    label: 'Bridge',
    // `code` too: with Shift held the key reads as `J`.
    defaultBinding: { kind: 'key', key: 'j', code: 'KeyJ', mods: { mod: true, shift: true } },
  },
  (params) => ({ tension: bridgeTensionOf(params) }),
);
