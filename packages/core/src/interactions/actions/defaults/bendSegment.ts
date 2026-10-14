/**
 * `bendSegmentAction` — drag a segment of the path being edited to reshape
 * it: the point pressed follows the pointer, and the segment's two handles
 * move to carry it (`bendSegment`). A straight segment becomes a curve.
 *
 * Bound to the `segment` affordance path edit lays along the outline, which
 * ties the marquee's `empty` and move's `selected-body` on specificity and
 * registers ahead of the marquee; move turns segment presses down itself.
 * An anchor's own affordance sits above the segment's, so a press on an
 * anchor is the anchor drag's.
 */

import type { Action, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { ActionDisabledReason, isSegment } from '@weasel-js/routing';
import type { CursorSpec } from '@weasel-js/cursor';
import { bendSegment, editAnchorSetTracked, type PointOrigin, type PolygonPath } from '@weasel-js/geom';
import { inPlane, editingLayer } from '../planeInput';
import { pathEditPreview } from '../edit-anchors/preview';
import { segmentUnder } from './segmentUnder';

const BEND_CURSOR: CursorSpec = 'grab';

export const bendSegmentAction: Action & { requires: string[] } = inPlane({
  id: 'bendSegment',
  label: 'Bend segment',
  defaultBinding: { kind: 'drag', target: { kindOf: isSegment } },
  cursor: BEND_CURSOR,
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const under = segmentUnder(ctx.deps, ctx.world.x, ctx.world.y);
      if (!under) return {};
      const { dep, path: originPath, hit } = under;
      const id = dep.editingId;
      const press = { x: ctx.world.x, y: ctx.world.y };
      let current: { path: PolygonPath; origins?: readonly (PointOrigin | null)[] } | null = null;
      const preview = pathEditPreview(dep, id, () => current?.path ?? null);
      if (!preview) return {};

      return {
        kind: 'bend-segment',
        onMove(moveCtx: InvocationCtx): void {
          const dx = moveCtx.world.x - press.x;
          const dy = moveCtx.world.y - press.y;
          current = editAnchorSetTracked(originPath, (set) => bendSegment(set, hit, dx, dy)) ?? current;
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          const done = current;
          current = null;
          if (reason === 'cancel' || !done) return;
          dep.applyEdit(id, done.path, 'Bend segment', done.origins);
        },
        previewIds: preview.previewIds,
        previewPose: preview.previewPose,
        previewData: preview.previewData,
      };
    },
  },
  enabled: (deps, at) => {
    if (!deps?.editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
    if (at && !segmentUnder(deps, at.x, at.y)) return ActionDisabledReason.NotApplicable;
    return true;
  },
}, editingLayer);
