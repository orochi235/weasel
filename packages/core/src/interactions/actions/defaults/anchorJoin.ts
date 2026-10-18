/**
 * Average and Join on the anchors selected in path edit.
 */

import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { averageAnchorsAt, joinAnchorsAt, type AnchorSet, type AverageAxis, type JoinOptions } from '@weasel-js/geom';
import { anchorEditWouldChange, commitAnchorEdit, depOf } from './anchorEditing';
import { pathOperationTags } from '../pathGestureTags';
import { icon } from '../../../icons.gen';

/** An edit of an anchor set at its selected anchors, answering whether it changed anything. */
export type AnchorEdit = (set: AnchorSet, selected: number[]) => boolean;

const axisOf = (params: Record<string, unknown> | undefined): AverageAxis => {
  const axis = params?.axis;
  return axis === 'x' || axis === 'y' ? axis : 'both';
};

/**
 * Move the selected anchors to their mean position:
 * `params.axis` `'both'` (the default) stacks them on one point, `'x'` lines
 * them up on one vertical, `'y'` on one horizontal.
 */
export const averageAnchorsAction: Action & { requires: string[] } = {
  id: 'averageAnchors',
  label: 'Average anchors',
  icon: icon('averageAnchors'),
  tags: pathOperationTags('command'),
  group: 'anchors',
  variants: [
    { key: 'both', label: 'Average anchors', params: { axis: 'both' } },
    { key: 'x', label: 'Line anchors up vertically', params: { axis: 'x' } },
    { key: 'y', label: 'Line anchors up horizontally', params: { axis: 'y' } },
  ],
  // `code` too: with Alt held on a Mac the key reads as another glyph.
  defaultBinding: [{
    spec: { kind: 'key', key: 'j', code: 'KeyJ', mods: { mod: true, alt: true } },
    opts: { params: { axis: 'both' } },
  }],
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const dep = depOf(deps);
      if (!dep || dep.selectedAnchors.size < 2) return;
      const selected = [...dep.selectedAnchors];
      commitAnchorEdit(dep, 'Average anchors', (set) => averageAnchorsAt(set, selected, axisOf(params)));
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    const dep = depOf(deps);
    if (!dep || dep.selectedAnchors.size < 2) return ActionDisabledReason.SelectionRequired;
    return true;
  },
};

/** An edit joining the two selected end anchors, spanning the gap as
 *  `options` says (`joinAnchorsAt`). */
export const joinSelectedAnchors = (options: JoinOptions): AnchorEdit => (set, selected) =>
  selected.length === 2 && joinAnchorsAt(set, selected[0], selected[1], options);
const join = joinSelectedAnchors({});

/**
 * Join the two selected anchors, each the end of an open
 * subpath: the ends of one subpath close it, and ends of two make them one
 * (`joinAnchorsAt`). Joining renumbers the anchors, so the anchor selection
 * is cleared.
 */
export const joinAnchorsAction: Action & { requires: string[] } = {
  id: 'joinAnchors',
  label: 'Join anchors',
  icon: icon('join'),
  tags: pathOperationTags('command'),
  group: 'anchors',
  defaultBinding: { kind: 'key', key: 'j', mods: { mod: true } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const dep = depOf(deps);
      if (!dep || dep.selectedAnchors.size !== 2) return;
      const selected = [...dep.selectedAnchors];
      if (commitAnchorEdit(dep, 'Join anchors', (set) => join(set, selected))) dep.setSelectedAnchors([]);
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    const dep = depOf(deps);
    if (!dep || dep.selectedAnchors.size !== 2) return ActionDisabledReason.SelectionRequired;
    return anchorEditWouldChange(deps, (set) => join(set, [...depOf(deps)!.selectedAnchors]))
      ? true : ActionDisabledReason.NotApplicable;
  },
};
