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

import type { ActionBehavior, ModifierState } from '../gestures/types';

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
  /** World-space fixed/pivot point. For resize: opposite corner. For rotate: pivot. */
  fixedPoint?: { x: number; y: number };
  /** Which nodes this affordance belongs to. */
  targetIds?: string[];
}

/** Per-invocation runtime context the dispatcher hands to an Invoker.
 *  Gesture-kind-specific fields (`drag`, `wheel`, `multiTouch`, `key`) are
 *  populated only for matching gesture kinds. */
export interface InvocationCtx {
  world: Point2;
  screen: Point2;
  modifiers: ModifierState;
  deps: ActionDeps;
  drag?: { start: Point2; current: Point2; delta: Point2; affordance?: AffordanceHit };
  wheel?: { deltaX: number; deltaY: number; deltaZ: number };
  multiTouch?: { centroid: Point2; spread: number; rotation: number };
  key?: { key: string; repeat: boolean };
}

/** Per-invocation options the dispatcher reads from a `GestureBinding`'s
 *  `opts` field and passes to `OngoingInvoker.start`. Today carries
 *  behaviors; extensible. */
export interface BindingOpts {
  behaviors?: ActionBehavior<unknown, unknown, unknown>[];
  /** Phase 4+: per-binding action parameters. The action's invoker reads
   *  these via the second arg to `run` (or via InvocationCtx for ongoing
   *  invokers, when needed). Loose typing (Record<string, unknown>) for
   *  now; consider per-action typing later via BindingOpts<A>. */
  params?: Record<string, unknown>;
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

/** Handle returned from an `OngoingInvoker.start`. The dispatcher pumps
 *  `onMove` on subsequent input events of the same gesture and calls
 *  `onEnd` exactly once (with `'commit'` on natural completion or `'cancel'`
 *  on pointercancel / blur / escape). */
export interface OngoingHandle {
  onMove?(ctx: InvocationCtx): void;
  onEnd?(ctx: InvocationCtx, reason: 'commit' | 'cancel'): void;
}

/** Fire-once invocation. Runs to completion synchronously (or fires off an
 *  async side-effect; the registry doesn't wait). */
export interface ImmediateInvoker {
  timing: 'immediate';
  /** `params` carries the matched binding's opts.params (Phase 4+). When
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
