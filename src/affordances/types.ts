import type { DragChannel } from 'tools/types';
import type { ChromeState } from 'core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';
import type { Paint, Stroke } from 'core/paint-types';

/**
 * @experimental
 * A single interactive piece of chrome. Pure functions; the kit composes
 * multiple affordances into a single RenderLayer per tool via
 * `composeAffordanceLayer`.
 *
 * Affordances declare interactive regions in a target's *local* frame.
 * The framework (`composeAffordanceLayer`) composes the target's bounds
 * transform (rotation around the AABB center, when present) for both paint
 * and hit-test, so the affordance never touches rotation, view.scale, or
 * world↔screen math.
 */
export interface Affordance {
  /** Stable id for debug overlays + visibility maps. */
  id: string;

  /** Enumerate this affordance's interactive regions. Each region lives in
   *  some target id's local frame (or in the world frame when `targetId`
   *  is `null`). Returning `[]` means "no chrome for this state" (no
   *  selection, multi-mode disabled, etc.). */
  regions(state: ChromeState): readonly AffordanceRegion[];

  /** Optional non-interactive decoration (e.g., a leader line drawn from
   *  a bounds edge to a handle — visual only, not draggable). Receives
   *  raw state + view because the decoration may live outside any single
   *  target's local frame. Most affordances leave this undefined. */
  decorate?(state: ChromeState, view: View): DrawCommand[];
}

/**
 * @experimental
 * One interactive region produced by an affordance. The framework owns
 * the local↔world transform for `targetId` (when non-null), so `shape`,
 * `paint.sizePx`, and `hitRadiusPx` are always specified in coordinates
 * the affordance can reason about directly.
 */
export interface AffordanceRegion<TScratch = unknown> {
  /** Stable id, e.g. `corner-min-min`. Used for debug overlays + a11y. */
  id: string;

  /** Target id whose `state.boundsOf(targetId)` defines this region's
   *  local frame. `bounds.rotation` (if present) is the only transform
   *  applied — translation is the AABB origin; scale is identity. Pass
   *  `null` for affordances anchored to the viewport / world frame
   *  (identity transform). */
  targetId: string | null;

  /** Region geometry, expressed in the target's local frame. */
  shape:
    | { kind: 'point';  x: number; y: number; hitRadiusPx: number }
    | { kind: 'rect';   x: number; y: number; width: number; height: number };

  /** Optional paint. World position is derived from `shape` + target
   *  transform; visual size stays in screen pixels (so handles don't
   *  warp under zoom or non-uniform scale). Omit for hit-only regions. */
  paint?:
    | { kind: 'square';  sizePx: number;  fill?: Paint; stroke?: Stroke }
    | { kind: 'custom';  draw: (ctx: CustomPaintContext) => DrawCommand[] };

  /** Drag binding produced when this region is hit. Lazily called so
   *  affordances don't pay binding-construction cost on every paint frame —
   *  state snapshots (e.g., capturing per-leaf poses at click time) belong
   *  inside `bind()`, not inside `regions()`. */
  bind(): AffordanceBinding<TScratch>;
}

/** Context passed to a region's `paint.kind === 'custom'` draw callback.
 *  Provides both the world-space anchor (already transformed) and the
 *  original local shape, for affordances that want to do additional
 *  geometry themselves. */
export interface CustomPaintContext {
  /** World-space mapping of `shape`. For `point`, only `x`/`y` are set.
   *  For `rect`, all four fields are set. */
  world: { x: number; y: number; width?: number; height?: number };
  /** The original local shape (same object identity as `region.shape`). */
  local: AffordanceRegion['shape'];
  view: View;
  state: ChromeState;
}

/**
 * @experimental
 * Result of an affordance hit — what the dispatcher wires up as the gesture.
 * Nominates the drag channel and (optionally) initial scratch state.
 */
export interface AffordanceBinding<TScratch = unknown> {
  drag: DragChannel<TScratch>;
  /** Initial scratch passed to drag.onStart. Lets the affordance pre-fill
   *  state from what its region's binding already computed (anchor: 'br',
   *  targetId: 'g1', etc.) so the tool's onStart doesn't re-derive it. */
  initialScratch?: TScratch;
}
