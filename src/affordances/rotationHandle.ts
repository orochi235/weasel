import type { Affordance, AffordanceBinding } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';
import type { DragChannel } from 'tools/types';
import {
  rotationHandle,
  hitRotationHandle,
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from 'interactions/gestures/rotate/handle';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/useSelectTool';

export interface RotationAffordanceOptions {
  /** World-pixel distance from the bounds top edge to the handle center.
   *  Default DEFAULT_ROTATION_HANDLE_DISTANCE (=24). */
  distance?: number;
  /** Handle hit radius (world-px). Divided by view.scale at hit-test
   *  time so the radius matches the rendered size under zoom. Default 8. */
  handleHitRadius?: number;
  /** Visual handle size (screen-px, half-width). Default 5. */
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

/**
 * @experimental
 * Rotation-handle affordance for rotating the active selection. Reads
 * ChromeState; draws a leader line from the bounds top-center to a small
 * circular handle DEFAULT_ROTATION_HANDLE_DISTANCE world-px above; hit-tests
 * cursor against the handle.
 *
 * The drag channel returned here is a stub that claims — consuming tools
 * wrap the affordance and substitute a drag channel that drives useRotate.
 */
export function createRotationAffordance(
  opts: RotationAffordanceOptions = {},
): Affordance {
  const {
    distance = DEFAULT_ROTATION_HANDLE_DISTANCE,
    handleHitRadius = 8,
    handleSize = 5,
    fill = DEFAULT_FILL,
    stroke = DEFAULT_STROKE,
  } = opts;

  const stubDrag: DragChannel<RotationScratch> = {
    onStart: () => 'claim',
    onMove: () => 'claim',
    onEnd: () => 'claim',
    onCancel: () => {},
  };

  return {
    id: 'rotation-handle',
    render(state: ChromeState, view: View): DrawCommand[] {
      const target = pickTarget(state);
      if (!target) return [];
      const handle = rotationHandle(target.bounds, distance);
      const t = viewToTransform(view);
      const [sx, sy] = worldToScreen(handle.cx, handle.cy, t);
      const [bx, by] = worldToScreen(
        target.bounds.x + target.bounds.width / 2,
        target.bounds.y,
        t,
      );
      // Leader line from bounds-top-center to handle center, then the
      // handle drawn as a small filled square. (Existing rotation overlay
      // uses an arc; we render a square here for parity with the corner
      // handles' style. The visual port can match the arc in a follow-up.)
      return [
        {
          kind: 'path',
          path: {
            kind: 'rect',
            x: Math.min(bx, sx),
            y: Math.min(by, sy) - 0.5,
            width: Math.abs(sx - bx) + 1,
            height: Math.abs(sy - by) + 1,
          },
          stroke: { paint: { color: stroke }, width: 1 },
        },
        {
          kind: 'path',
          path: {
            kind: 'rect',
            x: sx - handleSize,
            y: sy - handleSize,
            width: handleSize * 2,
            height: handleSize * 2,
          },
          fill: { color: fill },
          stroke: { paint: { color: stroke }, width: 1 },
        },
      ];
    },
    hitTest(worldX, worldY, state, view): AffordanceBinding | null {
      const target = pickTarget(state);
      if (!target) return null;
      const handle = rotationHandle(target.bounds, distance);
      const radiusWorld = handleHitRadius / view.scale;
      if (hitRotationHandle(handle, worldX, worldY, radiusWorld)) {
        const result: AffordanceBinding<RotationScratch> = {
          drag: stubDrag,
          initialScratch: { targetId: target.id },
        };
        return result as AffordanceBinding;
      }
      return null;
    },
  };
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
