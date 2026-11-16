/**
 * The anchor fields of the path being edited, for chrome beside the canvas:
 * a panel showing the selected anchors' numbers and writing typed ones back.
 */
import { useMemo, useSyncExternalStore } from 'react';
import {
  pathToAnchors, readAnchorFields, type AnchorField, type AnchorFieldValues, type NumberEntry, type PolygonPath,
} from '@weasel-js/geom';
import type { ActionDeps } from '@weasel-js/routing';
import { useActionsRegistry, useOptionalDepRegistry } from '@weasel-js/routing/react';
import type {} from '../../interactions/actions/actionParamSchema';

/** What `setAnchorField` takes: the field, and either the value every
 *  selected anchor gets (`to`) or the amount added to each one's own (`by`).
 *  `@weasel-js/path-tools` registers the action. */
export interface SetAnchorFieldParams {
  field: AnchorField;
  to?: number;
  by?: number;
}

/** What the anchor fields show for the path being edited in `deps`: `{}`
 *  outside path edit or with no anchor selected. */
export function anchorFieldsOf(deps: Pick<ActionDeps, 'editAnchors'> | undefined): AnchorFieldValues {
  const dep = deps?.editAnchors;
  if (!dep?.editingId || dep.selectedAnchors.size === 0) return {};
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | null | undefined;
  if (!path || path.kind !== 'polygon') return {};
  return readAnchorFields(pathToAnchors(path), dep.selectedAnchors);
}

/** What {@link useAnchorFields} answers. */
export interface AnchorFieldsApi {
  /** Each field's value: a number, `null` where the selected anchors differ,
   *  no key where the field does not apply. Empty outside path edit or with no
   *  anchor selected. */
  values: AnchorFieldValues;
  /** Write `entry` into `field` of every selected anchor, as one undo step,
   *  through the `setAnchorField` action. */
  write(field: AnchorField, entry: NumberEntry): void;
}

const noSubscribe = (): (() => void) => () => {};

/**
 * The selected anchors' fields in the canvas in scope — the one last pressed
 * in, from chrome above several — kept current as the path, the anchor
 * selection, or the edited path changes. Outside any canvas it answers `{}`
 * and writes nothing.
 */
export function useAnchorFields(): AnchorFieldsApi {
  const deps = useOptionalDepRegistry();
  const actions = useActionsRegistry();
  const snapshot = (): string => JSON.stringify(anchorFieldsOf(deps ? { editAnchors: deps.get('editAnchors') } : undefined));
  const json = useSyncExternalStore(deps?.subscribe ?? noSubscribe, snapshot, snapshot);
  return useMemo(() => ({
    values: JSON.parse(json) as AnchorFieldValues,
    write: (field, entry) => { actions?.trigger('setAnchorField', { field, ...entry }); },
  }), [json, actions]);
}
