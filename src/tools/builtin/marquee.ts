import type { View } from '../../core/viewport/view';
import { viewToTransform } from '../../core/viewport/view';
import { worldToScreen } from '../../core/viewport/viewTransform';
import type { DrawCommand } from '@orochi235/weasel-gl';

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

function marqueeScreenRect(
  view: View,
  bounds: { x: number; y: number; width: number; height: number },
): { sx: number; sy: number; sw: number; sh: number } {
  const t = viewToTransform(view);
  const [sx, sy] = worldToScreen(bounds.x, bounds.y, t);
  return { sx, sy, sw: bounds.width * view.scale, sh: bounds.height * view.scale };
}

/** Screen-space marquee rectangle as DrawCommands. Used by drag-insert tool overlays. */
export function marqueeDrawCommands(
  view: View,
  bounds: { x: number; y: number; width: number; height: number },
  style: InsertOverlayStyle | undefined,
  defaults: MarqueeDefaults,
): DrawCommand[] {
  const fill = style?.fill ?? defaults.fill;
  const stroke = style?.stroke ?? defaults.stroke;
  const dash = style?.dash ?? defaults.dash;
  const lineWidth = style?.lineWidth ?? defaults.lineWidth;
  const { sx, sy, sw, sh } = marqueeScreenRect(view, bounds);
  return [{
    kind: 'path',
    path: { kind: 'rect', x: sx, y: sy, width: sw, height: sh },
    fill: { color: fill },
    stroke: { paint: { color: stroke }, width: lineWidth, dash },
  }];
}
