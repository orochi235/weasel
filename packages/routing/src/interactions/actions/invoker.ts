/**
 * Invoker — pluggable invocation strategy for an Action.
 *
 * An Action's `invoker` field describes how it's run. `immediate` invokers
 * fire once (delete, align, undo). `ongoing` invokers open a phase machine
 * driven by the dispatcher (move, resize, pinch-zoom).
 */

import type { ModifierState, ResizeAnchor } from '../../vocabulary';
import type { ClaimableGesture } from '@weasel-js/gestures';
import type { Point } from '@weasel-js/geom';

import type { CursorSpec } from '@weasel-js/cursor';
import type { DepSchema } from '../../index';
import type { OngoingOverlay } from './overlay';
import type { RoleRebinds } from './modifierRoles';

export type { ModifierState } from '../../vocabulary';

/** A 2D point in either world or screen coordinates; geom's `Point`. */
export type Point2 = Point;

/**
 * Which UI affordance was hit at pointerdown. Populated by the dispatcher when
 * the `affordanceAt` thunk is provided to `useGestureDispatcher`.
 *
 * `kind` is a discriminator string:
 *   - `'handle:top-left'` / `'handle:top-right'` / `'handle:bottom-left'` /
 *     `'handle:bottom-right'` — corner resize handles.
 *   - `'handle:top'` / `'handle:right'` / `'handle:bottom'` / `'handle:left'` —
 *     edge resize handles.
 *   - `'rotate-handle'` — the rotation affordance.
 *   - `'anchor:N'` — a path anchor at index N.
 */
export interface AffordanceHit {
  /** Discriminator string, e.g. `'handle:bottom-right'`. */
  kind: string;
  /** Id of whatever produced this hit — a kit affordance's `id`, or the
   *  registered layer's id. */
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
  /** Set only when `kind` matches `'handle:*'`: which corner or edge stays
   *  fixed during a resize; `'free'` on the axis an edge handle leaves alone. */
  anchor?: ResizeAnchor;
  /** Cursor to show while the pointer hovers this affordance (no gesture in
   *  flight). Unset falls through to action-cursor prediction, then to the
   *  active tool's cursor. */
  cursor?: CursorSpec;
  /**
   * Free-form payload from whatever produced the hit, carried through to the
   * matching action untouched. Kit affordances leave it unset; it exists for
   * a registered layer's own chrome, where the hit-test already resolved
   * *which* of its pieces was hit.
   */
  payload?: unknown;
}

/**
 * One accumulated point on a drag trail: world-space position plus whatever
 * stylus state the originating `PointerEvent` carried.
 *
 * The stylus fields are absent for mouse/touch on browsers that don't report
 * them, and for synthetic events.
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
  /**
   * The pointer in client/screen pixels, for an action that has to place DOM
   * at the pointer. Absent on every invocation whose event carries no client
   * coordinates — a keystroke, a UI-driven trigger, a synthetic probe — so
   * read it with a fallback rather than assuming a point.
   *
   * A view-mutating drag wants `drag.screenDelta`, not the difference of two
   * of these: world deltas are self-referential mid-pan, and so is any delta
   * taken across a view change.
   */
  screen?: Point2;
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
     * Absent when the underlying pointer events carried no
     * `clientX`/`clientY`.
     */
    screenDelta?: Point2;
    affordance?: AffordanceHit;
    /**
     * Full pointermove history for the current drag, in world space, with
     * per-sample stylus state when the browser reported it.
     * Available only during `onMove` and `onEnd` calls (not on `start`).
     *
     * During `onMove` this is the dispatcher's live accumulator, and it grows
     * under you — read it, don't retain it. On `onEnd` it is a snapshot, so
     * that is where an action that keeps the trail should take it.
     */
    points?: DragSample[];
  };
  wheel?: { deltaX: number; deltaY: number; deltaZ: number };
  /** One `pinch` sample: `scale` is a multiplier since the previous sample,
   *  `rotation` degrees since it. See `PinchEvent`. */
  pinch?: { scale: number; rotation: number };
  multiTouch?: {
    /** Canvas-local CSS pixels — see `MultiTouchEvent.centroid`. Neither
     *  `world` nor `screen`: it is the space `zoomAt` anchors in, so passing
     *  it through `clientToWorld` removes the canvas origin twice. */
    centroid: Point2;
    /** Distance between the two primary pointers, in CSS pixels. */
    spread: number;
    /** Degrees the line between the two primary pointers has turned since
     *  the gesture began, clockwise positive. It keeps counting past a half
     *  turn. Zero where the events carry no `MultiTouchEvent.angle`. */
    rotation: number;
    /**
     * Pinch-zoom geometry, populated while a multitouch handle is in flight.
     * `startSpread` is the spread at the moment the gesture began.
     */
    pinch?: {
      startSpread: number;
      currentSpread: number;
      /** Canvas-local, same as the enclosing `centroid`. */
      centroid: Point2;
    };
  };
  key?: { key: string; repeat: boolean };
  /** What a carry over the surface brings: its payload, as `startCarry` was
   *  handed it. Present for every event of a `carry` binding's gesture. */
  carry?: { type: string; value: unknown };
  /**
   * The view the input landed in, as the surface's view resolver assigned it:
   * a view id, or `null` for the surface's own camera. Absent where no
   * surface routed the input — a UI-driven trigger, a bare dispatcher.
   */
  viewId?: string | null;
  /**
   * Per-invocation parameters. Populated by `ActionsRegistry.begin()` for
   * UI-driven ongoing actions (color picker, opacity slider). The gesture
   * dispatcher does not populate this field; gesture-driven actions receive
   * params via `BindingOpts.params` on `start` (the `opts` arg).
   */
  params?: Record<string, unknown>;
  /**
   * Which of the action's `modifierRoles` are held for this event, by role
   * id. The dispatcher fills it on every event of a gesture whose action
   * declares roles; absent otherwise. Read it through `roleReader`, which
   * falls back to the roles' default keys where it is absent.
   */
  roles?: Readonly<Record<string, boolean>>;
}

