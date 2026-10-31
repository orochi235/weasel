/** Trim segment: cut a stroke back to the crossings on either side of a click. */
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { trimPathAt, type TrimResult } from '@weasel-js/geom';
import { commitOps, deleteNode, reshapeOps, type PathNode, pathOperationTags } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { pressOf, scenePathNodes, strokeReachPref, strokesBesides } from '../shared/scenePaths';
import { icon } from '../icons.gen';

const TRIM_LABEL = 'Trim segment';

/** Trim segment's params as a form, for the last-operation panel. */
export const TRIM_PATH_PARAMS = pref.group(TRIM_LABEL, { radiusPx: strokeReachPref() });

/** What a trim at the press in `params` would do: the stroke it reaches, and
 *  what `trimPathAt` makes of it. Null when it reaches none it can trim.
 *  `params` as {@link trimPathAction} reads them; a hover's pointer serves
 *  as the press, which is how a tool previews the piece. */
export function planTrim(
  deps: ActionDeps,
  params: unknown,
): { target: PathNode; result: TrimResult } | null {
  const press = pressOf(deps, params);
  if (!press) return null;
  const all = scenePathNodes(deps);
  for (let i = all.length - 1; i >= 0; i--) {
    const target = all[i];
    const result = trimPathAt(target.path, strokesBesides(deps, target.id), press.at, { radius: press.radius });
    if (result) return { target, result };
  }
  return null;
}

/**
 * Trim segment: remove the piece of the stroke under the press
 * between the nearest crossings on either side — with any other node's
 * outline, or with itself — as `trimPathAt` cuts it. The topmost stroke
 * within `radiusPx` of the press (default 6) is the one trimmed; a stroke
 * with nothing left is deleted. Params: `press`, a world point,
 * which a click binding supplies, and `radiusPx`, which the last-operation
 * panel changes.
 */
export const trimPathAction: Action & { requires: string[] } = {
  id: 'trimPath',
  icon: icon('trim'),
  label: TRIM_LABEL,
  tags: pathOperationTags('click'),
  group: 'path',
  eligible: { capability: 'creates-shapes' },
  requires: ['scene', 'applyOps', 'selection', 'view'],
  params: TRIM_PATH_PARAMS,
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const plan = deps.scene ? planTrim(deps, params) : null;
      if (!plan) return;
      const { target, result } = plan;
      const gone = result.path.commands.length === 0;
      const ops = gone
        ? [deleteNode(deps.scene as never, target.node, TRIM_LABEL)]
        : reshapeOps(target.node, result.path, TRIM_LABEL);
      commitOps(deps, ops, TRIM_LABEL);
      if (gone) deps.selection?.set((deps.selection.get() ?? []).filter((id) => id !== target.id) as never);
    },
  } satisfies ImmediateInvoker,
  enabled: () => true,
};
