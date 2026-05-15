import type { Affordance, AffordanceBinding, AffordanceRegion } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';
import type { DragChannel } from 'tools/types';
import {
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from 'interactions/gestures/rotate/handle';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/useSelectTool';

export interface RotationAffordanceOptions {
  /** World-pixel distance from the bounds top edge to the handle center.
   *  Default DEFAULT_ROTATION_HANDLE_DISTANCE (=24). */
  distance?: number;
  /** Handle hit radius (screen-px). Default 8. */
  handleHitRadius?: number;
  /** Visual handle size (screen-px, full width). Default 10. */
  handleSize?: number;
  fill?: string;
  stroke?: string;
}

export interface RotationScratch {
  /** Id of the rotation target. In multi-mode this is `MULTI_RESIZE_TARGET_ID`. */
  targetId: string;
}

const DEFAULT_FILL = '#d4c4a8';
const DEFAULT_STROKE = '#1a130d';

const stubDrag: DragChannel<RotationScratch> = {
  onStart: () => 'claim',
  onMove: () => 'claim',
  onEnd: () => 'claim',
  onCancel: () => {},
};

/**
 * @experimental
 * Rotation-handle affordance for rotating the active selection. Declares
 * a single point region at the rect's (rotated) top-center, offset
 * outward along the local up-vector by `distance` world pixels. A
 * `decorate` pass adds the leader line from the bounds top edge to the
 * handle (purely visual; not draggable).
 *
 * The drag channel returned here is a stub that claims — consuming tools
 * wrap the region's `bind()` to substitute a drag channel that drives
 * `useRotate`.
 */
export function createRotationAffordance(
  opts: RotationAffordanceOptions = {},
): Affordance {
  const {
    distance = DEFAULT_ROTATION_HANDLE_DISTANCE,
    handleHitRadius = 8,
    handleSize = 10,
    fill = DEFAULT_FILL,
    stroke = DEFAULT_STROKE,
  } = opts;

  const paint = {
    kind: 'square' as const,
    sizePx: handleSize,
    fill: { color: fill },
    stroke: { paint: { color: stroke }, width: 1 },
  };

  return {
    id: 'rotation-handle',
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const target = pickTarget(state);
      if (!target) return [];
      const b = target.bounds;
      const lx = b.x + b.width / 2;
      const ly = b.y - distance;
      const region: AffordanceRegion = {
        id: 'rotation-handle',
        targetId: target.id,
        shape: { kind: 'point', x: lx, y: ly, hitRadiusPx: handleHitRadius },
        paint,
        bind: (): AffordanceBinding => ({
          drag: stubDrag as unknown as AffordanceBinding['drag'],
          initialScratch: { targetId: target.id } satisfies RotationScratch,
        }),
      };
      return [region];
    },
    decorate(state: ChromeState, view: View): DrawCommand[] {
      // Leader line: bounds-top-center → handle center. Lives in the
      // target's local frame; we rotate both endpoints around the AABB
      // center to get world coords, then project to screen pixels.
      const target = pickTarget(state);
      if (!target) return [];
      const b = target.bounds;
      const rotation = b.rotation ?? 0;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const startL = { x: b.x + b.width / 2, y: b.y };
      const endL = { x: b.x + b.width / 2, y: b.y - distance };
      const startW = rotateAround(startL.x, startL.y, cx, cy, rotation);
      const endW = rotateAround(endL.x, endL.y, cx, cy, rotation);
      const t = viewToTransform(view);
      const [sx0, sy0] = worldToScreen(startW.x, startW.y, t);
      const [sx1, sy1] = worldToScreen(endW.x, endW.y, t);
      // Emit as a 1-px-wide rect along the leader so existing renderers
      // (which don't have a `line` primitive on this path) can paint it.
      const minX = Math.min(sx0, sx1);
      const minY = Math.min(sy0, sy1);
      const w = Math.abs(sx1 - sx0) + 1;
      const h = Math.abs(sy1 - sy0) + 1;
      return [{
        kind: 'path',
        path: { kind: 'rect', x: minX, y: minY - 0.5, width: w, height: h },
        stroke: { paint: { color: stroke }, width: 1 },
      }];
    },
  };
}

function rotateAround(
  px: number, py: number,
  cx: number, cy: number,
  rotation: number,
): { x: number; y: number } {
  if (rotation === 0) return { x: px, y: py };
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + cos * dx - sin * dy, y: cy + sin * dx + cos * dy };
}

function pickTarget(state: ChromeState): { id: string; bounds: Bounds } | null {
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
