import type { View } from '../../features/viewport/view';
import { viewToTransform } from '../../features/viewport/view';
import { worldToScreen } from '../../features/viewport/viewTransform';

export interface InsertOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
}

interface MarqueeDefaults {
  fill: string;
  stroke: string;
  dash: number[];
  lineWidth: number;
}

/** Paints a dashed marquee rectangle in screen space.
 *  Both useInsertTool and useTextTool's overlays delegate here. */
export function drawMarquee(
  ctx: CanvasRenderingContext2D,
  view: View,
  bounds: { x: number; y: number; width: number; height: number },
  style: InsertOverlayStyle | undefined,
  defaults: MarqueeDefaults,
): void {
  const fill = style?.fill ?? defaults.fill;
  const stroke = style?.stroke ?? defaults.stroke;
  const dash = style?.dash ?? defaults.dash;
  const lineWidth = style?.lineWidth ?? defaults.lineWidth;
  const t = viewToTransform(view);
  const [sx, sy] = worldToScreen(bounds.x, bounds.y, t);
  const sw = bounds.width * view.scale;
  const sh = bounds.height * view.scale;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.setLineDash([]);
  ctx.restore();
}
