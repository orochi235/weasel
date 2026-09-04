import type { ChromeState } from 'core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import type { CursorSpec } from '@weasel-js/cursor';

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
        /** Minimum band thickness outside the inner rect, in **screen**
         *  pixels. The framework widens `rx`/`ry` to at least
         *  `innerHalfExtent + minBandPx / meanScale(view.scale)` for both
         *  paint and hit-test.
         *
         *  This exists because the clamp has to know the view and the
         *  affordance doesn't: `ChromeState` carries no scale. Expressing the
         *  floor in world units instead (which is what the rotate ring used
         *  to do) makes the band shrink on screen as you zoom in, until the
         *  ring around a small shape is too thin to hover. */
        minBandPx?: number;
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

  /** Discriminator a press on this region reports as `AffordanceHit.kind` —
   *  the string routing specs match on (`'handle:top-left'`,
   *  `'rotate-handle'`, `'anchor:3'`). Omit for regions that only exist
   *  inside a consumer-registered layer, where the layer id is the
   *  discriminator; `buildAffordanceAt` falls back to
   *  `<affordanceId>:<regionId>`. */
  hitKind?: string;

  /** Cursor to show while hovering this region. Read by the hover-cursor
   *  pump in `useGestureDispatcher` via `AffordanceHit.cursor`, which
   *  `buildAffordanceAt` fills in from the region the walk landed on. */
  cursor?: CursorSpec;

  /** `'exclusive'` bars every binding whose target doesn't consult the
   *  affordance. Read only when the affordance is composed into a
   *  consumer-registered layer; kit chrome routes through
   *  `buildAffordanceAt`, which reports `'shared'`. */
  strength?: 'exclusive' | 'shared';

  /** Which gestures an exclusive claim bars. Omitted bars all of them. */
  claimedKinds?: readonly ClaimableGesture[];

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

/**
 * The fields `buildAffordanceAt` lifts out of a region's `initialScratch`
 * when it turns a region hit into an `AffordanceHit`.
 *
 * Scratch is otherwise opaque — whatever the affordance wants to hand the
 * action that picks up the drag. These few names are the exception: they mean
 * the same thing to every affordance, and the actions that consume them
 * (`resizeAction`, `rotateAction`) read them off `AffordanceHit` rather than
 * out of scratch. An affordance that doesn't set them simply produces a hit
 * without those fields.
 */
export interface CommonAffordanceScratch {
  /** The node (or `MULTI_RESIZE_TARGET_ID`) this chrome acts on. Becomes
   *  `AffordanceHit.targetIds`. */
  targetId?: string;
  /** For resize chrome: which corner stays pinned. Mirrors the kit's
   *  `ResizeAnchor`, spelled inline so `affordances/` doesn't take a type
   *  dependency on the gesture layer for one field. */
  anchor?: { x: 'min' | 'max' | 'free'; y: 'min' | 'max' | 'free' };
  /** World-space invariant point of the transform — the fixed corner for a
   *  resize, the pivot for a rotation. */
  fixedPoint?: { x: number; y: number };
}

/**
 * What a **registered layer's** `hitTest` returns. Extends `AffordanceBinding`
 * so existing implementations keep typechecking; the added fields are how a
 * consumer's own chrome says the things kit chrome says through
 * `AffordanceRegion` — which cursor to show, and whether it owns the point
 * outright.
 */
export interface LayerHit<TScratch = unknown> extends AffordanceBinding<TScratch> {
  /** Cursor while the pointer is over this hit. Reaches the hover-cursor
   *  pump as `AffordanceHit.cursor`, the same path kit chrome uses. */
  cursor?: CursorSpec;
  /** `'exclusive'` bars every binding whose target doesn't consult the
   *  affordance. Omitted means `'shared'` — today's behavior. Same name and
   *  meaning as `AffordanceHit.strength`, which it becomes. */
  strength?: 'exclusive' | 'shared';
  /** Which gestures an exclusive claim bars. Omitted bars all of them. */
  claimedKinds?: readonly ClaimableGesture[];
}

/**
 * Gesture kinds an affordance claim can bar, in the spec vocabulary bindings
 * are written in. `'pointer'` is one token because `pointerDown` / `click` /
 * `drag` are a single press protocol — at the event level the first two are
 * the same `kind: 'pointerdown'`, told apart only by `stage`.
 */
export type ClaimableGesture =
  | 'pointer'
  | 'doubleClick'
  | 'contextMenu'
  | 'longPress'
  | 'wheel';
