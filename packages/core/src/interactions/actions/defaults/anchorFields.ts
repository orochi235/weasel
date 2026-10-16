/**
 * Typed numbers into the anchors selected in path edit: the action a number
 * field commits through, so each entry is one undo step.
 */

import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import {
  ANCHOR_FIELDS, pathToAnchors, readAnchorFields, writeAnchorField,
  type AnchorField, type AnchorFieldValues, type NumberEntry, type PolygonPath,
} from '@weasel-js/geom';
import { pathOperationTags } from '../pathGestureTags';
import { commitAnchorEdit, depOf, requiresAnchorSelection } from './anchorEditing';

/** What `setAnchorField` takes: the field, and either the value every
 *  selected anchor gets (`to`) or the amount added to each one's own (`by`). */
export interface SetAnchorFieldParams {
  field: AnchorField;
  to?: number;
  by?: number;
}

function entryOf(params: Record<string, unknown> | undefined): { field: AnchorField; entry: NumberEntry } | null {
  const field = params?.field as AnchorField | undefined;
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
export const setAnchorFieldAction: Action & { requires: string[] } = {
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
  } as ImmediateInvoker,
  enabled: requiresAnchorSelection,
};

/** What the anchor fields show for the path being edited in `deps`: `{}`
 *  outside path edit or with no anchor selected. */
export function anchorFieldsOf(deps: Pick<ActionDeps, 'editAnchors'> | undefined): AnchorFieldValues {
  const dep = depOf(deps as ActionDeps | undefined);
  if (!dep || dep.selectedAnchors.size === 0) return {};
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | null | undefined;
  if (!path || path.kind !== 'polygon') return {};
  return readAnchorFields(pathToAnchors(path), dep.selectedAnchors);
}
