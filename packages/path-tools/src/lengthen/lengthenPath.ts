import {
  type Action, ActionDisabledReason, type ActionDeps, type BindingOpts, type InvocationCtx, isAnchor,
  type OngoingHandle, resolveParams,
} from '@weasel-js/routing';
import type { CursorSpec } from '@weasel-js/cursor';
import {
  editAnchorSetTracked, lengthenPathEnd, lengthToward, nearestPathAnchor, openEndAt, pathEndAnchorIndex,
  pathEndFrame, pathToAnchors, type AnchorSet, type LengthenMode, type PointOrigin, type PolygonPath,
} from '@weasel-js/geom';
import {
  depOf, type EditAnchorsDep, editingLayer, inPlane, pathEditPreview, pathEditToolAction, pathOperationTags,
} from '@weasel-js/core';
import { icon } from '../icons.gen';

/** The path-edit tool under which a drag on an open end lengthens the path. */
export const LENGTHEN_TOOL = 'lengthen';

/** Params `lengthenPath` reads on every move. */
export interface LengthenPathParams {
  /** How an unmodified drag grows the end; Shift picks the other. Default `'tangent'`. */
  mode?: LengthenMode;
}

const LENGTHEN_CURSOR: CursorSpec = { glyph: 'penPlus', fallback: 'crosshair' };

/** Screen-px reach of an end anchor, matching the anchor affordance's hit radius. */
const END_HIT_PX = 8;

function editedPath(deps: ActionDeps | undefined): { dep: EditAnchorsDep; path: PolygonPath } | null {
  const dep = depOf(deps);
  if (!dep || dep.tool !== LENGTHEN_TOOL) return null;
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | null | undefined;
  return path?.kind === 'polygon' ? { dep, path } : null;
}

/** Whether an open end of the edited path lies under world point `(x, y)`. */
function endUnder(deps: ActionDeps | undefined, x: number, y: number): boolean {
  const edited = editedPath(deps);
  if (!edited) return false;
  const scale = deps?.view?.get().scale ?? { x: 1, y: 1 };
  const hit = nearestPathAnchor([{ id: edited.dep.editingId, path: edited.path }], { x, y }, END_HIT_PX, scale);
  return !!hit && hit.end !== null && pathToAnchors(edited.path).anchors[hit.sub].length > 1;
}

/** The `mode` param, or the other mode while `flip` is held. */
function modeOf(opts: BindingOpts | undefined, flip: boolean): LengthenMode {
  const mode = (resolveParams(opts?.params) as LengthenPathParams | undefined)?.mode;
  const base: LengthenMode = mode === 'curvature' ? 'curvature' : 'tangent';
  if (!flip) return base;
  return base === 'curvature' ? 'tangent' : 'curvature';
}

function pressedAnchor(ctx: InvocationCtx): number {
  const m = ctx.drag?.affordance?.kind.match(/^anchor:(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;
}

/**
 * Lengthen, the path-edit tool's drag. While path edit's `lengthen` tool is
 * on, dragging an open path's end anchor lengthens the path from that end
 * (`lengthenPathEnd`): straight along its end tangent, or along an arc with
 * the curvature the end has. Dragging back into the path shortens it along
 * itself. The `mode` param (`'tangent'`, the default, or `'curvature'`) picks
 * which, and Shift picks the other; both are read on every move. One undo
 * step per drag. With the tool off, a drag on the anchor is `editAnchors`'
 * and moves it.
 */
export const lengthenPathAction: Action & { requires: string[] } = inPlane({
  id: 'lengthenPath',
  label: 'Lengthen path',
  tags: pathOperationTags('drag'),
  defaultBinding: { kind: 'drag', target: { kindOf: isAnchor }, mods: { shift: 'optional' } },
  cursor: LENGTHEN_CURSOR,
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const edited = editedPath(ctx.deps);
      if (!edited) return {};
      const { dep, path: originPath } = edited;
      const origin = pathToAnchors(originPath) as AnchorSet;
      const end = openEndAt(origin, pressedAnchor(ctx));
      const frame = end && pathEndFrame(origin, end);
      if (!end || !frame) return {};
      const id = dep.editingId;
      const press = ctx.drag?.start ?? ctx.world;
      let distance = 0;
      let current: { path: PolygonPath; origins?: readonly (PointOrigin | null)[] } | null = null;
      const preview = pathEditPreview(dep, id, () => current);
      if (!preview) return {};

      return {
        kind: 'lengthen-path',
        onMove(moveCtx: InvocationCtx): void {
          const mode = modeOf(opts, moveCtx.modifiers.shift);
          const toward = {
            x: frame.point.x + moveCtx.world.x - press.x,
            y: frame.point.y + moveCtx.world.y - press.y,
          };
          distance = lengthToward(origin, end, mode, toward, distance);
          current = editAnchorSetTracked(originPath, (set) => lengthenPathEnd(set, end, distance, mode));
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          const done = current;
          current = null;
          if (reason === 'cancel' || !done) return;
          dep.applyEdit(id, done.path, distance < 0 ? 'Shorten path' : 'Lengthen path', done.origins);
          const index = pathEndAnchorIndex(pathToAnchors(done.path) as AnchorSet, end);
          if (index !== -1) dep.setSelectedAnchors([index]);
        },
        previewIds: preview.previewIds,
        previewPose: preview.previewPose,
        previewData: preview.previewData,
      };
    },
  },
  enabled: (deps, at) => {
    if (depOf(deps)?.tool !== LENGTHEN_TOOL) return ActionDisabledReason.NotApplicable;
    if (at && !endUnder(deps, at.x, at.y)) return ActionDisabledReason.NotApplicable;
    return true;
  },
}, editingLayer);

/** The bar toggle for Lengthen: `pathEditTool.lengthen`. */
export const lengthenToolAction = pathEditToolAction(LENGTHEN_TOOL, 'Lengthen', icon('lengthen'));
