/**
 * Average, Join and Bridge on the anchors selected in path edit.
 */

import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  averageAnchorsAt, editAnchorSetTracked, joinAnchorsAt, type AnchorSet, type AverageAxis, type JoinOptions,
  type PolygonPath,
} from '@weasel-js/geom';
import { commitAnchorEdit, depOf } from './anchorEditing';
import { bridgeTensionOf } from '../pathCommands/cutJoin';

type AnchorEdit = (set: AnchorSet, selected: number[]) => boolean;

/** Whether `edit` would change the edited path, tried on a scratch decode. */
function wouldChange(deps: ActionDeps | undefined, edit: AnchorEdit): boolean {
  const dep = depOf(deps);
  if (!dep) return false;
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  if (!path || path.kind !== 'polygon') return false;
  const selected = [...dep.selectedAnchors];
  return editAnchorSetTracked(path, (set) => edit(set, selected)) !== null;
}

const axisOf = (params: Record<string, unknown> | undefined): AverageAxis => {
  const axis = params?.axis;
  return axis === 'x' || axis === 'y' ? axis : 'both';
};

/**
 * @experimental Move the selected anchors to their mean position:
 * `params.axis` `'both'` (the default) stacks them on one point, `'x'` lines
 * them up on one vertical, `'y'` on one horizontal.
 */
export const averageAnchorsAction: Action & { requires: string[] } = {
  id: 'averageAnchors',
  label: 'Average anchors',
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

const joinWith = (options: JoinOptions): AnchorEdit => (set, selected) =>
  selected.length === 2 && joinAnchorsAt(set, selected[0], selected[1], options);
const join = joinWith({});

/**
 * @experimental Join the two selected anchors, each the end of an open
 * subpath: the ends of one subpath close it, and ends of two make them one
 * (`joinAnchorsAt`). Joining renumbers the anchors, so the anchor selection
 * is cleared.
 */
export const joinAnchorsAction: Action & { requires: string[] } = {
  id: 'joinAnchors',
  label: 'Join anchors',
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
    return wouldChange(deps, join) ? true : ActionDisabledReason.NotApplicable;
  },
};

/**
 * @experimental Bridge the two selected anchors, each the end of an open
 * subpath, as `joinAnchors` does, but with a curve leaving each end along the
 * direction its path was heading, each handle `params.tension` times the gap
 * long (`bridgePaths`'s default when absent). The anchor selection is
 * cleared.
 */
export const bridgeAnchorsAction: Action & { requires: string[] } = {
  id: 'bridgeAnchors',
  label: 'Bridge anchors',
  group: 'anchors',
  defaultBinding: { kind: 'key', key: 'j', code: 'KeyJ', mods: { mod: true, shift: true } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const dep = depOf(deps);
      if (!dep || dep.selectedAnchors.size !== 2) return;
      const selected = [...dep.selectedAnchors];
      const bridge = joinWith({ tension: bridgeTensionOf(params) });
      if (commitAnchorEdit(dep, 'Bridge anchors', (set) => bridge(set, selected))) dep.setSelectedAnchors([]);
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    const dep = depOf(deps);
    if (!dep || dep.selectedAnchors.size !== 2) return ActionDisabledReason.SelectionRequired;
    return wouldChange(deps, join) ? true : ActionDisabledReason.NotApplicable;
  },
};
