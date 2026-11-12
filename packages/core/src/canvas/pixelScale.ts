import type { View } from 'core/viewport/view';
import type { NodePaintCtx } from './nodeShapeTypes';

/** Device pixels per world unit where `view` paints at `dpr` device pixels per CSS pixel. */
export function pixelScaleAt(view: View, dpr: number): number {
  return Math.max(Math.abs(view.scale.x), Math.abs(view.scale.y)) * dpr;
}

// Shared across a frame's nodes, which all arrive with the same view and density.
let lastView: View | undefined;
let lastCtx: NodePaintCtx = {};

/** The paint ctx carrying only `pixelScale` for `view` at `dpr`, reused while neither changes. */
export function pixelScaleCtx(view: View, dpr: number): NodePaintCtx {
  const pixelScale = pixelScaleAt(view, dpr);
  if (view !== lastView || lastCtx.pixelScale !== pixelScale) {
    lastView = view;
    lastCtx = { pixelScale };
  }
  return lastCtx;
}
