/**
 * Make segments of the path being edited straight or curved, in place
 * (`convertSegments`): the selected segments from the keyboard, or the one
 * under a Shift+double-click.
 */
import { ActionDisabledReason, type Action, type ImmediateInvoker } from '@weasel-js/routing';
import { convertSegments, editAnchorSetTracked, segmentsBetweenAnchors, type SegmentType } from '@weasel-js/geom';
import {
  anchorEditWouldChange, commitAnchorEdit, depOf, editingLayer, inPlane, pathOperationTags, segmentUnder,
} from '@weasel-js/core';
import { icon } from '../icons.gen';

const LABEL = 'Convert segments';

const typeOf = (params: Record<string, unknown> | undefined): SegmentType | undefined =>
  (params?.to === 'line' || params?.to === 'curve' ? params.to : undefined);

/**
 * Convert the selected segments — those whose two ends are both
 * selected anchors. `params.to` `'line'` straightens them, `'curve'` curves
 * them with handles at their thirds so they keep their shape, and no `to`
 * (Shift+C) curves them all when any is straight and straightens them
 * otherwise.
 */
export const convertSegmentsAction: Action & { requires: string[] } = {
  id: 'convertSegments',
  icon: icon('convertSegment'),
  label: LABEL,
  tags: pathOperationTags('command'),
  group: 'anchors',
  variants: [
    { key: 'line', label: 'Make segments straight', icon: icon('straightenSegment'), params: { to: 'line' } },
    { key: 'curve', label: 'Make segments curved', icon: icon('curveSegment'), params: { to: 'curve' } },
  ],
  defaultBinding: [{ spec: { kind: 'key', key: ['c', 'C'], mods: { shift: true } }, opts: { id: 'convertSegments.key' } }],
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
  enabled: (deps) => {
    const selected = [...(depOf(deps)?.selectedAnchors ?? [])];
    const any = selected.length > 1
      && anchorEditWouldChange(deps, (set) => convertSegments(set, segmentsBetweenAnchors(set, selected)));
    return any ? true : ActionDisabledReason.SelectionRequired;
  },
};

/**
 * Shift+double-click a segment of the path being edited to flip
 * it between straight and curved. Off every segment the click falls through.
 */
export const convertSegmentAtAction: Action & { requires: string[] } = inPlane({
  id: 'convertSegmentAt',
  icon: icon('convertSegment'),
  label: 'Convert segment',
  tags: pathOperationTags('click'),
  defaultBinding: [{ spec: { kind: 'doubleClick', mods: { shift: true } }, opts: { id: 'convertSegmentAt.doubleClick' } }],
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view', 'kitSettings'],
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
