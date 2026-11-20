/**
 * Typed numbers into the anchors selected in path edit: the action a number
 * field commits through, so each entry is one undo step.
 */

import { ActionDisabledReason, defineAction } from '@weasel-js/routing';
import { ANCHOR_FIELDS, writeAnchorField, type AnchorField, type AnchorSet, type NumberEntry } from '@weasel-js/geom';
import { pathOperationTags, type SetAnchorFieldParams } from '@weasel-js/core';
import { anchorEditWouldChange, commitAnchorEdit, openPathEditOf, requiresAnchorSelection } from './anchorEditing';
import type {} from '../actionParamSchema';

function entryOf(params: Readonly<Partial<SetAnchorFieldParams>> | undefined): { field: AnchorField; entry: NumberEntry } | null {
  const field = params?.field;
  if (!field || !ANCHOR_FIELDS.includes(field)) return null;
  if (typeof params?.to === 'number') return { field, entry: { to: params.to } };
  if (typeof params?.by === 'number') return { field, entry: { by: params.by } };
  return null;
}

/** The edit `params` asks of the anchors `selected`, or null when it asks none. */
function fieldEdit(
  selected: ReadonlySet<number>,
  params: Readonly<Partial<SetAnchorFieldParams>> | undefined,
): ((set: AnchorSet) => boolean) | null {
  const asked = entryOf(params);
  if (!asked || selected.size === 0) return null;
  const flats = [...selected];
  return (set) => writeAnchorField(set, flats, asked.field, asked.entry);
}

/**
 * Set one number of the selected anchors (`writeAnchorField`): their X or Y,
 * or a lone anchor's handle X, Y, angle, or length. `params` is
 * {@link SetAnchorFieldParams}.
 */
export const setAnchorFieldAction = defineAction({
  id: 'setAnchorField',
  label: 'Set anchor position',
  tags: pathOperationTags('command'),
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const dep = openPathEditOf(deps);
      const edit = dep ? fieldEdit(dep.selectedAnchors, params) : null;
      if (dep && edit) commitAnchorEdit(dep, 'Set anchor position', edit);
    },
  },
  // An edit that would change nothing is disabled (ruled 2026-11-10). Asked with no params, as a listing asks,
  // it answers for the selection alone.
  enabled: (deps, _at, _carried, params) => {
    const selection = requiresAnchorSelection(deps);
    if (selection !== true || params === undefined) return selection;
    const edit = fieldEdit(openPathEditOf(deps)!.selectedAnchors, params);
    return edit && anchorEditWouldChange(deps, edit) ? true : ActionDisabledReason.NotApplicable;
  },
});
