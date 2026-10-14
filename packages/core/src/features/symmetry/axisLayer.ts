import { ellipsePath, linePath } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { LayerHit } from 'affordances/types';
import type { RenderLayer } from 'core/layers/render';
import { worldToScreen } from 'core/viewport/viewTransform';
import { viewToTransform, type View } from 'core/viewport/view';
import type { Symmetry, SymmetryAxis } from './types';

/** The axis layer's id. */
export const SYMMETRY_LAYER_ID = 'weasel-symmetry';
/** The affordance kind a press on the axis handle arrives as. */
export const SYMMETRY_AFFORDANCE_KIND = `layer:${SYMMETRY_LAYER_ID}`;

type Rect = { x: number; y: number; width: number; height: number };

/** Options for {@link symmetryAxisLayer}. */
export interface SymmetryAxisLayerOptions {
  /** The setting to draw; nothing is drawn while it answers `null`. */
  get(): Symmetry | null;
  /** The world rect the axis lines span. Default: the whole canvas. */
  extent?: () => Rect;
  /** Line and handle color. */
  color?: string;
  /** Radius of the drawn handle, in screen px. Default 4. */
  handleRadiusPx?: number;
  /** How far from the handle a press still takes it, in screen px. Default 8. */
  hitRadiusPx?: number;
}

const CURSOR: Record<SymmetryAxis, string> = { vertical: 'ew-resize', horizontal: 'ns-resize', both: 'move' };

function screenExtent(view: View, dims: { width: number; height: number }, extent: Rect | undefined) {
  const t = viewToTransform(view);
  if (!extent) return { x0: 0, y0: 0, x1: dims.width, y1: dims.height };
  const [x0, y0] = worldToScreen(extent.x, extent.y, t);
  const [x1, y1] = worldToScreen(extent.x + extent.width, extent.y + extent.height, t);
  return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

/**
 * The symmetry axes, drawn across the canvas while symmetry is on, with a
 * handle where they cross (or at the setting's center on a single axis). Only
 * the handle is hit-tested, exclusively, so a stroke can still start on the
 * line: register the layer on the canvas (`symmetryContribution` does) and a
 * drag on the handle reaches `symmetryAxisDragAction`.
 */
export function symmetryAxisLayer(opts: SymmetryAxisLayerOptions): RenderLayer<unknown> {
  const color = opts.color ?? 'rgba(0, 140, 255, 0.85)';
  const radius = opts.handleRadiusPx ?? 4;
  const hitRadius = opts.hitRadiusPx ?? 8;
  const line = { paint: { kind: 'solid' as const, color }, width: { px: 1 } };
  return {
    id: SYMMETRY_LAYER_ID,
    label: 'Symmetry axis',
    space: 'screen',
    draw(_data, view, dims): DrawCommand[] {
      const s = opts.get();
      if (!s) return [];
      const e = screenExtent(view, dims, opts.extent?.());
      const [cx, cy] = worldToScreen(s.center.x, s.center.y, viewToTransform(view));
      const out: DrawCommand[] = [];
      if (s.axis !== 'horizontal') {
        out.push({ kind: 'path', path: linePath({ x: cx, y: e.y0 }, { x: cx, y: e.y1 }), stroke: line });
      }
      if (s.axis !== 'vertical') {
        out.push({ kind: 'path', path: linePath({ x: e.x0, y: cy }, { x: e.x1, y: cy }), stroke: line });
      }
      out.push({
        kind: 'path',
        path: ellipsePath({ x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }),
        fill: { paint: { kind: 'solid', color } },
        stroke: { paint: { kind: 'solid', color: '#fff' }, width: { px: 1 } },
      });
      return out;
    },
    hitTest(worldX, worldY, _data, view): LayerHit | null {
      const s = opts.get();
      if (!s) return null;
      const t = viewToTransform(view);
      const [px, py] = worldToScreen(worldX, worldY, t);
      const [cx, cy] = worldToScreen(s.center.x, s.center.y, t);
      if (Math.hypot(px - cx, py - cy) > hitRadius) return null;
      return { strength: 'exclusive', cursor: CURSOR[s.axis] };
    },
  };
}
