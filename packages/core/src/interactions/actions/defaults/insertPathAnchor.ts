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

import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { CursorSpec } from '@weasel-js/cursor';
import type { EditAnchorsDep, ViewApi } from '../depSchema';
import type { PolygonPath } from 'features/paths/types';
import { pathToAnchors } from 'features/paths/anchors';
import {
  editAnchorSet,
  insertAnchorOnSegment,
  segmentAt,
  type AnchorSet,
  type SegmentHit,
} from 'features/paths/anchorEdits';

/** Screen-px reach of a segment, and the radius around each anchor that
 *  stays the anchor's. Matches the path-anchor affordance's default hit
 *  radius, so the two regions meet without a gap. */
const SEGMENT_HIT_PX = 8;

const INSERT_CURSOR: CursorSpec = { glyph: 'pen', fallback: 'crosshair' };

function segmentUnder(
  deps: ActionDeps | undefined,
  x: number,
  y: number,
): { dep: EditAnchorsDep; hit: SegmentHit } | null {
  const dep = deps?.editAnchors as EditAnchorsDep | undefined;
  if (!dep?.editingId) return null;
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | null | undefined;
  if (!path || path.kind !== 'polygon') return null;
  const scale = (deps?.view as ViewApi | undefined)?.get().scale;
  const hit = segmentAt(pathToAnchors(path) as AnchorSet, x, y, {
    tolerancePx: SEGMENT_HIT_PX,
    ...(scale ? { scale } : {}),
  });
  return hit ? { dep, hit } : null;
}

export const insertPathAnchorAction: Action & { requires: string[] } = {
  id: 'insertPathAnchor',
  label: 'Insert anchor',
  defaultBinding: { kind: 'click', mods: { alt: true } },
  cursor: INSERT_CURSOR,
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
      const { dep, hit } = under;
      const path = dep.getEditablePath(dep.editingId) as PolygonPath;
      let inserted = -1;
      const next = editAnchorSet(path, (set) => {
        inserted = insertAnchorOnSegment(set, hit);
        return inserted !== -1;
      });
      if (!next) return;
      dep.applyEdit(dep.editingId, next, 'Insert anchor');
      dep.setSelectedAnchors([inserted]);
    },
  } as ImmediateInvoker,
  enabled: (deps, at) => {
    const dep = deps?.editAnchors as EditAnchorsDep | undefined;
    if (!dep?.editingId) return ActionDisabledReason.NotApplicable;
    if (at && !segmentUnder(deps, at.x, at.y)) return ActionDisabledReason.NotApplicable;
    return true;
  },
};
