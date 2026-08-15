/**
 * Invoker — pluggable invocation strategy for an Action.
 *
 * An Action's `invoker` field describes how it's run. `immediate` invokers
 * fire once (delete, align, undo). `ongoing` invokers open a phase machine
 * driven by the dispatcher (move, resize, pinch-zoom).
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md`
 * § "Types" for the full design.
 */

import type { ActionBehavior, ModifierState, ResizeAnchor } from '../gestures/types';
import type { ClaimableGesture } from '../../affordances/types';

export type { ModifierState } from '../gestures/types';

/** A 2D point in either world or screen coordinates. */
export interface Point2 {
  x: number;
  y: number;
}

/**
 * Information about which UI affordance was hit at pointerdown.
 *
 * Populated by the dispatcher when the `affordanceAt` thunk is provided to
 * `useGestureDispatcher`. Tools / action invokers that only fire on a specific
 * affordance (e.g. a resize handle) use this field as a guard — if the
 * affordance is absent or is the wrong kind, they return `{}` and let other
 * bindings handle the drag.
 *
 * `kind` is a discriminator string:
 *   - `'handle:top-left'` / `'handle:top-right'` / `'handle:bottom-left'` /
 *     `'handle:bottom-right'` — corner resize handles.
 *   - `'rotate-handle'` — the rotation affordance.
 *   - `'anchor:N'` — a path anchor at index N.
 *
 * `fixedPoint` is the world-space point that should remain stationary during
 * the gesture. For resize handles this is the opposite (diagonally fixed)
 * corner; for rotate it is the pivot.
 *
 * `targetIds` are the node ids this affordance belongs to.
 */
export interface AffordanceHit {
  /** Discriminator string, e.g. `'handle:bottom-right'`. */
  kind: string;
  /** Id of whatever produced this hit — a kit affordance's `id`, or the
   *  registered layer's id. Read only by the dispatcher's dead-claim warning today. */
  owner?: string;
  /** `'exclusive'` means no binding may act on this point unless its target
   *  consults the affordance. `'shared'` (the default) competes on scope and
   *  specificity as bindings always have. */
  strength?: 'exclusive' | 'shared';
  /** Which gestures an exclusive claim bars. Omitted bars all of them. */
  claimedKinds?: readonly ClaimableGesture[];
  /** World-space fixed/pivot point. For resize: opposite corner. For rotate: pivot. */
  fixedPoint?: { x: number; y: number };
  /** Which nodes this affordance belongs to. */
  targetIds?: string[];
  /** Set when `kind` matches `'handle:*'`. Identifies which corner stays
   *  fixed during a resize so consumers (resizeAction) don't re-parse `kind`.
   *  Other affordance kinds (rotate-handle, anchor:N, controlIn:N, controlOut:N)
   *  leave this undefined. */
  anchor?: ResizeAnchor;
  /** CSS cursor to show while the pointer hovers this affordance (no
   *  gesture in flight). Consumed by the hover-cursor pump in
   *  `useGestureDispatcher`; unset = the pump falls through to
   *  action-cursor prediction, then to the active tool's cursor. */
  cursor?: string;
  /**
   * Free-form payload from whatever produced the hit, carried through to the
   * matching action untouched.
   *
   * Kit affordances describe themselves fully in the fields above and leave
   * this unset. It exists for affordances the kit doesn't know the shape of —
   * a registered layer's own chrome, where the hit-test already resolved
   * *which* of its pieces was hit and the action would otherwise have to
   * redo that work. `@weasel-js/hud` passes the hit widget here.
   */
  payload?: unknown;
}

/**
 * One accumulated point on a drag trail: world-space position plus whatever
 * stylus state the originating `PointerEvent` carried.
 *
 * The stylus fields are absent for mouse/touch on browsers that don't report
 * them, and for synthetic events. Consumers that want pressure-driven output
 * (e.g. `Stroke.vertexWidths` from a pencil stroke) read them off the samples
 * their `insert` dep receives — see `apps/site/demos/VertexWidthsDemo.tsx`.
 */
