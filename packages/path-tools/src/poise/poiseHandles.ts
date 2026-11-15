/**
 * The poise grip on each curved segment of the path being edited, midway
 * along the line joining its two handle tips:
 *
 *   - `poiseHandles` — drag the grip to scale both handles together, each
 *     along its own direction, so the segment fills out toward its corner or
 *     flattens toward its chord without turning at either end.
 *   - `equalizeHandles` — double-click the grip to give both handles the same
 *     proportion of the way to that corner.
 *
 * The grips are the `poise:N` affordances path edit lays out, shown and
 * hit-tested only while chrome-caps shows `path-edit.poise`. N is the flat
 * index of the anchor the segment starts at.
 *
 * Under a `pathSymmetry` dep a grip drag moves every image of both handles,
 * as `editAnchors` moves a dragged handle's. Both keep each handle's angle, so an angle lock holds through them. A length
 * lock in force for handle drags (the `editAnchors` dep's `handleLocks`, or Mod)
 * holds the drag still, as it would a handle drag with the angle held too.
 */

import {
  type Action, type ActionDeps, ActionDisabledReason, defineAction, type InvocationCtx, isPoiseGrip, type OngoingHandle, roleMods,
} from '@weasel-js/routing';
import {
  poiseFactorToward,
  editAnchorSetTracked,
  equalizeSegmentHandles,
  locateAnchor,
  pathToAnchors,
  scaleSegmentHandles,
  type AnchorSet,
  type PointOrigin,
  type PolygonPath,
} from '@weasel-js/geom';
import {
  commitAnchorEdit, type EditAnchorsDep, editedPathSymmetries, editingLayer, HANDLE_LOCK_ROLES, inPlane, locksInForce, pathEditPreview, pathOperationTags,
} from '@weasel-js/core';
import { icon } from '../icons.gen';
import type {} from '../actionParamSchema';

/** The segment a `poise:N` affordance names, on the path being edited. */
function gripTarget(
  dep: EditAnchorsDep | undefined,
  kind: string | undefined,
): { dep: EditAnchorsDep; path: PolygonPath; sub: number; segIdx: number } | null {
  if (!dep?.editingId || !kind) return null;
  const m = kind.match(/^poise:(\d+)$/);
  if (!m) return null;
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | null | undefined;
  if (!path || path.kind !== 'polygon') return null;
  const loc = locateAnchor(pathToAnchors(path) as AnchorSet, parseInt(m[1], 10));
  return loc ? { dep, path, sub: loc.sub, segIdx: loc.idx } : null;
}

const NO_LOCKS = { angle: false, length: false };

/** Enabled while a path is open. */
function gripEnabled(deps: ActionDeps | undefined): true | ActionDisabledReason {
  if (!deps?.editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
  return true;
}

/** Drag a segment's poise grip to scale both its handles together. */
export const poiseHandlesAction: Action & { requires: string[] } = inPlane({
  id: 'poiseHandles',
  label: 'Poise',
  icon: icon('poise'),
  tags: pathOperationTags('drag'),
  // Ties the marquee's `empty` and move's `selected-body` on specificity and
  // registers ahead of the marquee; move turns path-edit presses down itself.
  defaultBinding: [{ spec: { kind: 'drag', target: { kindOf: isPoiseGrip }, mods: roleMods(HANDLE_LOCK_ROLES) }, opts: { id: 'poiseHandles.drag' } }],
  cursor: 'grab',
  eligible: { capability: 'edits-anchors' },
  modifierRoles: HANDLE_LOCK_ROLES,
  requires: ['editAnchors', 'pathSymmetry'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const target = gripTarget(ctx.deps.editAnchors, ctx.drag?.affordance?.kind);
      if (!target) return {};
      const { dep, path: originPath, sub, segIdx } = target;
      const id = dep.editingId;
      const origin = pathToAnchors(originPath) as AnchorSet;
      const symmetries = editedPathSymmetries(ctx.deps.pathSymmetry, id, origin);
      // The grip is wherever the press landed within its radius; measure the
      // drag from there so the grab doesn't jump.
      const press = { x: ctx.world.x, y: ctx.world.y };
      const pressFactor = poiseFactorToward(origin, sub, segIdx, press);
      let current: { path: PolygonPath; origins?: readonly (PointOrigin | null)[] } | null = null;
      const preview = pathEditPreview(dep, id, () => current);
      if (!preview) return {};

      return {
        kind: 'poise',
        onMove(moveCtx: InvocationCtx): void {
          // Read live, like a handle drag's, so a lock can change mid-drag.
          const held = dep.handleLocks ?? NO_LOCKS;
          if (locksInForce(held, moveCtx).length) {
            current = null;
            return;
          }
          const at = poiseFactorToward(origin, sub, segIdx, moveCtx.world);
          const factor = pressFactor > 0 ? at / pressFactor : at;
          current = editAnchorSetTracked(originPath, (set) => scaleSegmentHandles(set, sub, segIdx, factor, symmetries));
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          const done = current;
          current = null;
          if (reason === 'cancel' || !done) return;
          dep.applyEdit(id, done.path, 'Poise', done.origins);
        },
        previewIds: preview.previewIds,
        previewPose: preview.previewPose,
        previewData: preview.previewData,
      };
    },
  },
  enabled: gripEnabled,
}, editingLayer);

/** Double-click a segment's poise grip to even out its handles' proportions, every image of them with them under a
 *  `pathSymmetry` dep. */
export const equalizeHandlesAction = defineAction({
  id: 'equalizeHandles',
  label: 'Equalize handles',
  icon: icon('equalizeHandles'),
  tags: pathOperationTags('click'),
  defaultBinding: [{ spec: { kind: 'doubleClick', target: { kindOf: isPoiseGrip } }, opts: { id: 'equalizeHandles.doubleClick' } }],
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'pathSymmetry'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const kind = params?.affordance?.kind;
      const target = gripTarget(deps.editAnchors, kind);
      if (!target) return;
      const { dep, sub, segIdx } = target;
      commitAnchorEdit(dep, 'Equalize handles', (set) =>
        equalizeSegmentHandles(set, sub, segIdx, editedPathSymmetries(deps.pathSymmetry, dep.editingId, set)));
    },
  },
  enabled: gripEnabled,
});
