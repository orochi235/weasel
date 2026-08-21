import type {
  ModifierState,
  PointSnapBehavior,
  PointSnapContext,
  PointSnapFrame,
  PointSnapResult,
  ResizePose,
} from '../../../gestures/types';

/** Resize behavior that snaps one reference point of the resize — the dragged
 *  corner, the fixed corner, or the center, per `frame` — to a grid, moving
 *  the whole pose by the same delta. Unlike the bounds-level `snapToGrid`,
 *  this preserves the node's dimensions. */
export function pointSnapToGrid<TPose extends ResizePose>(args: {
  spacing: number;
  frame?: PointSnapFrame;
  bypassKey?: keyof ModifierState;
}): PointSnapBehavior<TPose> {
  const { spacing, frame = 'dragged-corner', bypassKey } = args;
  const round = (v: number) => Math.round(v / spacing) * spacing;

  return {
    id: `pointSnapToGrid:${frame}`,
    onMove(ctx: PointSnapContext<TPose>): PointSnapResult | null {
      if (bypassKey && ctx.modifiers[bypassKey]) return null;
      const src =
        frame === 'dragged-corner' ? ctx.draggedCorner :
        frame === 'fixed-corner' ? ctx.fixedCorner :
        frame === 'center' ? ctx.center :
        ctx.origin;
      if (!src) return null;
      return { frame, worldX: round(src.worldX), worldY: round(src.worldY) };
    },
  };
}