export interface DragSample extends Point2 {
  /** 0..1. Mouse/touch report 0.5 while a button is held, per the spec. */
  pressure?: number;
  /** Degrees, ±90. Zero for mouse/touch. */
  tiltX?: number;
  /** Degrees, ±90. Zero for mouse/touch. */
  tiltY?: number;
}

/** Per-invocation runtime context the dispatcher hands to an Invoker.
 *  Gesture-kind-specific fields (`drag`, `wheel`, `multiTouch`, `key`) are
 *  populated only for matching gesture kinds. */
export interface InvocationCtx {
  world: Point2;
  screen: Point2;
  modifiers: ModifierState;
  deps: ActionDeps;
  drag?: {
    start: Point2;
    current: Point2;
    delta: Point2;
    /**
     * Drag delta in client/screen coordinates (CSS pixels from the drag
     * origin). Use this — never `delta` — for any action whose effect
     * mutates the viewport itself (pan, view-zoom), because world-space
     * deltas become self-referential as the view shifts mid-drag.
     *
     * Populated when the dispatcher received `clientX`/`clientY` on the
     * underlying pointer events. Absent for legacy callers that don't
     * provide them.
     */
    screenDelta?: Point2;
    affordance?: AffordanceHit;
    /**
     * Full pointermove history for the current drag, in world space, with
     * per-sample stylus state when the browser reported it.
     * Accumulated by the dispatcher on every `pointermove` pump event.
     * Available only during `onMove` and `onEnd` calls (not on `start`).
     * Used by `lassoSelectAction` to build its polygon vertex list and by
     * `insertAction`'s pencil kind to carry the freehand stroke.
     */
    points?: DragSample[];
  };
  wheel?: { deltaX: number; deltaY: number; deltaZ: number };
  multiTouch?: {
    centroid: Point2;
    spread: number;
    rotation: number;
    /**
     * Pinch-zoom geometry. Populated by the dispatcher when a multitouch
     * handle is in flight and a pointermove-pump fires.
     * `startSpread` is the spread at the moment the gesture began.
     * `currentSpread` is the spread at the current frame.
     */
    pinch?: {
      startSpread: number;
      currentSpread: number;
      centroid: Point2;
    };
  };
  key?: { key: string; repeat: boolean };
  /**
   * Per-invocation parameters. Populated by `ActionsRegistry.begin()` for
   * UI-driven ongoing actions (color picker, opacity slider) so handles can
   * read the current value on `start` and updated values on `onMove`. The
   * gesture dispatcher does not populate this field; gesture-driven actions
   * receive params via `BindingOpts.params` on `start` (the `opts` arg).
   */
  params?: Record<string, unknown>;
}

/** Per-invocation options the dispatcher reads from a `GestureBinding`'s
 *  `opts` field and passes to `OngoingInvoker.start`. Today carries
 *  behaviors; extensible. */
export interface BindingOpts {
  behaviors?: ActionBehavior<unknown, unknown, unknown>[];
  /** Per-binding action parameters. The action's invoker reads
   *  these via the second arg to `run` (or via InvocationCtx for ongoing
   *  invokers, when needed). Loose typing (Record<string, unknown>) for
   *  now; consider per-action typing later via BindingOpts<A>.
   *
   *  params may also be a thunk evaluated each time the
   *  dispatcher (or invoker) needs the value. Thunks let tools close over
   *  refs that mutate during a gesture (e.g. polygon `sides` adjusted
   *  mid-drag via ArrowUp). For ongoing invokers that want the latest
   *  values at commit, the invoker can re-call the thunk inside `onEnd`
   *  via `resolveParams(opts?.params)`. */
  params?: Record<string, unknown> | (() => Record<string, unknown>);
}

/** Resolve `BindingOpts.params` to a concrete record (calling the thunk if
 *  needed). Returns `undefined` for absent params. */
export function resolveParams(
  params: BindingOpts['params'],
): Record<string, unknown> | undefined {
  if (params === undefined) return undefined;
  return typeof params === 'function' ? params() : params;
}

