import type {
  ModifierState,
  ResizeBehavior,
  ResizePose,
} from '../../types';
import type { Guide } from 'features/guides/types';
import type { View } from 'core/viewport/view';
import { DEFAULT_GUIDE_TOLERANCE_PX } from '../../shared/strategies/guides';

type ModKey = keyof ModifierState;

/** Options for the resize-flavored `snapToGuides`. */
export interface SnapToGuidesResizeArgs {
  /** Stable getter into the live guide list (typically from `useGuides`). */
  getGuides: () => readonly Guide[];
  /** Snap tolerance (screen px when `getView` is set, world units otherwise). */
  tolerance?: number;
  /** Read the active view; required for screen-pixel tolerance. */
  getView?: () => View;
  /** Modifier key that bypasses snapping while held. */
  bypassKey?: ModKey;
}

/**
 * Resize behavior that snaps the active edge of the dragged rect to the
 * nearest guide on the corresponding axis when within `tolerance`. The
 * "free" axis is left untouched. The fixed (anchor) edge stays pinned;
 * only the moving edge snaps.
 *
 * On the X axis, vertical guides (`axis: 'x'`) constrain the moving vertical
 * edge — east when `anchor.x === 'min'` (west pinned), west when `'max'`.
 * Likewise on Y for horizontal guides.
 */
export function snapToGuides<TPose extends ResizePose>(
  args: SnapToGuidesResizeArgs,
): ResizeBehavior<TPose> {
  const tolerance = args.tolerance ?? DEFAULT_GUIDE_TOLERANCE_PX;
  const getView = args.getView;
  const bypassKey = args.bypassKey;

  return {
    onMove(ctx, { pose, anchor }) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const guides = args.getGuides();
      if (guides.length === 0) return;

      const worldTolerance = getView
        ? tolerance / Math.max(1e-9, getView().scale)
        : tolerance;

      let { x, y, width, height } = pose;
      let changed = false;

      // X-axis: snap the moving vertical edge to the nearest 'x' guide.
      if (anchor.x !== 'free') {
        const movingX = anchor.x === 'min' ? x + width : x;
        let bestD = 0;
        let bestAbs = Infinity;
        for (const g of guides) {
          if (g.axis !== 'x') continue;
          const d = g.offset - movingX;
          const ad = Math.abs(d);
          if (ad <= worldTolerance && ad < bestAbs) {
            bestAbs = ad;
            bestD = d;
          }
        }
        if (bestAbs !== Infinity && bestD !== 0) {
          if (anchor.x === 'min') {
            // East edge moves; west (x) stays.
            width = width + bestD;
          } else {
            // West edge moves; east (x+width) stays.
            x = x + bestD;
            width = width - bestD;
          }
          changed = true;
        }
      }

      // Y-axis: snap the moving horizontal edge to the nearest 'y' guide.
      if (anchor.y !== 'free') {
        const movingY = anchor.y === 'min' ? y + height : y;
        let bestD = 0;
        let bestAbs = Infinity;
        for (const g of guides) {
          if (g.axis !== 'y') continue;
          const d = g.offset - movingY;
          const ad = Math.abs(d);
          if (ad <= worldTolerance && ad < bestAbs) {
            bestAbs = ad;
            bestD = d;
          }
        }
        if (bestAbs !== Infinity && bestD !== 0) {
          if (anchor.y === 'min') {
            height = height + bestD;
          } else {
            y = y + bestD;
            height = height - bestD;
          }
          changed = true;
        }
      }

      if (!changed) return;
      return { pose: { ...pose, x, y, width, height } };
    },
  };
}
