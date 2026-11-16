/**
 * Typed numbers into the anchors selected in path edit: the action a number
 * field commits through, so each entry is one undo step.
 */

import { defineAction } from '@weasel-js/routing';
import { ANCHOR_FIELDS, writeAnchorField, type AnchorField, type NumberEntry } from '@weasel-js/geom';
import { pathOperationTags, type SetAnchorFieldParams } from '@weasel-js/core';
import { commitAnchorEdit, depOf, requiresAnchorSelection } from './anchorEditing';
import type {} from '../actionParamSchema';

function entryOf(params: Readonly<Partial<SetAnchorFieldParams>> | undefined): { field: AnchorField; entry: NumberEntry } | null {
  const field = params?.field;
  if (!field || !ANCHOR_FIELDS.includes(field)) return null;
  if (typeof params?.to === 'number') return { field, entry: { to: params.to } };
  if (typeof params?.by === 'number') return { field, entry: { by: params.by } };
  return null;
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
      const dep = depOf(deps);
      const asked = entryOf(params);
      if (!dep || !asked || dep.selectedAnchors.size === 0) return;
      const selected = [...dep.selectedAnchors];
      commitAnchorEdit(dep, 'Set anchor position', (set) => writeAnchorField(set, selected, asked.field, asked.entry));
    },
  },
  enabled: requiresAnchorSelection,
});
