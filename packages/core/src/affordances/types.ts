import type { ChromeState } from 'core/selection/chromeState';
import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import type { CommandStroke, CommandFill } from '@weasel-js/paint';
import type { CursorSpec } from '@weasel-js/cursor';
import type { ClaimableGesture } from '@weasel-js/gestures';
import type { PolygonPath } from '@weasel-js/geom';

/**
 * A single interactive piece of chrome. Affordances declare interactive regions in a target's
 * *local* frame; `composeAffordanceLayer` composes the target's bounds transform (rotation
 * around the AABB center, when present) for both paint and hit-test, so the affordance never
 * touches rotation, view.scale, or world↔screen math.
 */
export interface Affordance {
  /** Stable id for debug overlays + visibility maps. */
  id: string;

  /** This affordance's interactive regions. Each lives in some target id's local frame (or
   *  the world frame when `targetId` is `null`). `[]` means no chrome for this state. */
  regions(state: ChromeState): readonly AffordanceRegion[];

  /** The regions a press at world `(wx, wy)` can hit, in the order `regions` lists them: a hit
   *  test reads these in place of `regions`, so one that leaves out a region the point is in
   *  changes which region wins. For an affordance with many regions, narrowed by an index. */
  regionsAt?(state: ChromeState, wx: number, wy: number, view: View): readonly AffordanceRegion[];

  /** Optional non-interactive decoration (e.g., a leader line from a bounds edge to a
   *  handle). Receives raw state + view because it may live outside any single target's
   *  local frame. */
  decorate?(state: ChromeState, view: View): DrawCommand[];
}

/**
 * One interactive region produced by an affordance. The framework owns
 * the local↔world transform for `targetId` (when non-null), so `shape`,
 * `paint.sizePx`, and `hitRadiusPx` are always specified in coordinates
 * the affordance can reason about directly.
 */
export interface AffordanceRegion<TScratch = unknown> {
  /** Stable id, e.g. `corner-min-min`. Used for debug overlays + a11y. */
  id: string;

  /** A chrome-caps id gating this region on top of its affordance's. */
  chromeId?: string;

  /** Target id whose `state.boundsOf(targetId)` defines this region's
   *  local frame: the bounds' `rotation` and `transform`, as `poseFrameOf`
   *  composes them about the box center. Pass
   *  `null` for affordances anchored to the viewport / world frame
   *  (identity transform). */
  targetId: string | null;

