/** Snip: cut a stroke back to the crossings on either side of a click. */
import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { snipPathAt, type SnipResult } from '@weasel-js/geom';
import { commitOps, deleteNode, reshapeOps, type PathNode, pathOperationTags } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { pressOf, scenePathNodes, strokeReachPref, strokesBesides } from '../shared/scenePaths';
import { icon } from '../icons.gen';

const SNIP_LABEL = 'Snip';

/** Snip's params as a form, for the last-operation panel. */
export const SNIP_PATH_PARAMS = pref.group(SNIP_LABEL, { radiusPx: strokeReachPref() });

/** What a snip at the press in `params` would do: the stroke it reaches, and
 *  what `snipPathAt` makes of it. Null when it reaches none it can snip.
 *  `params` as {@link snipPathAction} reads them; a hover's pointer serves
 *  as the press, which is how a tool previews the piece. */
export function planSnip(
  deps: ActionDeps,
  params: unknown,
): { target: PathNode; result: SnipResult } | null {
  const press = pressOf(deps, params);
  if (!press) return null;
  const all = scenePathNodes(deps);
  for (let i = all.length - 1; i >= 0; i--) {
    const target = all[i];
    const result = snipPathAt(target.path, strokesBesides(deps, target.id), press.at, { radius: press.radius });
    if (result) return { target, result };
  }
  return null;
}

/**
 * Snip: remove the piece of the stroke under the press
 * between the nearest crossings on either side — with any other node's
 * outline, or with itself — as `snipPathAt` cuts it. The topmost stroke
 * within `radiusPx` of the press (default 6) is the one snipped; a stroke
 * with nothing left is deleted. Params: `press`, a world point,
 * which a click binding supplies, and `radiusPx`, which the last-operation
 * panel changes.
 */
export const snipPathAction: Action & { requires: string[] } = {
  id: 'snipPath',
  icon: icon('snip'),
  label: SNIP_LABEL,
  tags: pathOperationTags('click'),
  group: 'path',
  eligible: { capability: 'creates-shapes' },
  requires: ['scene', 'applyOps', 'selection', 'view'],
  params: SNIP_PATH_PARAMS,
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const plan = deps.scene ? planSnip(deps, params) : null;
      if (!plan) return;
      const { target, result } = plan;
      const gone = result.path.commands.length === 0;
      const ops = gone
        ? [deleteNode(deps.scene as never, target.node, SNIP_LABEL)]
        : reshapeOps(target, result.path, SNIP_LABEL);
      commitOps(deps, ops, SNIP_LABEL, gone ? { select: (deps.selection?.get() ?? []).filter((id) => id !== target.id) } : {});
    },
  } satisfies ImmediateInvoker,
  // A click's point enables it, as Reach's does, and the run decides; without one, the press in its params does.
  enabled: (deps?: ActionDeps, at?: { x: number; y: number }, _carried?: unknown, params?: unknown) =>
    (at || (deps?.scene && planSnip(deps, params)) ? true : ActionDisabledReason.NotApplicable),
};
