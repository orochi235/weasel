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
import type { EditAnchorsDep } from '../depSchema';
import { depOf } from './anchorEditing';

type Pick = (set: AnchorSet, selected: number[], params: Record<string, unknown> | undefined) => number[];

/** The edited path decoded, or null when it is not a polygon. */
function editedSet(dep: EditAnchorsDep): AnchorSet | null {
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  return path && path.kind === 'polygon' ? pathToAnchors(path) : null;
}

function makeSelectCommand(spec: {
  id: string;
  label: string;
  key: string;
  code: string;
  mods?: { alt?: boolean };
  /** Whether it reads the current selection and so needs one. */
  needsSelection: boolean;
  pick: Pick;
}): Action & { requires: string[] } {
  const enabled = (deps?: ActionDeps): true | ActionDisabledReason => {
    const dep = depOf(deps);
    if (!dep) return ActionDisabledReason.SelectionRequired;
    if (spec.needsSelection && dep.selectedAnchors.size === 0) return ActionDisabledReason.SelectionRequired;
    return true;
  };
  return {
    id: spec.id,
    label: spec.label,
    group: 'anchorSelection',
    // `code` too: with Alt held on a Mac the key reads as another glyph.
    defaultBinding: { kind: 'key', key: spec.key, code: spec.code, ...(spec.mods ? { mods: spec.mods } : {}) },
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const dep = depOf(deps);
        if (!dep || enabled(deps) !== true) return;
        const set = editedSet(dep);
        if (!set) return;
        dep.setSelectedAnchors(spec.pick(set, [...dep.selectedAnchors], params));
      },
    } as ImmediateInvoker,
    enabled,
  };
}

/** The count `params.n` asks for, 2 when it names none. */
const stepOf = (params: Record<string, unknown> | undefined): number => {
  const n = params?.n;
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
};

/** Add each selected anchor's neighbors along the path. `]`. */
export const growAnchorSelectionAction = makeSelectCommand({
  id: 'growAnchorSelection',
  label: 'Grow anchor selection',
  key: ']',
  code: 'BracketRight',
  needsSelection: true,
  pick: (set, selected) => growAnchorSelection(set, selected),
});

/** Drop the anchors at the ends of each selected run. `[`. */
export const shrinkAnchorSelectionAction = makeSelectCommand({
  id: 'shrinkAnchorSelection',
  label: 'Shrink anchor selection',
  key: '[',
  code: 'BracketLeft',
  needsSelection: true,
  pick: (set, selected) => shrinkAnchorSelection(set, selected),
});

/**
 * Select every `params.n`th anchor (default 2) along each subpath, counting
 * from its first selected anchor, or from the start of every subpath when
 * none is selected. Alt+N.
 */
export const selectEveryNthAnchorAction = makeSelectCommand({
  id: 'selectEveryNthAnchor',
  label: 'Select every Nth anchor',
  key: 'n',
  code: 'KeyN',
  mods: { alt: true },
  needsSelection: false,
  pick: (set, selected, params) => everyNthAnchor(set, stepOf(params), selected),
});

/** Select every corner anchor of the edited path. Alt+C. */
export const selectCornerAnchorsAction = makeSelectCommand({
  id: 'selectCornerAnchors',
  label: 'Select corner anchors',
  key: 'c',
  code: 'KeyC',
  mods: { alt: true },
  needsSelection: false,
  pick: (set) => cornerAnchors(set),
});

/** Select every smooth anchor of the edited path. Alt+S. */
export const selectSmoothAnchorsAction = makeSelectCommand({
  id: 'selectSmoothAnchors',
  label: 'Select smooth anchors',
  key: 's',
  code: 'KeyS',
  mods: { alt: true },
  needsSelection: false,
  pick: (set) => smoothAnchors(set),
});

/** Select the anchors that are not selected, and only those. Alt+I. */
export const invertAnchorSelectionAction = makeSelectCommand({
  id: 'invertAnchorSelection',
  label: 'Invert anchor selection',
  key: 'i',
  code: 'KeyI',
  mods: { alt: true },
  needsSelection: false,
  pick: (set, selected) => invertAnchorSelection(set, selected),
});
