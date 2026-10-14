/**
 * Commands on the handles of the anchors selected in path edit: retract them
 * onto their anchors, or make each anchor's pair symmetric.
 */

import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  editAnchorSetTracked,
  makeHandlesSymmetric,
  retractHandles,
  type AnchorSet,
  type PolygonPath,
} from '@weasel-js/geom';
import { commitAnchorEdit, depOf, requiresAnchorSelection } from './anchorEditing';
import { RetractHandlesIcon, SymmetricHandlesIcon } from './icons/anchorIcons';

type HandleEdit = (set: AnchorSet, flatIndexes: Iterable<number>) => boolean;

function makeHandleCommand(
  id: string,
  label: string,
  icon: Action['icon'],
  edit: HandleEdit,
): Action & { requires: string[] } {
  return {
    id,
    label,
    icon,
    group: 'anchors',
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const dep = depOf(deps);
        if (!dep || dep.selectedAnchors.size === 0) return;
        const selected = [...dep.selectedAnchors];
        commitAnchorEdit(dep, label, (set) => edit(set, selected));
      },
    } as ImmediateInvoker,
    enabled: (deps) => {
      const selection = requiresAnchorSelection(deps);
      if (selection !== true) return selection;
      return wouldChange(deps, edit) ? true : ActionDisabledReason.NotApplicable;
    },
  };
}

/** Whether `edit` would change the edited path, tried on a scratch decode. */
function wouldChange(deps: ActionDeps | undefined, edit: HandleEdit): boolean {
  const dep = depOf(deps);
  if (!dep) return false;
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  if (!path || path.kind !== 'polygon') return false;
  const selected = [...dep.selectedAnchors];
  return editAnchorSetTracked(path, (set) => edit(set, selected)) !== null;
}

/** Collapse the selected anchors' handles onto them, making sharp corners. */
export const retractHandlesAction = makeHandleCommand(
  'retractHandles',
  'Retract handles',
  <RetractHandlesIcon />,
  retractHandles,
);

/** Give each selected anchor equal, opposite handles, making it smooth. */
export const makeHandlesSymmetricAction = makeHandleCommand(
  'makeHandlesSymmetric',
  'Make handles symmetric',
  <SymmetricHandlesIcon />,
  makeHandlesSymmetric,
);
