/**
 * Commands on the handles of the anchors selected in path edit: retract them
 * onto their anchors, or make each anchor's pair symmetric.
 */

import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { makeHandlesSymmetric, retractHandles, type AnchorSet } from '@weasel-js/geom';
import { anchorEditWouldChange, commitAnchorEdit, depOf, requiresAnchorSelection } from './anchorEditing';
import { RetractHandlesIcon, SymmetricHandlesIcon } from './icons/anchorIcons';
import { pathOperationTags } from '../pathGestureTags';

/** An edit of the handles of the anchors at `flatIndexes`; absent means
 *  every anchor of the path. */
export type HandleEdit = (set: AnchorSet, flatIndexes?: Iterable<number>) => boolean;

/** Which anchors a command edits: the selected ones, or every anchor of the
 *  path while none is selected. */
export type HandleScope = 'selected' | 'selectedOrAll';

/** A path-edit command running `edit` on the anchors `scope` names, as one
 *  history entry labeled `label`. Enabled only where it would change the path. */
export function makeHandleCommand(
  id: string,
  label: string,
  icon: Action['icon'],
  edit: HandleEdit,
  scope: HandleScope = 'selected',
): Action & { requires: string[] } {
  return {
    id,
    label,
    icon,
    group: 'anchors',
    tags: pathOperationTags('command'),
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const dep = depOf(deps);
        if (!dep) return;
        const selected = selectedOrAll(dep.selectedAnchors);
        if (!selected && scope === 'selected') return;
        commitAnchorEdit(dep, label, (set) => edit(set, selected));
      },
    } as ImmediateInvoker,
    enabled: (deps) => {
      const ready = scope === 'selected'
        ? requiresAnchorSelection(deps)
        : depOf(deps) ? true : ActionDisabledReason.SelectionRequired;
      if (ready !== true) return ready;
      const selected = selectedOrAll(depOf(deps)!.selectedAnchors);
      return anchorEditWouldChange(deps, (set) => edit(set, selected)) ? true : ActionDisabledReason.NotApplicable;
    },
  };
}

function selectedOrAll(selected: ReadonlySet<number>): number[] | undefined {
  return selected.size > 0 ? [...selected] : undefined;
}

/** Collapse the selected anchors' handles onto them, making sharp corners. */
export const retractHandlesAction = makeHandleCommand(
  'retractHandles',
  'Retract handles',
  <RetractHandlesIcon />,
  (set, flat) => retractHandles(set, flat ?? []),
);

/** Give each selected anchor equal, opposite handles, making it smooth. */
export const makeHandlesSymmetricAction = makeHandleCommand(
  'makeHandlesSymmetric',
  'Make handles symmetric',
  <SymmetricHandlesIcon />,
  (set, flat) => makeHandlesSymmetric(set, flat ?? []),
);

