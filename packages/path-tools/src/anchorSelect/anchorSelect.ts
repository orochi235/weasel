/**
 * Anchor selection along the path in path edit: grow or shrink it by one
 * anchor, every Nth anchor, corners or smooth anchors, and the complement.
 * They change which anchors are selected and nothing else, so none of them
 * is an undo step.
 */
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  cornerAnchors, everyNthAnchor, growAnchorSelection, invertAnchorSelection, pathToAnchors,
  shrinkAnchorSelection, smoothAnchors, type AnchorSet, type PolygonPath,
} from '@weasel-js/geom';
import {
  depOf, pathOperationTags, requiresAnchorSelection, type EditAnchorsDep, type KeySpec,
} from '@weasel-js/core';

/** The group every action here is in, which an `ActionBar` can show. */
export const ANCHOR_SELECTION_GROUP = 'anchorSelection';

type Pick = (set: AnchorSet, selected: number[], params: Record<string, unknown> | undefined) => number[];

/** The edited path decoded, or null when it is not a polygon. */
function editedSet(dep: EditAnchorsDep): AnchorSet | null {
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  return path && path.kind === 'polygon' ? pathToAnchors(path) : null;
}

const pathOpen = (deps?: ActionDeps): true | ActionDisabledReason =>
  depOf(deps) ? true : ActionDisabledReason.SelectionRequired;

/** A selection command bound to `key`; `needsSelection` when `pick` reads
 *  the current selection and so has nothing to do without one. */
function makeSelectCommand(
  id: string, label: string, key: KeySpec, needsSelection: boolean, pick: Pick,
): Action & { requires: string[] } {
  const enabled = needsSelection ? requiresAnchorSelection : pathOpen;
  return {
    id,
    label,
    group: ANCHOR_SELECTION_GROUP,
    tags: pathOperationTags('command'),
    defaultBinding: [{ spec: key, opts: { id: `${id}.key` } }],
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const dep = depOf(deps);
        const set = dep && enabled(deps) === true ? editedSet(dep) : null;
        if (set) dep!.setSelectedAnchors(pick(set, [...dep!.selectedAnchors], params));
      },
    } as ImmediateInvoker,
    enabled,
  };
}

/** A key with Alt held, matched on `code` too: with Alt held on a Mac the
 *  key reads as another glyph. */
const altKey = (key: string, code: string): KeySpec => ({ kind: 'key', key, code, mods: { alt: true } });

/** The count `params.n` asks for, 2 when it names none. */
const stepOf = (params: Record<string, unknown> | undefined): number => {
  const n = params?.n;
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
};

/** Add each selected anchor's neighbors along the path. `]`. */
export const growAnchorSelectionAction = makeSelectCommand(
  'growAnchorSelection', 'Grow anchor selection', { kind: 'key', key: ']', code: 'BracketRight' }, true,
  (set, selected) => growAnchorSelection(set, selected),
);

/** Drop the anchors at the ends of each selected run. `[`. */
export const shrinkAnchorSelectionAction = makeSelectCommand(
  'shrinkAnchorSelection', 'Shrink anchor selection', { kind: 'key', key: '[', code: 'BracketLeft' }, true,
  (set, selected) => shrinkAnchorSelection(set, selected),
);

/**
 * Select every `params.n`th anchor (default 2) along each subpath, counting
 * from its first selected anchor, or from the start of every subpath when
 * none is selected. Alt+N.
 */
export const selectEveryNthAnchorAction = makeSelectCommand(
  'selectEveryNthAnchor', 'Select every Nth anchor', altKey('n', 'KeyN'), false,
  (set, selected, params) => everyNthAnchor(set, stepOf(params), selected),
);

/** Select every corner anchor of the edited path. Alt+C. */
export const selectCornerAnchorsAction = makeSelectCommand(
  'selectCornerAnchors', 'Select corner anchors', altKey('c', 'KeyC'), false,
  (set) => cornerAnchors(set),
);

/** Select every smooth anchor of the edited path. Alt+M. */
export const selectSmoothAnchorsAction = makeSelectCommand(
  'selectSmoothAnchors', 'Select smooth anchors', altKey('m', 'KeyM'), false,
  (set) => smoothAnchors(set),
);

/** Select the anchors that are not selected, and only those. Alt+I. */
export const invertAnchorSelectionAction = makeSelectCommand(
  'invertAnchorSelection', 'Invert anchor selection', altKey('i', 'KeyI'), false,
  (set, selected) => invertAnchorSelection(set, selected),
);
