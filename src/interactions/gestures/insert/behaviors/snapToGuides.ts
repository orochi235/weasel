import type {
  InsertBehavior,
  InsertPoint,
  ModifierState,
} from '../../types';
import type { Guide } from 'features/guides/types';
import type { View } from 'core/viewport/view';
import { DEFAULT_GUIDE_TOLERANCE_PX } from '../../shared/strategies/guides';

type ModKey = keyof ModifierState;

/** Options for the insert-flavored `snapToGuides`. */
export interface SnapToGuidesInsertArgs {
  /** Stable getter into the live guide list (typically from `useGuides`). */
  getGuides: () => readonly Guide[];
  /** Snap tolerance (screen px when `getView` is set, world units otherwise). */
  tolerance?: number;
  /** Read the active view; required for screen-pixel tolerance. */
  getView?: () => View;
  /** Modifier key that bypasses snapping while held. */
  bypassKey?: ModKey;
}

function snapPoint(
  p: InsertPoint,
  guides: readonly Guide[],
  worldTolerance: number,
): InsertPoint | null {
  let bestDx = 0;
  let bestAbsDx = Infinity;
  let bestDy = 0;
  let bestAbsDy = Infinity;
  for (const g of guides) {
    if (g.axis === 'x') {
      const d = g.offset - p.x;
      const ad = Math.abs(d);
      if (ad <= worldTolerance && ad < bestAbsDx) {
        bestAbsDx = ad;
        bestDx = d;
      }
    } else {
      const d = g.offset - p.y;
      const ad = Math.abs(d);
      if (ad <= worldTolerance && ad < bestAbsDy) {
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
  const getView = args.getView;
  const bypassKey = args.bypassKey;

  const computeWorldTol = (): number =>
    getView ? tolerance / Math.max(1e-9, getView().scale) : tolerance;

  return {
    onStart(ctx) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const guides = args.getGuides();
      if (guides.length === 0) return;
      const id = ctx.draggedIds[0];
      const o = ctx.origin.get(id) as unknown as InsertPoint | undefined;
      if (!o) return;
      const snapped = snapPoint(o, guides, computeWorldTol());
      if (snapped) ctx.origin.set(id, snapped as unknown as TPose);
    },
    onMove(ctx, { current }) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const guides = args.getGuides();
      if (guides.length === 0) return;
      const snapped = snapPoint(current, guides, computeWorldTol());
      if (!snapped) return;
      return { current: snapped };
    },
  };
}
