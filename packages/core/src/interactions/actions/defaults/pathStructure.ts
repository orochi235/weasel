/**
 * Where a path starts and which way it runs: make the selected anchor its
 * subpath's start, and reverse a path's direction. Both reorder anchors
 * without moving them, and what a node keeps per anchor moves with them.
 */

import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  editAnchorSetTracked, flatIndexesAfterReverse, locateAnchor, pathToAnchors, reverseSubpaths,
  setSubpathStart, subpathsOfAnchors, type PolygonPath,
} from '@weasel-js/geom';
import type { Op } from 'core/ops/types';
import type { EditAnchorsDep } from '../depSchema';
import { commitOps } from '../pathCommands/pathNodes';
import { commitAnchorEdit, depOf } from './anchorEditing';

const START_LABEL = 'Make start point';
const REVERSE_LABEL = 'Reverse path direction';

function editedPath(dep: EditAnchorsDep, id: string): PolygonPath | null {
  const path = dep.getEditablePath(id) as PolygonPath | null | undefined;
  return path && path.kind === 'polygon' ? path : null;
}

/** The one selected anchor, when exactly one is selected in path edit. */
function loneAnchor(deps: ActionDeps | undefined): { dep: EditAnchorsDep; flat: number } | null {
  const dep = depOf(deps);
  if (!dep || dep.selectedAnchors.size !== 1) return null;
  return { dep, flat: [...dep.selectedAnchors][0] };
}

/**
 * Make the selected anchor where its subpath starts. A closed subpath turns
 * to start there; an open one can start only at an end, so its last anchor
 * reverses it (`setSubpathStart`). The anchor stays selected.
 */
export const setPathStartAction: Action & { requires: string[] } = {
  id: 'setPathStart',
  label: START_LABEL,
  group: 'anchors',
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const lone = loneAnchor(deps);
      if (!lone) return;
      const { dep, flat } = lone;
      let start = -1;
      const changed = commitAnchorEdit(dep, START_LABEL, (set) => {
        const loc = locateAnchor(set, flat);
        if (!loc) return false;
        start = flat - loc.idx;
        return setSubpathStart(set, flat);
      });
      if (changed) dep.setSelectedAnchors([start]);
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    const lone = loneAnchor(deps);
    if (!lone) return ActionDisabledReason.SelectionRequired;
    const path = editedPath(lone.dep, lone.dep.editingId);
    if (!path) return ActionDisabledReason.NotApplicable;
    return setSubpathStart(pathToAnchors(path), lone.flat) ? true : ActionDisabledReason.NotApplicable;
  },
};

/** The selected nodes holding an editable polygon, by id. */
function selectedPaths(deps: ActionDeps | undefined): { id: string; path: PolygonPath }[] {
  const dep = deps?.editAnchors;
  if (!dep) return [];
  return (deps?.selection?.get() ?? []).flatMap((id) => {
    const path = editedPath(dep, id);
    return path ? [{ id, path }] : [];
  });
}

/**
 * Run paths the other way, keeping their shape. In path edit it reverses the
 * subpaths holding the selected anchors — every subpath when none is
 * selected — and the selection follows its anchors. Otherwise it reverses
 * every selected path whole, in one undo entry. A closed subpath keeps its
 * start; an open one starts where it ended (`reverseSubpaths`).
 */
export const reversePathAction: Action & { requires: string[] } = {
  id: 'reversePath',
  label: REVERSE_LABEL,
  group: 'path',
  requires: ['editAnchors', 'selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const dep = depOf(deps);
      if (dep) {
        const selected = [...dep.selectedAnchors];
        let after: number[] = [];
        const changed = commitAnchorEdit(dep, REVERSE_LABEL, (set) => {
          const subs = selected.length > 0 ? subpathsOfAnchors(set, selected) : undefined;
          after = flatIndexesAfterReverse(set, selected, subs);
          return reverseSubpaths(set, subs);
        });
        if (changed) dep.setSelectedAnchors(after);
        return;
      }
      const edit = deps.editAnchors;
      if (!edit?.editOps) return;
      const ops: Op[] = [];
      for (const { id, path } of selectedPaths(deps)) {
        const next = editAnchorSetTracked(path, (set) => reverseSubpaths(set));
        if (next) ops.push(...edit.editOps(id, next.path, REVERSE_LABEL, next.origins));
      }
      commitOps(deps, ops, REVERSE_LABEL);
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    if (depOf(deps)) return true;
    return selectedPaths(deps).length > 0 ? true : ActionDisabledReason.SelectionRequired;
  },
};
