import type { ModifierState, BoundsConstraint, Bounds } from '@weasel-js/core';
import { roundToGridOn } from '../../strategies/onPlane';

type ModKey = keyof ModifierState;

/** Resize constraint that snaps the moving edges to a grid, leaving the
 *  anchored ones where they are. By default a node already smaller than one
 *  grid cell on an axis is left unsnapped on that axis, so it stays resizable
 *  at sub-grid sizes. */
export function snapToGrid<TPose extends Bounds>(args: {
  spacing: number;
  bypassKey?: ModKey;
  suspendBelowDim?: boolean;
}): BoundsConstraint<TPose> {
  const { spacing, bypassKey, suspendBelowDim = true } = args;

  return {
    onMove(ctx, { pose, anchor }) {
      if (bypassKey && ctx.modifiers[bypassKey]) return;
      const round = (v: number, axis: 'x' | 'y') => roundToGridOn(v, axis, spacing, ctx.plane);
      const origin = ctx.origin.get(ctx.draggedIds[0])!;
      const subX = suspendBelowDim && origin.width < spacing;
      const subY = suspendBelowDim && origin.height < spacing;

      let { x, y, width, height } = pose;
      let changed = false;

      if (anchor.x !== 'free' && !subX) {
        if (anchor.x === 'min') {
          // East edge moves; west (x) stays.
          const east = round(x + width, 'x');
          width = east - x;
        } else {
          // West edge moves; east (x+width) stays.
          const right = origin.x + origin.width;
          const newX = round(x, 'x');
          width = right - newX;
          x = newX;
        }
        changed = true;
      }
      if (anchor.y !== 'free' && !subY) {
        if (anchor.y === 'min') {
          const south = round(y + height, 'y');
          height = south - y;
        } else {
          const bottom = origin.y + origin.height;
          const newY = round(y, 'y');
          height = bottom - newY;
          y = newY;
        }
        changed = true;
      }
      if (!changed) return;
      return { pose: { ...pose, x, y, width, height } };
    },
  };
}