/** Convention-shaped action dependencies bag. Actions declare which
 *  contexts they consume; the dispatcher composes them per call.
 *  Consumer-side contexts (e.g. ColorContext) plug in by extending. */
export interface ActionDeps {
  // Common kit contexts (all optional; actions consume what they need):
  selection?: unknown;
  view?: unknown;
  scene?: unknown;
  pointer?: unknown;
  activeTool?: unknown;
  // Consumer-side contexts pass through:
  [k: string]: unknown;
}

/**
 * Discriminated overlay shape returned by `OngoingHandle.overlay()`.
 * Dispatcher-side chrome surface for in-flight
 * gestures that paint non-ghost visuals. The canvas's
 * `useDispatcherOverlayLayer` walks every in-flight handle, calls
 * `overlay()`, and dispatches on `kind` to draw the appropriate shape.
 *
 * `marquee` mirrors `AreaSelectOverlay`; `lasso` mirrors `LassoSelectOverlay`.
 * `commands` is the generic escape hatch — actions emit arbitrary
 * `DrawCommand[]` for previews the typed variants can't express (insert
 * shape outlines, paste ghosts of synthetic nodes, custom chrome). World-
 * space is the default; the layer wraps in `viewToMat3` so commands track
 * the camera. Set `space: 'screen'` for projections you've already done
 * yourself (rare).
 */
export type OngoingOverlay =
  | {
      kind: 'marquee';
      start: { x: number; y: number };
      current: { x: number; y: number };
      shiftHeld: boolean;
    }
  | {
      kind: 'lasso';
      vertices: ReadonlyArray<{ x: number; y: number }>;
      current: { x: number; y: number };
      shiftHeld: boolean;
    }
  | {
      kind: 'commands';
      commands: readonly import('../../renderer').DrawCommand[];
      /** Coordinate space the commands are authored in. Default `'world'`
       *  — the layer wraps them in `viewToMat3(view)` so they track the
       *  camera. `'screen'` emits them as-is (CSS pixels). */
      space?: 'world' | 'screen';
    }
  | {
      /**
       * Live insert-drag preview — dispatched by `insertAction` while the
       * user is dragging out a new shape. Pre-commit there is no scene node
       * to ghost via `previewIds()`/`previewPose()`, so insert paints its
       * preview through the dispatcher overlay layer instead.
       *
       * `shape` is the kit's built-in insert kind. `bounds` is the AABB of
       * the current drag (start/current normalized). `extras` is the
       * per-kind extras the action already collected — the overlay
       * renderer rebuilds the shape using the same path builders the
       * commit factory uses, so the preview matches the eventual node.
       *
       * `extras` is opaque (`unknown`) at the union level; the overlay
       * renderer narrows on `shape` and casts the field shape it expects.
       */
      kind: 'insertPreview';
      shape: 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'pencil' | 'image';
      bounds: { x: number; y: number; width: number; height: number };
      extras: unknown;
      /** World-space point to paint a small "anchor" dot at. Sells the
       *  click point as the drag's anchor — particularly useful for
       *  radial shapes (polygon/star) where no vertex sits on the
       *  click point, and for any shape in center mode where the dot
       *  marks the center the shape grows around. */
      anchorPoint?: { x: number; y: number };
    };

/** Handle returned from an `OngoingInvoker.start`. The dispatcher pumps
 *  `onMove` on subsequent input events of the same gesture and calls
 *  `onEnd` exactly once (with `'commit'` on natural completion or `'cancel'`
 *  on pointercancel / blur / escape). */
export interface OngoingHandle {
  /**
   * Optional logical action kind — a stable, human-readable tag the
   * dispatcher exposes via `getActiveAction()` for chrome-visibility
   * rules and any other surface that wants to react to "what action
   * is currently in flight" without inspecting handles directly.
   *
   * Examples: `'marquee'`, `'lasso'`, `'move'`, `'resize'`, `'rotate'`,
   * `'pan'`, `'pinch'`.
   *
   * Distinct from the dispatcher's internal `gestureId` (`pointer-mouse`,
   * `key-held-Space`, etc.) which keys per-pointer state and is not
   * meaningful to consumers.
   *
   * When omitted, the action is "anonymous" — `getActiveAction().kind`
   * reports `null` even though a handle is in flight. This is fine for
   * actions that don't have visible chrome of their own.
   */
  kind?: string;

