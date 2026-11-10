/**
 * Nudge the anchors selected in path edit by one step, each keystroke its own history entry.
 */
import { ActionDisabledReason, type Action, type ActionDeps, type ImmediateInvoker } from '@weasel-js/routing';
import { translateAnchorsSymmetric, type AnchorSet } from '@weasel-js/geom';
import type { EditAnchorsDep, PathSymmetryDep } from '../depSchema';
import { editedPathSymmetries } from '../edit-anchors/symmetry';
import { nudgeSpec, NUDGE_LABEL, nudgeDelta, type NudgeDirection } from './nudgeSteps';
import { anchorEditWouldChange, commitAnchorEdit, depOf, requiresAnchorSelection } from './anchorEditing';
import { icon } from '../../../icons.gen';

const NUDGE_ICON = {
  right: icon('nudgeAnchors'),
  up: icon('nudgeAnchorsUp'),
  down: icon('nudgeAnchorsDown'),
  left: icon('nudgeAnchorsLeft'),
} as const;

/**
 * Move the selected anchors by one step. Shift multiplies the step. Every
 * keystroke is its own history entry.
 */
function makeNudgeAnchorsAction(dir: NudgeDirection): Action & { requires: string[] } {
  return {
    id: `nudgeAnchors.${dir}`,
    label: `Nudge Anchors ${NUDGE_LABEL[dir]}`,
    group: 'nudgeAnchors',
    icon: NUDGE_ICON[dir],
    defaultBinding: [
      { spec: nudgeSpec(dir, false), opts: { id: `nudgeAnchors.${dir}.small`, params: { magnitude: 'small' } } },
      { spec: nudgeSpec(dir, true), opts: { id: `nudgeAnchors.${dir}.big`, params: { magnitude: 'big' } } },
    ],
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors', 'pathSymmetry'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const dep = depOf(deps);
        if (!dep || dep.selectedAnchors.size === 0) return;
        commitAnchorEdit(dep, 'Nudge anchor', nudgeEdit(deps, dep, dir, params?.magnitude));
      },
    } as ImmediateInvoker,
    // An edit that would change nothing is disabled (ruled 2026-11-10): a selection naming no anchor of the path,
    // as one an undo shortened the path under leaves.
    enabled: (deps, _at, _carried, params) => {
      const selection = requiresAnchorSelection(deps);
      if (selection !== true) return selection;
      return anchorEditWouldChange(deps, nudgeEdit(deps, depOf(deps)!, dir, params?.magnitude))
        ? true : ActionDisabledReason.NotApplicable;
    },
  };
}

/** The edit a nudge of the selected anchors makes, for `commitAnchorEdit` or `anchorEditWouldChange`. */
function nudgeEdit(deps: ActionDeps | undefined, dep: EditAnchorsDep, dir: NudgeDirection, magnitude: unknown): (set: AnchorSet) => boolean | void {
  const { dx, dy } = nudgeDelta(dir, magnitude);
  const selected = [...dep.selectedAnchors];
  const symmetry = (deps as { pathSymmetry?: PathSymmetryDep } | undefined)?.pathSymmetry;
  return (set) => translateAnchorsSymmetric(set, selected, dx, dy, editedPathSymmetries(symmetry, dep.editingId, set));
}

/** Move the selected anchors up one step; Shift for a big step. */
export const nudgeAnchorsUpAction    = makeNudgeAnchorsAction('up');
/** Move the selected anchors down one step; Shift for a big step. */
export const nudgeAnchorsDownAction  = makeNudgeAnchorsAction('down');
/** Move the selected anchors left one step; Shift for a big step. */
export const nudgeAnchorsLeftAction  = makeNudgeAnchorsAction('left');
/** Move the selected anchors right one step; Shift for a big step. */
export const nudgeAnchorsRightAction = makeNudgeAnchorsAction('right');
