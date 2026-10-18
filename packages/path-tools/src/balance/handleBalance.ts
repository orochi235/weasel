/**
 * The balance grip on each curved segment of the path being edited, midway
 * along the line joining its two handle tips:
 *
 *   - `balanceHandles` — drag the grip to scale both handles together, each
 *     along its own direction, so the segment fills out toward its corner or
 *     flattens toward its chord without turning at either end.
 *   - `equalizeHandles` — double-click the grip to give both handles the same
 *     proportion of the way to that corner.
 *
 * The grips are the `balance:N` affordances path edit lays out, shown and
 * hit-tested only while chrome-caps shows `path-edit.balance`. N is the flat
 * index of the anchor the segment starts at.
 *
 * Under a `pathSymmetry` dep a grip drag moves every image of both handles,
 * as `editAnchors` moves a dragged handle's. Both keep each handle's angle, so an angle lock holds through them. A length
 * lock in force for handle drags (the `editAnchors` dep's `handleLocks`, or Mod)
 * holds the drag still, as it would a handle drag with the angle held too.
 */

import {
  type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker, type InvocationCtx, isBalanceGrip, type OngoingHandle,
} from '@weasel-js/routing';
import {
  balanceFactorToward,
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
  commitAnchorEdit, type EditAnchorsDep, editedPathSymmetries, editingLayer, HANDLE_LOCK_ROLES, inPlane, locksInForce, pathEditPreview, pathEditToolActive, pathOperationTags,
} from '@weasel-js/core';
import { icon } from '../icons.gen';

/** The segment a `balance:N` affordance names, on the path being edited. */
function gripTarget(
  dep: EditAnchorsDep | undefined,
  kind: string | undefined,
): { dep: EditAnchorsDep; path: PolygonPath; sub: number; segIdx: number } | null {
  if (!dep?.editingId || !kind) return null;
  const m = kind.match(/^balance:(\d+)$/);
  if (!m) return null;
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | null | undefined;
  if (!path || path.kind !== 'polygon') return null;
  const loc = locateAnchor(pathToAnchors(path) as AnchorSet, parseInt(m[1], 10));
  return loc ? { dep, path, sub: loc.sub, segIdx: loc.idx } : null;
}

const NO_LOCKS = { angle: false, length: false };

/** Enabled while a path is open and no path-edit tool has the pointer. */
function gripEnabled(deps: ActionDeps | undefined): true | ActionDisabledReason {
  if (!deps?.editAnchors?.editingId || pathEditToolActive(deps)) return ActionDisabledReason.NotApplicable;
  return true;
}

/** Drag a segment's balance grip to scale both its handles together. */
export const balanceHandlesAction: Action & { requires: string[] } = inPlane({
  id: 'balanceHandles',
  label: 'Balance handles',
  icon: icon('balanceHandles'),
  tags: pathOperationTags('drag'),
  // Ties the marquee's `empty` and move's `selected-body` on specificity and
  // registers ahead of the marquee; move turns path-edit presses down itself.
  defaultBinding: { kind: 'drag', target: { kindOf: isBalanceGrip } },
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
      const pressFactor = balanceFactorToward(origin, sub, segIdx, press);
      let current: { path: PolygonPath; origins?: readonly (PointOrigin | null)[] } | null = null;
      const preview = pathEditPreview(dep, id, () => current?.path ?? null);
      if (!preview) return {};

      return {
        kind: 'balance-handles',
        onMove(moveCtx: InvocationCtx): void {
          // Read live, like a handle drag's, so a lock can change mid-drag.
          const held = (moveCtx.deps.editAnchors ?? dep).handleLocks ?? NO_LOCKS;
          if (locksInForce(held, moveCtx).length) {
            current = null;
            return;
          }
          const at = balanceFactorToward(origin, sub, segIdx, moveCtx.world);
          const factor = pressFactor > 0 ? at / pressFactor : at;
          current = editAnchorSetTracked(originPath, (set) => scaleSegmentHandles(set, sub, segIdx, factor, symmetries)) ?? current;
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          const done = current;
          current = null;
          if (reason === 'cancel' || !done) return;
          dep.applyEdit(id, done.path, 'Balance handles', done.origins);
        },
        previewIds: preview.previewIds,
        previewPose: preview.previewPose,
        previewData: preview.previewData,
      };
    },
  },
  enabled: gripEnabled,
}, editingLayer);

/** Double-click a segment's balance grip to even out its handles' proportions. */
export const equalizeHandlesAction: Action & { requires: string[] } = {
  id: 'equalizeHandles',
  label: 'Equalize handles',
  icon: icon('equalizeHandles'),
  tags: pathOperationTags('click'),
  defaultBinding: { kind: 'doubleClick', target: { kindOf: isBalanceGrip } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const kind = (params?.affordance as { kind?: string } | undefined)?.kind;
      const target = gripTarget(deps.editAnchors, kind);
      if (!target) return;
      const { dep, sub, segIdx } = target;
      commitAnchorEdit(dep, 'Equalize handles', (set) => equalizeSegmentHandles(set, sub, segIdx));
    },
  } as ImmediateInvoker,
  enabled: gripEnabled,
};