/** Per-invocation options the dispatcher reads from a `GestureBinding`'s
 *  `opts` field and passes to `OngoingInvoker.start`. */
export interface BindingOpts {
  /** The id a binding override names this binding by, `<owner>.<role>`:
   *  `undo.key`, `rect.drag`, `nudge.left.big`. Without one it is its owner and
   *  its position (`<entry>#<n>`, `<action>@<n>`), which moves when the defaults
   *  are reordered, so a binding a host may persist an override for declares one. */
  id?: string;
  /** Gesture behaviors the action's own invoker runs. Routing carries the
   *  array to the action and never reads an element, so the element type is
   *  open here; `@weasel-js/core` narrows it. */
  behaviors?: unknown[];
  /** Per-binding action parameters, which an immediate invoker reads via the
   *  second arg to `run`.
   *
   *  May also be a thunk evaluated each time the value is needed, so a tool
   *  can close over refs that mutate during a gesture (e.g. polygon `sides`
   *  adjusted mid-drag via ArrowUp). An ongoing invoker that wants the latest
   *  values at commit re-calls it inside `onEnd` via
   *  `resolveParams(opts?.params)`. */
  params?: Record<string, unknown> | (() => Record<string, unknown>);
  /**
   * The views this binding is live in, by id, where `null` is the surface's
   * own camera. Omitted means every view.
   *
   * A binding that names the view an input landed in outranks every binding
   * that does not, whatever their scope tiers: naming a view is the most
   * specific thing a binding can say about where it applies. Without that, a
   * drag bound inside a minimap view loses to the active tool's marquee.
   */
  views?: readonly (string | null)[];
  /**
   * Says this binding is declared ahead of another on the same input on
   * purpose: its action declines through `enabled()` when the input is not its
   * to take, and the next binding fires. The dispatcher does that for any
   * binding; this tells the route-conflict check the order is the design.
   */
  yields?: boolean;
  /**
   * For a key binding: live while the pointer is over the surface, whichever
   * canvas holds the keys, and only then. For a key that means "here" — a
   * magnifier's peek — on a page with more than one surface that hears it.
   */
  over?: boolean;
  /**
   * Keys for some of the action's `modifierRoles` on this binding, by role
   * id, over the action's defaults and any tuning's.
   */
  roles?: RoleRebinds;
}

/** Resolve `BindingOpts.params` to a concrete record (calling the thunk if
 *  needed). Returns `undefined` for absent params. */
export function resolveParams(
  params: BindingOpts['params'],
): Record<string, unknown> | undefined {
  if (params === undefined) return undefined;
  return typeof params === 'function' ? params() : params;
}

/** The deps an action receives, composed per call from what it `requires`.
 *  Each name resolves to its {@link DepSchema} entry, and is absent when no
 *  source registered it; a name nothing has declared passes through as
 *  `unknown`. */