  onMove?(ctx: InvocationCtx): void;
  onEnd?(ctx: InvocationCtx, reason: 'commit' | 'cancel'): void;

  /**
   * Optional preview surface — dispatcher-side ghost overlay.
   *
   * An ongoing-action implementation may populate `previewIds()` +
   * `previewPose(id)` to expose its in-flight preview state for the
   * canvas's preview-ghost layer (`usePreviewGhostLayer`) to render on
   * top of the committed scene during the gesture.
   *
   * Returning `null` (or omitting the method entirely) means "no preview
   * this gesture" — the canvas will skip this handle as a source.
   *
   * Semantics mirror the tool-side `Tool.previewIds` / `Tool.previewPose`
   * pair: `previewIds()` enumerates the displaced node ids; `previewPose(id)`
   * returns the interim pose for one of those ids (shape opaque — the
   * canvas casts to its `TPose` parameter). The preview-ghost layer
   * merges all sources via first-non-null semantics, with tool-side
   * previews taking precedence over dispatcher-side (preserves
   * backwards-compat during the registry-unification migration).
   */
  previewIds?(): Iterable<string> | null;
  previewPose?(id: string): unknown | null;

  /**
   * When `false`, the preview-ghost layer paints the ghost AND the
   * source node stays visible at its committed pose. Defaults to
   * `true` (move/resize/rotate semantics: ghost replaces the source
   * during the gesture). Clone overrides to `false` so the original
   * stays put and the ghost appears at the drag target.
   */
  previewHidesSource?: boolean;

  /**
   * Optional per-id preview *data*. Falls back to the committed
   * `node.data` when null/absent. Use when the gesture mutates
   * `node.data` (e.g. anchor-edit on nodes that store the polygon on
   * `data.path`) rather than (or in addition to) the pose. The preview-
   * ghost layer assembles a synthetic node from `{ ...node, pose:
   * previewPose ?? node.pose, data: previewData ?? node.data }` before
   * calling the scene slot's `drawOne`.
   *
   * Sources compose first-non-null per axis: an action can emit only
   * `previewPose` (translation), only `previewData` (data-only edit),
   * or both (pose + data both change, e.g. anchor drag on a data.path
   * node where the bounds shift).
   */
  previewData?(id: string): unknown | null;

  /**
   * Optional chrome surface — dispatcher-side overlay layer.
   *
   * An ongoing-action implementation may populate `overlay()` to expose a
   * non-ghost visual (marquee rectangle, lasso polyline) for the canvas's
   * `useDispatcherOverlayLayer` to paint while the gesture is in flight.
   * Returning `null` (or omitting the method) means "no overlay this
   * gesture" — the canvas will skip this handle as a chrome source.
   *
   * Distinct from the `previewIds()`/`previewPose(id)` ghost surface,
   * which paints displaced scene-node silhouettes. Marquee and lasso
   * gestures don't displace any node, but still need on-screen feedback.
   */
  overlay?(): OngoingOverlay | null;
}

/** Fire-once invocation. Runs to completion synchronously (or fires off an
 *  async side-effect; the registry doesn't wait). */
export interface ImmediateInvoker {
  timing: 'immediate';
  /** `params` carries the matched binding's opts.params. When
   *  invoked via the legacy `Action.run` bridge or from the command palette
   *  with no per-binding context, `params` is undefined; descriptors should
   *  default to a sensible variant. */
  run(deps: ActionDeps, params?: Record<string, unknown>): void;
}

/** Phase-machine invocation. `start` opens the phase and returns the handle
 *  the dispatcher pumps. */
export interface OngoingInvoker {
  timing: 'ongoing';
  start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle;
}

/** Pluggable invocation strategy for an Action. Future variants
 *  (`longPress`, `twoStage`, `modal`) extend this union without touching
 *  the `Action` type. */
export type Invoker = ImmediateInvoker | OngoingInvoker;
