import { pathToAnchors } from 'features/paths/anchors';
import type { PolygonPath, RectPath } from 'features/paths/types';
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

  scratch.mode = 'edit';
  scratch.edit = {
    objId: args.objId,
    anchors: derived.anchors,
    closed: derived.closed.length > 0 ? derived.closed : [args.closed],
    selectedAnchors: new Set(),
    activeHandle: null,
    dirty: false,
    preConvert: args.isParametric
      ? { path: args.path, closed: args.closed, params: args.params }
      : null,
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