export interface ActionDeps extends Partial<DepSchema> {
  [k: string]: unknown;
}

export type { OngoingOverlay, OverlayRole } from './overlay';

/** Handle returned from an `OngoingInvoker.start`. The dispatcher pumps
 *  `onMove` on subsequent input events of the same gesture and calls
 *  `onEnd` exactly once (with `'commit'` on natural completion or `'cancel'`
 *  on pointercancel / blur / escape). */
export interface OngoingHandle {
  /**
   * Optional logical action kind — a stable, human-readable tag the
   * dispatcher exposes via `getActiveAction()`, e.g. `'marquee'`, `'move'`,
   * `'resize'`, `'pan'`.
   *
   * When omitted, `getActiveAction().kind` reports `null` even though a
   * handle is in flight.
   */
  kind?: string;

  /**
   * The cursor this gesture shows now, read after every move. Wins over the
   * action's `activeCursor`, for a cursor that follows the gesture — the
   * rotate glyph turning about its pivot. `undefined` defers to the action.
   */
  cursor?(): CursorSpec | undefined;

  onMove?(ctx: InvocationCtx): void;
  onEnd?(ctx: InvocationCtx, reason: 'commit' | 'cancel'): void;

  /**
   * Optional preview surface: the in-flight state the canvas's preview-ghost
   * layer renders on top of the committed scene during the gesture.
   *
   * `previewIds()` enumerates the displaced node ids; `previewPose(id)`
   * returns the interim pose for one of them (shape opaque — the canvas
   * casts to its `TPose` parameter). `previewIds` returning `null`, or
   * omitted, means "no preview this gesture". An id with no `previewPose`
   * is shown at its effective pose: an action that publishes its poses to
   * the scene's pose overrides, as move, resize and rotate do, leaves
   * `previewPose` out rather than answering the same pose twice. `<SceneCanvas>`
   * also shows both answers to the scene as overrides (core's
   * `publishPreviews`), so what derives from a previewed node follows it.
   */
  previewIds?(): Iterable<string> | null;
  previewPose?(id: string): unknown | null;

  /**
   * Subset of `previewIds()` the ghost layer paints at full opacity. The
   * ghost alpha says "this is in flight under the pointer"; a node the
   * gesture merely displaces — a layout sibling reflowing into its
   * destination slot — is not, and reads better settled. Honored at
   * subtree-root granularity.
   */
  previewOpaqueIds?(): Iterable<string> | null;

  /**
   * When `false`, the preview-ghost layer paints the ghost AND the source
   * node stays visible at its committed pose, as a clone wants. Defaults to
   * `true`: the ghost replaces the source during the gesture.
   */
  previewHidesSource?: boolean;

  /**
   * Optional per-id preview *data*, for a gesture that mutates `node.data`
   * (e.g. anchor-edit on nodes that store the polygon on `data.path`) rather
   * than, or in addition to, the pose. Falls back to the committed
   * `node.data` when null/absent.
   */
  previewData?(id: string): unknown | null;

  /**
   * Optional chrome surface: a non-ghost visual (marquee rectangle, lasso
   * polyline) painted while the gesture is in flight — one, or a list for a
   * gesture showing several runs at once. Returning `null`, or omitting the
   * method, means "no overlay this gesture". Read it through
   * {@link overlaysOf}, which answers a list either way.
   */
  overlay?(): OngoingOverlay | readonly OngoingOverlay[] | null;

  /**
   * A wheel turned while this gesture is in flight — scrubbing a value the
   * drag is using, say. Return `true` to claim the wheel, so no wheel binding
   * (the viewport's zoom or pan) sees it; anything else lets it through.
   * Omit it and the wheel goes to the bindings as usual.
   */
  onWheel?(ctx: InvocationCtx): boolean | void;
}

/** Fire-once invocation. Runs to completion synchronously (or fires off an
 *  async side-effect; the registry doesn't wait). */
export interface ImmediateInvoker {
  timing: 'immediate';
  /** `params` carries the matched binding's opts.params. Invoked from the
   *  command palette, or anywhere else with no per-binding context, `params`
   *  is undefined; descriptors should default to a sensible variant. */
  run(deps: ActionDeps, params?: Record<string, unknown>): void;
}

/** Phase-machine invocation. `start` opens the phase and returns the handle
 *  the dispatcher pumps. */
export interface OngoingInvoker {
  timing: 'ongoing';
  start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle;
}

/** Pluggable invocation strategy for an Action. */
export type Invoker = ImmediateInvoker | OngoingInvoker;
