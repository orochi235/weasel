/**
 * `bendSegmentAction` — drag a segment of the path being edited to reshape
 * it: the point pressed follows the pointer, and the segment's two handles
 * move to carry it (`bendSegment`). A straight segment becomes a curve.
 *
 * Bound to the `segment` affordance path edit lays along the outline, which
 * ties the marquee's `empty` and move's `selected-body` on specificity and
 * registers ahead of the marquee; move turns segment presses down itself.
 * An anchor's own affordance sits above the segment's, so a press on an
 * anchor is the anchor drag's. On a path drawn from a form whose
 * representation takes segment presses (`PathRepresentation.segmentPress`),
 * the press is the representation's instead.
 */

import type { Action, ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { ActionDisabledReason, isSegment } from '@weasel-js/routing';
import type { CursorSpec } from '@weasel-js/cursor';
import { bendSegment, editAnchorSetTracked, type PointOrigin, type PolygonPath } from '@weasel-js/geom';
import { inPlane, editingLayer } from '../planeInput';
import { pathEditPreview } from '../edit-anchors/preview';
import { segmentUnder } from './segmentUnder';
import { representationOf, type PathRepresentation } from 'features/paths/pathRepresentation';
import { pathEditToolActive } from './pathEditTools';
import { pathOperationTags } from '../pathGestureTags';
import { icon } from '../../../icons.gen';

const BEND_CURSOR: CursorSpec = 'grab';

/** The segment press of the representation the path in edit is drawn
 *  through, when it takes them. */
function representedPress(deps: ActionDeps | undefined): NonNullable<PathRepresentation['segmentPress']> | null {
  const dep = deps?.editAnchors;
  if (!dep?.editingId) return null;
  const representation = representationOf(dep.extensions, dep.getNodeShape(dep.editingId)?.data)?.representation;
  return representation?.segmentPress ? (on, at) => representation.segmentPress!(on, at) : null;
}

export const bendSegmentAction: Action & { requires: string[] } = inPlane({
  id: 'bendSegment',
  label: 'Bend segment',
  icon: icon('bendSegment'),
  tags: pathOperationTags('drag'),
  defaultBinding: [{ spec: { kind: 'drag', target: { kindOf: isSegment } }, opts: { id: 'bendSegment.drag' } }],
  cursor: BEND_CURSOR,
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view', 'kitSettings'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const represented = representedPress(ctx.deps);
      if (represented) return represented(ctx.deps, ctx.world)?.() ?? {};
      const under = segmentUnder(ctx.deps, ctx.world.x, ctx.world.y);
      if (!under) return {};
      const { dep, path: originPath, hit } = under;
      const id = dep.editingId;
      const press = { x: ctx.world.x, y: ctx.world.y };
      let current: { path: PolygonPath; origins?: readonly (PointOrigin | null)[] } | null = null;
      const preview = pathEditPreview(dep, id, () => current);
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
    if (!deps?.editAnchors?.editingId || pathEditToolActive(deps)) return ActionDisabledReason.NotApplicable;
    const represented = representedPress(deps);
    const hit = (p: { x: number; y: number }) =>
      (represented ? represented(deps, p) : segmentUnder(deps, p.x, p.y)) !== null;
    if (at && !hit(at)) return ActionDisabledReason.NotApplicable;
    return true;
  },
}, editingLayer);
