/**
 * Add Extremes in path edit: an anchor at each turn of a curved segment, in x
 * and in y, with the shape left as it was.
 */

import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  addExtremaAnchors, locateAnchor, pathToAnchors, segmentEnds, segmentExtremaTs,
  type AnchorSet, type PenAnchor, type PolygonPath,
} from '@weasel-js/geom';
import type { EditAnchorsDep } from '../depSchema';
import { commitAnchorEdit, depOf } from './anchorEditing';

const LABEL = 'Add extremes';

/** Which segments get anchors: those with both ends selected, or all. */
export type AddExtremesScope = 'selection' | 'path';

const scopeOf = (params: Record<string, unknown> | undefined): AddExtremesScope =>
  params?.scope === 'path' ? 'path' : 'selection';

/** The segments `scope` covers, as `addExtremaAnchors` names them, read off
 *  the set before any edit. */
function segmentFilter(set: AnchorSet, scope: AddExtremesScope, selected: ReadonlySet<number>) {
  if (scope === 'path') return undefined;
  const picked = new Set<PenAnchor>();
  for (const flat of selected) {
    const at = locateAnchor(set, flat);
    if (at) picked.add(set.anchors[at.sub][at.idx]);
  }
  const keys = new Set<string>();
  set.anchors.forEach((sub, s) => {
    for (let i = 0; i < sub.length; i++) {
      const ends = segmentEnds(set.anchors, set.closed, s, i);
      if (ends && picked.has(ends.a) && picked.has(ends.b)) keys.add(`${s}:${i}`);
    }
  });
  return (sub: number, segIdx: number) => keys.has(`${sub}:${segIdx}`);
}

function editedPath(dep: EditAnchorsDep): PolygonPath | null {
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  return path && path.kind === 'polygon' ? path : null;
}

/** Whether the edited path has a curved segment with an extreme inside it. */
function hasExtremes(deps: ActionDeps | undefined): boolean {
  const dep = depOf(deps);
  const path = dep && editedPath(dep);
  if (!path) return false;
  const set = pathToAnchors(path);
  return set.anchors.some((sub, s) => sub.some((_, i) => {
    const ends = segmentEnds(set.anchors, set.closed, s, i);
    return ends !== null && segmentExtremaTs(ends.a, ends.b).length > 0;
  }));
}

/**
 * Split the curved segments of the edited path at their x and
 * y extremes: with `params.scope` `'selection'` (the default) the segments
 * whose two ends are both selected, with `'path'` every one. The selected
 * anchors stay selected, and the new ones join them. Alt+E; Alt+Shift+E for
 * the whole path. Enabled while the edited path has an extreme to add.
 */
export const addExtremeAnchorsAction: Action & { requires: string[] } = {
  id: 'addExtremeAnchors',
  label: LABEL,
  group: 'anchors',
  variants: [
    { key: 'selection', label: 'Add extremes to selected segments', params: { scope: 'selection' } },
    { key: 'path', label: 'Add extremes to whole path', params: { scope: 'path' } },
  ],
  // `code` too: with Alt held on a Mac the key reads as another glyph.
  defaultBinding: [
    { spec: { kind: 'key', key: 'e', code: 'KeyE', mods: { alt: true } }, opts: { params: { scope: 'selection' } } },
    { spec: { kind: 'key', key: 'E', code: 'KeyE', mods: { alt: true, shift: true } }, opts: { params: { scope: 'path' } } },
  ],
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const dep = depOf(deps);
      if (!dep) return;
      const scope = scopeOf(params);
      let selected: number[] = [];
      const changed = commitAnchorEdit(dep, LABEL, (set) => {
        const kept = [...dep.selectedAnchors].flatMap((flat) => {
          const at = locateAnchor(set, flat);
          return at ? [set.anchors[at.sub][at.idx]] : [];
        });
        const added = addExtremaAnchors(set, segmentFilter(set, scope, dep.selectedAnchors));
        if (added.length === 0) return false;
        const flatOf = new Map(set.anchors.flat().map((a, k) => [a, k]));
        selected = [...kept.map((a) => flatOf.get(a)!), ...added];
        return true;
      });
      if (changed) dep.setSelectedAnchors(selected);
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    if (!depOf(deps)) return ActionDisabledReason.SelectionRequired;
    return hasExtremes(deps) ? true : ActionDisabledReason.NotApplicable;
  },
};
