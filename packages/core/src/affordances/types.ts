import type { ChromeState } from 'core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';
import type { FillStyle, Stroke } from 'core/paint-types';

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

  /** Region geometry, expressed in the target's local frame.
   *
   *  - `point` — circular hit (`hitRadiusPx` is screen-space).
   *  - `rect`  — axis-aligned rect (target rotation applies).
   *  - `annulus` — outer ellipse minus inner rect cutout. Used for
   *    invisible zones that sit *around* the AABB (e.g. rotate-on-
   *    hover band). The outer ellipse is defined by world-space
   *    semi-axes `rx` / `ry` around `(cx, cy)`; the inner rect is the
   *    same target-local rect that defines the AABB. Hit-test:
   *    inside outer ellipse AND outside inner rect. */
  shape:
    | { kind: 'point';   x: number; y: number; hitRadiusPx: number }
    | { kind: 'rect';    x: number; y: number; width: number; height: number }
    | {
        kind: 'annulus';
        /** Outer-ellipse center (target-local). */
        cx: number; cy: number;
        /** Outer-ellipse semi-axes (target-local). */
        rx: number; ry: number;
        /** Inner rect (target-local) — the cutout. Typically the
         *  selection's AABB. */
        innerX: number; innerY: number; innerWidth: number; innerHeight: number;
      };

  /** Optional paint. World position is derived from `shape` + target
   *  transform; visual size stays in screen pixels (so handles don't
   *  warp under zoom or non-uniform scale). Omit for hit-only regions.
   *
   *  - `square` — small fixed-size square (only valid over `point` shapes).
   *  - `annulus` — fill + stroke the annulus ring (only valid over
   *    `annulus` shapes). Uses even-odd fill rule to punch the inner-rect
   *    cutout.
   *  - `custom` — emit arbitrary draw commands; receives a {@link CustomPaintContext}. */
  paint?:
    | { kind: 'square';   sizePx: number;  fill?: FillStyle; stroke?: Stroke }
    | { kind: 'annulus';  fill?: FillStyle; stroke?: Stroke; insetPx?: number }
    | { kind: 'custom';   draw: (ctx: CustomPaintContext) => DrawCommand[] };

  /** Declared CSS cursor for this region. NOTE: nothing consumes this
   *  field yet — the hover-cursor pump lives on the dispatcher pipeline
   *  (`useGestureDispatcher`) and reads `AffordanceHit.cursor` from
   *  `buildAffordanceAt`'s synthesized hits, which do not go through
   *  region objects. Honoring this field is part of the pending
   *  affordance-layer unification (see the selection-overlay note in
   *  `docs/taxonomy.md`). */
  cursor?: string;

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
 * Result of an affordance hit — what the region computed about itself.
 *
 * `initialScratch` is the payload: what the region already knows (which
 * corner, which target id) so the action that picks up the drag doesn't
 * re-derive it. `<SceneCanvas>` reads it out of the layer hit-test and packs
 * it into `AffordanceHit`, which flows to the matching action through
 * `InvocationCtx.drag.affordance`.
 *
 * This used to also carry a `drag: DragChannel` naming the handlers the
 * tool-routing dispatcher should wire up. Every implementation supplied a
 * no-op stub that claimed, because the real routing had already moved to
 * bindings; the field went with that dispatcher.
 */
export interface AffordanceBinding<TScratch = unknown> {
  initialScratch?: TScratch;
}
