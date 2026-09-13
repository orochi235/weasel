/**
 * GestureBinding — connects a GestureSpec to an Action id (with per-binding
 * options). Tools own arrays of these on their `bindings` field; ambient
 * gesture-bindings are registered globally.
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md`.
 */

import type { GestureSpec } from '@weasel-js/gestures';
import type { BindingOpts } from './invoker';

/** An interaction: a gesture spec composed with the id of the action it
 *  invokes. Tools declare arrays of these; the dispatcher matches an incoming
 *  input event against them and runs the winner's action. */
export interface GestureBinding {
  spec: GestureSpec;
  actionId: string;
  opts?: BindingOpts;
}

/**
 * @experimental
 * A single entry in `Action.defaultBinding[]`. Either a bare `GestureSpec`
 * (no per-binding opts) or an object form that pairs a spec with
 * `BindingOpts` for parametric actions (e.g. `{ params: { axis: 'x' } }`).
 * Use the object form when two bindings for the same action differ only in
 * a runtime parameter — the dispatcher extracts `opts.params` and passes
 * them to `ImmediateInvoker.run` as its second argument.
 */
export type BoundGesture = GestureSpec | { spec: GestureSpec; opts: BindingOpts };

/**
 * @experimental
 * The whole of an action `actionBindings` reads. Routing needs this much and
 * none of `Action`'s palette fields, so it is the narrowest type the
 * dispatcher's binding walk can be written against.
 */
export interface BindingSource {
  id: string;
  /** The gesture-spec form of the binding, read by the gesture dispatcher.
   *  May be a single `GestureSpec`, a bare `GestureSpec[]` (any-of semantics),
   *  or a `BoundGesture[]` where each entry is either a bare `GestureSpec` or
   *  `{ spec, opts }` — use the object form for parametric actions where two
   *  bindings for the same action differ only by `opts.params` (e.g. `flip`
   *  with `axis: 'x'` vs `'y'`). The dispatcher extracts `opts.params` and
   *  passes them to `ImmediateInvoker.run` as its second argument. */
  defaultBinding?: GestureSpec | BoundGesture[];
}

/**
 * @experimental
 * Flatten an action's `defaultBinding` into `GestureBinding`s. A bare
 * `GestureSpec` has `kind` at top level; the object form has `spec`.
 */
export function actionBindings(action: BindingSource): GestureBinding[] {
  const gs = action.defaultBinding;
  if (!gs) return [];
  const raw: BoundGesture[] = Array.isArray(gs) ? gs : [gs as BoundGesture];
  return raw.map((entry) => {
    const isBoundObj = !('kind' in entry);
    const spec = isBoundObj ? (entry as { spec: GestureSpec }).spec : (entry as GestureSpec);
    const opts = isBoundObj ? (entry as { opts: BindingOpts }).opts : undefined;
    return { spec, actionId: action.id, ...(opts !== undefined ? { opts } : {}) };
  });
}
