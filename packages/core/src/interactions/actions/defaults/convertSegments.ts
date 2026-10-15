/**
 * Make segments of the path being edited straight or curved, in place
 * (`convertSegments`): the selected segments from the keyboard, or the one
 * under a Shift+double-click.
 */

import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  convertSegments, editAnchorSetTracked, pathToAnchors, segmentsBetweenAnchors,
  type PolygonPath, type SegmentType,
} from '@weasel-js/geom';
import { inPlane, editingLayer } from '../planeInput';
import { commitAnchorEdit, depOf } from './anchorEditing';
import { segmentUnder } from './segmentUnder';

const LABEL = 'Convert segments';

const typeOf = (params: Record<string, unknown> | undefined): SegmentType | undefined =>
  (params?.to === 'line' || params?.to === 'curve' ? params.to : undefined);

/** Whether the anchors selected in path edit bound any segment. */
function hasSelectedSegments(deps: ActionDeps | undefined): boolean {
  const dep = depOf(deps);
  if (!dep || dep.selectedAnchors.size < 2) return false;
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | null | undefined;
  if (!path || path.kind !== 'polygon') return false;
  return segmentsBetweenAnchors(pathToAnchors(path), dep.selectedAnchors).length > 0;
}

/**
 * Convert the selected segments — those whose two ends are
 * both selected anchors. `params.to` `'line'` straightens them, `'curve'`
 * curves them with handles at their thirds so they keep their shape, and no
 * `to` (Shift+C) curves them all when any is straight and straightens them
 * otherwise.
 */
export const convertSegmentsAction: Action & { requires: string[] } = {
  id: 'convertSegments',
  label: LABEL,
  group: 'anchors',
  variants: [
    { key: 'line', label: 'Make segments straight', params: { to: 'line' } },
    { key: 'curve', label: 'Make segments curved', params: { to: 'curve' } },
  ],
  defaultBinding: { kind: 'key', key: ['c', 'C'], mods: { shift: true } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const dep = depOf(deps);
      if (!dep) return;
      const selected = [...dep.selectedAnchors];
      commitAnchorEdit(dep, LABEL, (set) => convertSegments(set, segmentsBetweenAnchors(set, selected), typeOf(params)));
    },
  } as ImmediateInvoker,
  enabled: (deps) => (hasSelectedSegments(deps) ? true : ActionDisabledReason.SelectionRequired),
};

/**
 * Shift+double-click a segment of the path being edited to
 * flip it between straight and curved. Off every segment the click falls
 * through.
 */
export const convertSegmentAtAction: Action & { requires: string[] } = inPlane({
  id: 'convertSegmentAt',
  label: 'Convert segment',
  defaultBinding: { kind: 'doubleClick', mods: { shift: true } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const wx = params?.worldX as number | undefined;
      const wy = params?.worldY as number | undefined;
      if (typeof wx !== 'number' || typeof wy !== 'number') return;
      const under = segmentUnder(deps, wx, wy);
      if (!under) return;
      const { dep, path, hit } = under;
      const next = editAnchorSetTracked(path, (set) => convertSegments(set, [hit], typeOf(params)));
      if (next) dep.applyEdit(dep.editingId, next.path, 'Convert segment', next.origins);
    },
  } as ImmediateInvoker,
  enabled: (deps, at) => {
    if (!deps?.editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
    if (at && !segmentUnder(deps, at.x, at.y)) return ActionDisabledReason.NotApplicable;
    return true;
  },
}, editingLayer);
