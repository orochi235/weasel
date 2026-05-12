import type { Affordance, AffordanceBinding } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';
import type { DragChannel } from 'tools/types';
import type { ResizeAnchor } from 'interactions/gestures/types';
import {
  cornerResizeHandles,
  hitCornerHandle,
} from 'interactions/gestures/resize/cornerHandles';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/useSelectTool';

export interface CornerResizeAffordanceOptions {
  /** Hit radius (world-px) for the corner handles. Default 8. Divided by
   *  view.scale at hit-test time so the radius matches the rendered size
   *  under zoom. */
  handleHitRadius?: number;
  /** Visual handle size (screen-px). Default 8. */
  handleSize?: number;
  fill?: string;
  stroke?: string;
}

export interface CornerResizeScratch {
  /** Resize anchor identifying the OPPOSITE corner (the one that stays
   *  fixed). Matches the kit's existing ResizeAnchor convention. */
  anchor: ResizeAnchor;
  /** Id of the resize target. In multi-mode this is `MULTI_RESIZE_TARGET_ID`. */
  targetId: string;
}

const DEFAULT_FILL = '#d4c4a8';
const DEFAULT_STROKE = '#1a130d';

/**
 * @experimental
 * Corner-handle affordance for resizing the active selection (single
 * member in single-mode; the union AABB in multi-mode). Reads
 * ChromeState; emits screen-space DrawCommands for the four corners;
 * returns a AffordanceBinding whose drag channel routes to useResize against the
 * picked target.
 *
 * The drag channel returned here is a no-op stub that claims — it gets
 * replaced by the consuming tool (e.g. useSelectTool wraps the
 * affordance and rebuilds the drag channel to delegate to its useResize
 * controller). This keeps the affordance file dependency-light.
 */
export function createCornerResizeAffordance(
  opts: CornerResizeAffordanceOptions = {},
): Affordance {
  const {
    handleHitRadius = 8,
    handleSize = 8,
    fill = DEFAULT_FILL,
    stroke = DEFAULT_STROKE,
  } = opts;

  const stubDrag: DragChannel<CornerResizeScratch> = {
    onStart: () => 'claim',
    onMove: () => 'claim',
    onEnd: () => 'claim',
    onCancel: () => {},
  };

  return {
    id: 'corner-resize',
    render(state: ChromeState, view: View): DrawCommand[] {
      const target = pickRenderTarget(state);
      if (!target) return [];
      const t = viewToTransform(view);
      const corners = cornerResizeHandles(target.bounds);
      const cmds: DrawCommand[] = [];
      const half = handleSize / 2;
      for (const c of corners) {
        const [sx, sy] = worldToScreen(c.cx, c.cy, t);
        cmds.push({
          kind: 'path',
          path: { kind: 'rect', x: sx - half, y: sy - half, width: handleSize, height: handleSize },
          fill: { color: fill },
          stroke: { paint: { color: stroke }, width: 1 },
        });
      }
      return cmds;
    },
    hitTest(worldX, worldY, state, view): AffordanceBinding | null {
      const target = pickRenderTarget(state);
      if (!target) return null;
      const radiusWorld = handleHitRadius / view.scale;
      const corners = cornerResizeHandles(target.bounds);
      for (const c of corners) {
        if (hitCornerHandle(c, worldX, worldY, radiusWorld)) {
          const result: AffordanceBinding<CornerResizeScratch> = {
            drag: stubDrag,
            initialScratch: { anchor: c.anchor, targetId: target.id },
          };
          return result as AffordanceBinding;
        }
      }
      return null;
    },
  };
}

function pickRenderTarget(state: ChromeState): { id: string; bounds: Bounds } | null {
  if (state.multiActive && state.unionBounds) {
    return { id: MULTI_RESIZE_TARGET_ID, bounds: state.unionBounds };
  }
  if (state.selection.length === 1) {
    const id = state.selection[0];
    const b = state.boundsOf(id);
    return b ? { id, bounds: b } : null;
  }
  return null;
}
