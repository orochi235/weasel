import { pathToAnchors, anchorsToPath } from 'features/paths/anchors';
import type { PolygonPath, RectPath } from 'features/paths/types';
import { createSetPathOp } from 'core/ops/setPath';
import type { Op } from 'core/ops/types';
import type { PenScratch } from '../usePenTool';

export interface EnterEditArgs {
  objId: string;
  path: PolygonPath | RectPath;
  closed: boolean;
  params: unknown;
  isParametric: boolean;
}

export function enterEditMode(scratch: PenScratch, args: EnterEditArgs): void {
  const derived =
    args.path.kind === 'rect'
      ? rectToAnchors(args.path)
      : pathToAnchors(args.path);
  const closedArr = derived.closed.length > 0 ? derived.closed : [args.closed];

  scratch.mode = 'edit';
  scratch.edit = {
    objId: args.objId,
    anchors: derived.anchors,
    closed: closedArr,
    selectedAnchors: new Set(),
    activeHandle: null,
    dirty: false,
    preConvert: args.isParametric
      ? { path: args.path, closed: args.closed, params: args.params }
      : null,
    gestureBaseline: null,
    marquee: null,
  };
}

export function exitEditMode(scratch: PenScratch): void {
  scratch.mode = 'create';
  scratch.edit = null;
}

function rectToAnchors(
  rect: RectPath,
): { anchors: { x: number; y: number }[][]; closed: boolean[] } {
  return {
    anchors: [[
      { x: rect.x,               y: rect.y },
      { x: rect.x + rect.width,  y: rect.y },
      { x: rect.x + rect.width,  y: rect.y + rect.height },
      { x: rect.x,               y: rect.y + rect.height },
    ]],
    closed: [true],
  };
}

/**
 * Capture the gesture baseline — the path/closed/params snapshot used as
 * the `from` of the SetPathOp emitted when this gesture completes.
 *
 * On the first gesture in a session against a parametric shape, the
 * baseline IS the parametric form (sourced from `preConvert`), so undo
 * restores the original rect/etc. `preConvert` is then cleared so
 * subsequent gestures' baselines are plain polygons.
 */
export function captureGestureBaseline(scratch: PenScratch): void {
  if (!scratch.edit) return;
  if (scratch.edit.gestureBaseline !== null) return;
  if (scratch.edit.preConvert) {
    scratch.edit.gestureBaseline = {
      path: scratch.edit.preConvert.path,
      closed: scratch.edit.preConvert.closed,
      params: scratch.edit.preConvert.params,
    };
    scratch.edit.preConvert = null;
    return;
  }
  scratch.edit.gestureBaseline = {
    path: anchorsToPath(scratch.edit.anchors, scratch.edit.closed),
    closed: scratch.edit.closed[0] ?? false,
    params: undefined,
  };
}

/**
 * Build the SetPathOp for the current gesture and clear gestureBaseline.
 * Returns null when no baseline was captured (caller forgot) or the edit
 * isn't dirty (no-op gesture — don't push).
 */
export function commitGestureOp(scratch: PenScratch, label: string): Op | null {
  if (!scratch.edit) return null;
  if (!scratch.edit.gestureBaseline) return null;
  if (!scratch.edit.dirty) {
    scratch.edit.gestureBaseline = null;
    return null;
  }
  const baseline = scratch.edit.gestureBaseline;
  const newPath = anchorsToPath(scratch.edit.anchors, scratch.edit.closed);
  const newClosed = scratch.edit.closed[0] ?? false;
  scratch.edit.gestureBaseline = null;
  return createSetPathOp({
    id: scratch.edit.objId,
    from: baseline,
    to: { path: newPath, closed: newClosed, params: undefined },
    label,
  });
}
