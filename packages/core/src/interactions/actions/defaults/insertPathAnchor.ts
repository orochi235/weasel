/**
 * `insertPathAnchorAction` — Alt+click on a segment of the path being
 * edited inserts a new anchor there, without changing the path's shape.
 *
 * Alt+click because plain click already belongs to `selectAnchorAction`
 * (select an anchor, or clear the anchor selection on a miss), and
 * Alt+Shift+click to `cutPathAtAnchorAction`.
 *
 * The segment test lives in `enabled`, which the dispatcher hands the
 * event's world point: a click off every segment (or on an anchor) reports
 * not-applicable, so the dispatcher falls through to whatever else the
 * click could mean, and the hover pump shows `cursor` only where a click
 * would insert.
 */

import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { CursorSpec } from '@weasel-js/cursor';
import { editAnchorSetTracked, insertAnchorOnSegment } from '@weasel-js/geom';
import { inPlane, editingLayer } from '../planeInput';
import { segmentUnder } from './segmentUnder';
import { pathOperationTags } from '../pathGestureTags';
import type { ImmediateParams } from '@weasel-js/routing';

const INSERT_CURSOR: CursorSpec = { glyph: 'penPlus', fallback: 'crosshair' };

export const insertPathAnchorAction: Action & { requires: string[] } = inPlane({
  id: 'insertPathAnchor',
  label: 'Insert anchor',
  tags: pathOperationTags('click'),
  defaultBinding: [{ spec: { kind: 'click', mods: { alt: true } }, opts: { id: 'insertPathAnchor.click' } }],
  cursor: INSERT_CURSOR,
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view', 'kitSettings'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const world = (params as ImmediateParams | undefined)?.world;
      if (!world) return;
      const { x: wx, y: wy } = world;
      const under = segmentUnder(deps, wx, wy);
      if (!under) return;
      const { dep, path, hit } = under;
      let inserted = -1;
      const next = editAnchorSetTracked(path, (set) => {
        inserted = insertAnchorOnSegment(set, hit);
        return inserted !== -1;
      });
      if (!next) return;
      dep.applyEdit(dep.editingId, next.path, 'Insert anchor', next.origins);
      dep.setSelectedAnchors([inserted]);
    },
  } as ImmediateInvoker,
  enabled: (deps, at) => {
    const dep = deps?.editAnchors;
    if (!dep?.editingId) return ActionDisabledReason.NotApplicable;
    if (at && !segmentUnder(deps, at.x, at.y)) return ActionDisabledReason.NotApplicable;
    return true;
  },
}, editingLayer);
