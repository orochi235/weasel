/**
 * A double-click on a region's header: the action that reports which region's
 * title to edit, and its binding.
 */
import {
  ActionDisabledReason,
  bodyPredicate,
  type Action,
  type ActionDeps,
  type GestureBinding,
  type RectPose,
} from '@weasel-js/core';
import { diagramContainerOf, headerBox } from './trait';

/** The action a double-click on a region's header runs. */
export const EDIT_CONTAINER_TITLE_ACTION_ID = 'diagram.editContainerTitle';

/** The container, pool, or lane whose header holds `at`: the node under it, or a region around that. */
export function regionHeaderAt(deps: ActionDeps | undefined, at: { x: number; y: number } | undefined): string | null {
  if (deps === undefined || at === undefined) return null;
  const scene = deps.scene;
  for (let id = deps.nodeAtPoint?.(at) ?? null; id != null && scene !== undefined; id = scene.get(id)?.parent ?? null) {
    const node = scene.get(id);
    const trait = node === undefined ? null : diagramContainerOf(node);
    if (node === undefined || trait === null) continue;
    const h = headerBox(node.pose as RectPose, trait.header);
    if (h !== null && at.x >= h.x && at.x <= h.x + h.width && at.y >= h.y && at.y <= h.y + h.height) return id as string;
  }
  return null;
}

/** The action that hands `commit` the region whose header a double-click landed on. It declines anywhere else. */
export function editContainerTitleAction(commit: (id: string) => void): Action {
  return {
    id: EDIT_CONTAINER_TITLE_ACTION_ID,
    label: 'Edit container title',
    group: 'diagram',
    requires: ['scene', 'nodeAtPoint'],
    eligible: { mode: { in: ['normal', 'isolation'] } },
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const id = regionHeaderAt(deps, { x: Number(params?.worldX), y: Number(params?.worldY) });
        if (id !== null) commit(id);
      },
    },
    enabled: (deps, at) => (regionHeaderAt(deps, at) !== null ? true : ActionDisabledReason.NotApplicable),
  };
}

const onBody = bodyPredicate((target) => target === 'selected-body' || target === 'unselected-body');

/** A double-click on a node's body; the action declines unless it lands in a region's header. */
export function editContainerTitleBinding(): GestureBinding {
  return {
    spec: { kind: 'doubleClick', target: { kindOf: onBody } },
    actionId: EDIT_CONTAINER_TITLE_ACTION_ID,
    opts: { id: `${EDIT_CONTAINER_TITLE_ACTION_ID}.doubleClick` },
  };
}
