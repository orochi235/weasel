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

import type { ActionBehavior } from '../gestures/types';

/** A 2D point in either world or screen coordinates. */
export interface Point2 {
  x: number;
  y: number;
}

/** Modifier-key state at the time of invocation. */
export interface ModifierState {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/** Per-invocation runtime context the dispatcher hands to an Invoker.
 *  Gesture-kind-specific fields (`drag`, `wheel`, `multiTouch`, `key`) are
 *  populated only for matching gesture kinds. */
export interface InvocationCtx {
  world: Point2;
  screen: Point2;
  modifiers: ModifierState;
  deps: ActionDeps;
  drag?: { start: Point2; current: Point2; delta: Point2 };
  wheel?: { deltaX: number; deltaY: number; deltaZ: number };
  multiTouch?: { centroid: Point2; spread: number; rotation: number };
  key?: { key: string; repeat: boolean };
}

/** Per-invocation options the dispatcher reads from a `GestureBinding`'s
 *  `opts` field and passes to `OngoingInvoker.start`. Today carries
 *  behaviors; extensible. */
export interface BindingOpts {
  behaviors?: ActionBehavior<unknown, unknown, unknown>[];
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
  run(deps: ActionDeps): void;
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
