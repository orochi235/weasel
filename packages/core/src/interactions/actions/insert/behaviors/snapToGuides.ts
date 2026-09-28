import type {
  InsertBehavior,
  InsertPoint,
  ModifierState,
} from '../../../gestures/types';
import type { Guide } from 'features/guides/types';
import { screenTolerance } from '../../../gestures/shared/screenTolerance';
import { DEFAULT_GUIDE_TOLERANCE_PX } from '../../../gestures/shared/strategies/guides';

type ModKey = keyof ModifierState;

/** Options for the insert-flavored `snapToGuides`. */
export interface SnapToGuidesInsertArgs {
  /** Stable getter into the live guide list (typically from `useGuides`). */
  getGuides: () => readonly Guide[];
  /** Snap tolerance in screen px, read through the gesture's view. */
  tolerance?: number;
  /** Modifier key that bypasses snapping while held. */
  bypassKey?: ModKey;
}

function snapPoint(
  p: InsertPoint,
  guides: readonly Guide[],
  tol: { x: number; y: number },
): InsertPoint | null {
  let bestDx = 0;
  let bestAbsDx = Infinity;
  let bestDy = 0;
  let bestAbsDy = Infinity;
  for (const g of guides) {
    if (g.axis === 'x') {
      const d = g.offset - p.x;
      const ad = Math.abs(d);
      if (ad <= tol.x && ad < bestAbsDx) {
        bestAbsDx = ad;
        bestDx = d;
      }
    } else {
      const d = g.offset - p.y;
      const ad = Math.abs(d);
      if (ad <= tol.y && ad < bestAbsDy) {
        bestAbsDy = ad;
        bestDy = d;
      }
    }
  }
  if (bestAbsDx === Infinity && bestAbsDy === Infinity) return null;
  const dx = bestAbsDx === Infinity ? 0 : bestDx;
  const dy = bestAbsDy === Infinity ? 0 : bestDy;
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
  const tolerance = args.tolerance ?? DEFAULT_GUIDE_TOLERANCE_PX;
  const bypassKey = args.bypassKey;

  return {
    onStart(ctx) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const guides = args.getGuides();
      if (guides.length === 0) return;
      const id = ctx.draggedIds[0];
      const o = ctx.origin.get(id) as unknown as InsertPoint | undefined;
      if (!o) return;
      const snapped = snapPoint(o, guides, screenTolerance(tolerance, ctx));
      if (snapped) ctx.origin.set(id, snapped as unknown as TPose);
    },
    onMove(ctx, { current }) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const guides = args.getGuides();
      if (guides.length === 0) return;
      const snapped = snapPoint(current, guides, screenTolerance(tolerance, ctx));
      if (!snapped) return;
      return { current: snapped };
    },
  };
}
