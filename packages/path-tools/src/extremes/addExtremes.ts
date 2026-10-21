/**
 * Add extremes in path edit: an anchor at each turn of a curved segment, in x
 * and in y, with the shape left as it was.
 */
import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { addExtremaAnchors, anchorAt, segmentEnds, type AnchorSet, type PenAnchor } from '@weasel-js/geom';
import { anchorEditWouldChange, commitAnchorEdit, depOf, pathOperationTags } from '@weasel-js/core';
import { icon } from '../icons.gen';

const LABEL = 'Add extremes';

/** The segments whose two ends are both in `selected`, as `addExtremaAnchors`
 *  filters them; every segment when nothing is selected. */
function selectedSegments(set: AnchorSet, selected: ReadonlySet<number>) {
  if (selected.size === 0) return undefined;
  const picked = new Set<PenAnchor>();
  for (const flat of selected) {
    const anchor = anchorAt(set, flat);
    if (anchor) picked.add(anchor);
  }
  // Read as the splits go: they run last segment first and keep each
  // anchor's identity, so a segment not yet split still has its own ends.
  return (sub: number, segIdx: number) => {
    const ends = segmentEnds(set.anchors, set.closed, sub, segIdx);
    return ends !== null && picked.has(ends.a) && picked.has(ends.b);
  };
}

/** Split the segments `selected` covers at their extremes, in place, and
 *  return the selection afterward: the same anchors and the new ones. Null
 *  when there was no extreme to add. */
function addExtremesTo(set: AnchorSet, selected: ReadonlySet<number>): number[] | null {
  const kept = [...selected].flatMap((flat) => anchorAt(set, flat) ?? []);
  const added = addExtremaAnchors(set, selectedSegments(set, selected));
  if (added.length === 0) return null;
  const flatOf = new Map(set.anchors.flat().map((a, k) => [a, k]));
  return [...kept.map((a) => flatOf.get(a)!), ...added];
}

/**
 * Split the curved segments of the edited path at their x and y extremes:
 * those whose two ends are both selected, or every one while no anchor is.
 * The selected anchors stay selected, and the new ones join them. Alt+X.
 * Enabled only where it would add an anchor.
 */
export const addExtremeAnchorsAction: Action & { requires: string[] } = {
  id: 'addExtremeAnchors',
  icon: icon('extremeAnchors'),
  label: LABEL,
  group: 'anchors',
  tags: pathOperationTags('command'),
  // `code` too: with Alt held on a Mac the key reads as another glyph.
  defaultBinding: [{ spec: { kind: 'key', key: 'x', code: 'KeyX', mods: { alt: true } }, opts: { id: 'addExtremeAnchors.key' } }],
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const dep = depOf(deps);
      if (!dep) return;
      let next: number[] | null = null;
      commitAnchorEdit(dep, LABEL, (set) => (next = addExtremesTo(set, dep.selectedAnchors)) !== null);
      if (next) dep.setSelectedAnchors(next);
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    const dep = depOf(deps);
    if (!dep) return ActionDisabledReason.SelectionRequired;
    return anchorEditWouldChange(deps, (set) => addExtremesTo(set, dep.selectedAnchors) !== null)
      ? true
      : ActionDisabledReason.NotApplicable;
  },
};