  /** Region geometry, expressed in the target's local frame.
   *
   *  - `point` — square hit of half-extent `hitRadiusPx` screen pixels,
   *    axis-aligned on screen unless `turned`. `standoff` pushes the anchor `px`
   *    screen pixels off the edge whose outward normal (target-local) is
   *    `normal`, measured along that normal as it lands on screen — for
   *    chrome that floats a fixed distance off an edge at any zoom.
   *  - `rect`  — axis-aligned rect (target rotation applies).
   *  - `annulus` — outer ellipse minus inner rect cutout, for zones that sit *around* the
   *    AABB (e.g. a rotate-on-hover band).
   *  - `outline` — within `hitRadiusPx` screen pixels of `path`'s outline, either side of it,
   *    for chrome that is a path's own edge (path edit's segments). Hit-only. */
  shape:
    | {
        kind: 'point';
        x: number; y: number;
        hitRadiusPx: number;
        standoff?: { px: number; normal: { x: number; y: number } };
        /** Turn the square to the target, at the angle the target's x axis
         *  lands on screen (`screenAngleOf`) — for handles painted turned. */
        turned?: boolean;
        /** The body this point is a corner of: its target-local size, and
         *  which way leads out of it on each axis. While the body spans under
         *  four `hitRadiusPx` on an axis on screen, only the outward half of
         *  the square on that axis takes a press, so a small body can still be
         *  grabbed. The cut runs along the square's own axes: pair it with
         *  `turned` on a target that can rotate. */
        cornerOf?: { width: number; height: number; outward: { x: -1 | 1; y: -1 | 1 } };
        /** The body this point is an edge midpoint of: its target-local
         *  size. While either side spans under `EDGE_HANDLE_MIN_RADII`
         *  `hitRadiusPx` on screen, the point is neither hit nor painted, so it
         *  cannot crowd the corners or cover the middle of a small body. */
        edgeOf?: { width: number; height: number };
      }
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
         *  `innerHalfExtent + pxExtent(minBandPx, view.scale)` on each axis
         *  for both paint and hit-test.
         *
         *  In screen pixels because the clamp has to know the view and the affordance
         *  doesn't: `ChromeState` carries no scale. */
        minBandPx?: number;
      }
    | { kind: 'outline'; path: PolygonPath; hitRadiusPx: number };

  /** Optional paint. World position is derived from `shape` + target
   *  transform; visual size stays in screen pixels (so handles don't
   *  warp under zoom or non-uniform scale). Omit for hit-only regions.
   *
   *  - `square` — small fixed-size square (only valid over `point` shapes).
   *  - `annulus` — fill + stroke the annulus ring (only valid over `annulus` shapes).
   *  - `custom` — emit arbitrary draw commands; receives a {@link CustomPaintContext}. */
  paint?:
    | { kind: 'square';   sizePx: number;  fill?: CommandFill; stroke?: CommandStroke }
    | { kind: 'annulus';  fill?: CommandFill; stroke?: CommandStroke; insetPx?: number }
    | { kind: 'custom';   draw: (ctx: CustomPaintContext) => DrawCommand[] };

  /** Discriminator a press on this region reports as `AffordanceHit.kind` —
   *  the string routing specs match on (`'handle:top-left'`,
   *  `'rotate-handle'`, `'anchor:3'`). Omit for regions that only exist
   *  inside a consumer-registered layer, where the layer id is the
   *  discriminator; `buildAffordanceAt` falls back to
   *  `<affordanceId>:<regionId>`. */
  hitKind?: string;

  /** Cursor to show while hovering this region: one spec, or one worked out
   *  from where the pointer is (`at`, in world coords). */
  cursor?: CursorSpec | ((at: { x: number; y: number }, view: View) => CursorSpec);

  /** `'exclusive'` bars every binding whose target doesn't consult the
   *  affordance. Read only when the affordance is composed into a
   *  consumer-registered layer; kit chrome routes through
   *  `buildAffordanceAt`, which reports `'shared'`. */
  strength?: 'exclusive' | 'shared';

  /** Which gestures an exclusive claim bars. Omitted bars all of them. */
  claimedKinds?: readonly ClaimableGesture[];

  /** Drag binding produced when this region is hit. Called lazily, so state snapshots
   *  (e.g., capturing per-leaf poses at click time) belong inside `bind()`, not inside
   *  `regions()`. */
  bind(): AffordanceBinding<TScratch>;
}

/** Context passed to a region's `paint.kind === 'custom'` draw callback. */
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
 * Result of an affordance hit. `initialScratch` is what the region already knows (which
 * corner, which target id) so the action that picks up the drag doesn't re-derive it. It
 * reaches the matching action through `InvocationCtx.drag.affordance`.
 */
export interface AffordanceBinding<TScratch = unknown> {
  initialScratch?: TScratch;
}

/**
 * The fields `buildAffordanceAt` lifts out of a region's `initialScratch` when it turns a
 * region hit into an `AffordanceHit`. Scratch is otherwise opaque; these names mean the same
 * thing to every affordance. An affordance that doesn't set them produces a hit without
 * those fields.
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
 * What a **registered layer's** `hitTest` returns. The added fields are how a consumer's own
 * chrome says the things kit chrome says through `AffordanceRegion` — which cursor to show,
 * and whether it owns the point outright.
 */
export interface LayerHit<TScratch = unknown> extends AffordanceBinding<TScratch> {
  /** Cursor while the pointer is over this hit. Reaches the hover-cursor
   *  pump as `AffordanceHit.cursor`, the same path kit chrome uses. */
  cursor?: CursorSpec;
  /** `'exclusive'` bars every binding whose target doesn't consult the affordance. Omitted
   *  means `'shared'`. Becomes `AffordanceHit.strength`. */
  strength?: 'exclusive' | 'shared';
  /** Which gestures an exclusive claim bars. Omitted bars all of them. */
  claimedKinds?: readonly ClaimableGesture[];
}
