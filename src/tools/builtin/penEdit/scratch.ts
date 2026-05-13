import { pathToAnchors, anchorsToPath } from 'features/paths/anchors';
import type { PolygonPath, RectPath } from 'features/paths/types';
import { createSetPathOp } from 'core/ops/setPath';
import type { Op } from 'core/ops/types';
import type { PenScratch } from '../useUserPenTool';

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
    original: {
      path: anchorsToPath(derived.anchors, closedArr),
      closed: closedArr[0] ?? false,
    },
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
 * Build the SetPathOp that commits the current edit state to history.
 * Returns null when the edit is not dirty (entering edit + exiting without
 * mutation is a no-op, including for parametric trapdoors).
 *
 * NOTE: This implementation has a known bug in the `from` snapshot for
 * non-trapdoor edits — it computes the snapshot from current (post-edit)
 * anchors, which means undo would no-op. Task 21 fixes this by snapshotting
 * the entry state on `enterEditMode`.
 */
export function commitEditAsOp(scratch: PenScratch): Op | null {
  if (!scratch.edit || !scratch.edit.dirty) return null;
  const newPath = anchorsToPath(scratch.edit.anchors, scratch.edit.closed);
  const newClosed = scratch.edit.closed[0] ?? false;
  const fromFields = scratch.edit.preConvert
    ? scratch.edit.preConvert
    : { path: scratch.edit.original.path, closed: scratch.edit.original.closed, params: undefined };
  return createSetPathOp({
    id: scratch.edit.objId,
    from: fromFields,
    to: { path: newPath, closed: newClosed, params: undefined },
    label: 'Edit path',
    coalesceKey: `penEdit:${scratch.edit.objId}`,
  });
}
