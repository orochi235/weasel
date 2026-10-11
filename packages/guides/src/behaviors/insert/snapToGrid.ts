import type {
  GestureContext,
  InsertBehavior,
  InsertPoint,
  ModifierState,
} from '@weasel-js/core';
import { roundToGridOn } from '../../strategies/onPlane';

type ModKey = keyof ModifierState;

/** Insert behavior that rounds the insertion point to a grid, so a shape
 *  drawn freehand lands on grid intersections. Hold `bypassKey` to place
 *  freely. */
export function snapToGrid<TPose>(args: {
  spacing: number;
  bypassKey?: ModKey;
}): InsertBehavior<TPose> {
  const { spacing, bypassKey } = args;
  const round = (p: InsertPoint, plane: GestureContext<unknown>['plane']): InsertPoint => ({
    x: roundToGridOn(p.x, 'x', spacing, plane),
    y: roundToGridOn(p.y, 'y', spacing, plane),
  });
  return {
    onStart(ctx) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const id = ctx.draggedIds[0];
      const o = ctx.origin.get(id) as unknown as InsertPoint | undefined;
      if (!o) return;
      ctx.origin.set(id, round(o, ctx.plane) as unknown as TPose);
    },
    onMove(ctx, { current }) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      return { current: round(current, ctx.plane) };
    },
  };
}
