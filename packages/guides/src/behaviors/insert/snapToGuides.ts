import {
  type GestureContext,
  type InsertBehavior,
  type InsertPoint,
  type ModifierState,
  screenTolerance,
} from '@weasel-js/core';
import type { Guide } from '../../guides/types';
import { guideTolerance } from '../../strategies/guides';
import { nearestGuideDelta } from '../../strategies/onPlane';

type ModKey = keyof ModifierState;

/** Options for the insert-flavored `snapToGuides`. */
export interface SnapToGuidesInsertArgs {
  /** Stable getter into the live guide list (typically from `useGuides`). */
  getGuides: () => readonly Guide[];
  /** Snap tolerance in screen px, read through the gesture's view. Default the
   *  `targets.guideSnapPx` kit setting, else `DEFAULT_GUIDE_TOLERANCE_PX`. */
  tolerance?: number;
  /** Modifier key that bypasses snapping while held. */
  bypassKey?: ModKey;
}

function snapPoint(
  p: InsertPoint,
  guides: readonly Guide[],
  tol: { x: number; y: number },
  plane: GestureContext<unknown>['plane'],
): InsertPoint | null {
  const dx = nearestGuideDelta(guides, 'x', p.x, tol.x, plane) ?? 0;
  const dy = nearestGuideDelta(guides, 'y', p.y, tol.y, plane) ?? 0;
  if (dx === 0 && dy === 0) return null;
  return { x: p.x + dx, y: p.y + dy };
}

/**
 * Insert behavior that snaps the start anchor (on gesture start) and the
 * live current point (during drag) to the nearest guide on each axis when
 * within `tolerance`. Pair with `useGuides` and `createGuidesLayer`.
 */
export function snapToGuides<TPose>(
  args: SnapToGuidesInsertArgs,
): InsertBehavior<TPose> {
  const bypassKey = args.bypassKey;

  return {
    onStart(ctx) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const guides = args.getGuides();
      if (guides.length === 0) return;
      const id = ctx.draggedIds[0];
      const o = ctx.origin.get(id) as unknown as InsertPoint | undefined;
      if (!o) return;
      const snapped = snapPoint(o, guides, screenTolerance(guideTolerance(args.tolerance, ctx), ctx), ctx.plane);
      if (snapped) ctx.origin.set(id, snapped as unknown as TPose);
    },
    onMove(ctx, { current }) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const guides = args.getGuides();
      if (guides.length === 0) return;
      const snapped = snapPoint(current, guides, screenTolerance(guideTolerance(args.tolerance, ctx), ctx), ctx.plane);
      if (!snapped) return;
      return { current: snapped };
    },
  };
}
