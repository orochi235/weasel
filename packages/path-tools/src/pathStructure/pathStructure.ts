/**
 * Where a path starts and which way it runs: make the selected anchor its
 * subpath's start, and reverse a path's direction. Both reorder anchors
 * without moving them, and what a node keeps per anchor moves with them.
 */
import { ActionDisabledReason, type Action, type ActionDeps, type ImmediateInvoker } from '@weasel-js/routing';
import {
  editAnchorSetTracked, flatIndexesAfterReverse, locateAnchor, reverseSubpaths, setSubpathStart, subpathsOfAnchors,
  type AnchorSet, type PolygonPath,
} from '@weasel-js/geom';
import { anchorEditWouldChange, commitAnchorEdit, commitOps, depOf, pathOperationTags, type Op } from '@weasel-js/core';
import { icon } from '../icons.gen';

const START_LABEL = 'Make start point';
const REVERSE_LABEL = 'Reverse path direction';

/** The one selected anchor, when exactly one is selected in path edit. */
function loneAnchor(deps: ActionDeps | undefined): number | null {
  const dep = depOf(deps);
  return dep && dep.selectedAnchors.size === 1 ? [...dep.selectedAnchors][0] : null;
}

/**
 * Make the selected anchor where its subpath starts. A closed
 * subpath turns to start there; an open one can start only at an end, so its
 * last anchor reverses it (`setSubpathStart`). The anchor stays selected.
 */
export const setPathStartAction: Action & { requires: string[] } = {
  id: 'setPathStart',
  icon: icon('setPathStart'),
  label: START_LABEL,
  tags: pathOperationTags('command'),
  group: 'anchors',
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const dep = depOf(deps);
      const flat = loneAnchor(deps);
      if (!dep || flat === null) return;
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
    const flat = loneAnchor(deps);
    if (flat === null) return ActionDisabledReason.SelectionRequired;
    return anchorEditWouldChange(deps, (set) => setSubpathStart(set, flat)) ? true : ActionDisabledReason.NotApplicable;
  },
};

/** The selected nodes holding an editable polygon, by id. */
function selectedPaths(deps: ActionDeps | undefined): { id: string; path: PolygonPath }[] {
  const dep = deps?.editAnchors;
  if (!dep) return [];
  return (deps?.selection?.get() ?? []).flatMap((id) => {
    const path = dep.getEditablePath(id) as PolygonPath | null | undefined;
    return path?.kind === 'polygon' ? [{ id, path }] : [];
  });
}

/** Reverse the subpaths of `set` holding `selected`, or all of them; `onAfter` hears where the selection goes. */
function reverseSelected(set: AnchorSet, selected: readonly number[], onAfter?: (after: number[]) => void): boolean {
  const subs = selected.length > 0 ? subpathsOfAnchors(set, selected) : undefined;
  onAfter?.(flatIndexesAfterReverse(set, selected, subs));
  return reverseSubpaths(set, subs);
}

/** Reverse the subpaths holding the selected anchors, or all of them, keeping the selection on its anchors. */
function reverseInPathEdit(deps: ActionDeps): boolean {
  const dep = depOf(deps);
  if (!dep) return false;
  const selected = [...dep.selectedAnchors];
  let after: number[] = [];
  const changed = commitAnchorEdit(dep, REVERSE_LABEL, (set) => reverseSelected(set, selected, (a) => { after = a; }));
  if (changed) dep.setSelectedAnchors(after);
  return true;
}

/**
 * Run paths the other way, keeping their shape. In path edit it
 * reverses the subpaths holding the selected anchors — every subpath when
 * none is selected — and the selection follows its anchors. Otherwise it
 * reverses every selected path whole, in one undo entry. A closed subpath
 * keeps its start; an open one starts where it ended (`reverseSubpaths`).
 */
export const reversePathAction: Action & { requires: string[] } = {
  id: 'reversePath',
  icon: icon('reversePath'),
  label: REVERSE_LABEL,
  tags: pathOperationTags('command'),
  group: 'path',
  requires: ['editAnchors', 'selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      if (reverseInPathEdit(deps)) return;
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
  // An edit that would change nothing is disabled (ruled 2026-11-10): a path that reads the same either way.
  enabled: (deps) => {
    const dep = depOf(deps);
    if (dep) {
      const selected = [...dep.selectedAnchors];
      return anchorEditWouldChange(deps, (set) => reverseSelected(set, selected)) ? true : ActionDisabledReason.NotApplicable;
    }
    const paths = selectedPaths(deps);
    if (paths.length === 0) return ActionDisabledReason.SelectionRequired;
    return paths.some(({ path }) => editAnchorSetTracked(path, (set) => reverseSubpaths(set)) !== null)
      ? true : ActionDisabledReason.NotApplicable;
  },
};
