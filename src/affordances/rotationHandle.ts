import type { Affordance, AffordanceBinding, AffordanceRegion } from './types';
import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { Stroke } from 'core/paint-types';
import type { View } from 'core/viewport/view';
import type { DragChannel } from 'tools/types';
import {
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from 'interactions/gestures/rotate/handle';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { PATH_L, PATH_M } from 'features/paths/types';

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
  /** Draw a tether line from the bounds top edge to the handle center.
   *  `true` enables it with a kit-default stroke derived from the handle
   *  fill; pass a `Stroke` to override. `undefined`, `null`, or `false`
   *  all mean off (kit convention for opt-in cosmetic decorations). Opt
   *  in when the visual relationship between the handle and the bounds
   *  isn't already obvious. */
  tether?: Stroke | true | null | false;
}

export interface RotationScratch {
  /** Id of the rotation target — always a single selection id today. */
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
 * outward along the local up-vector by `distance` world pixels. When
 * `tether: true` is passed, a `decorate` pass adds a tether line from the
 * bounds top edge to the handle (purely visual; not draggable).
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
    tether,
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
      if (!tether) return [];
      const tetherStroke: Stroke = tether === true
        ? { paint: { color: fill }, width: 1 }
        : tether;
      // Tether line: bounds-top-center → handle center. Lives in the
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
      // Emit as a 2-vertex open polyline so the tether follows the rotated
      // axis. The previous rect-based fallback degenerated into a visible
      // outlined box whenever the bounds were rotated.
      return [{
        kind: 'path',
        path: {
          kind: 'polygon',
          commands: new Uint8Array([PATH_M, PATH_L]),
          coords: new Float32Array([sx0, sy0, sx1, sy1]),
          fillRule: 'nonzero',
        },
        stroke: tetherStroke,
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
  // Rotation handle only renders for a single primary selection — rotating
  // a multi-selection would need a defined pivot and per-object pose math
  // that the affordance contract doesn't carry today. Multi-selection
  // resize still fires (see corner-resize affordance), just not rotate.
  if (state.selection.length === 1) {
    const id = state.selection[0];
    const b = state.boundsOf(id);
    return b ? { id, bounds: b } : null;
  }
  return null;
}
