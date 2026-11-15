/**
 * GestureBinding — connects a GestureSpec to an Action id (with per-binding
 * options). Tools own arrays of these on their `bindings` field; ambient
 * gesture-bindings are registered globally.
 */

import type { GestureSpec } from '@weasel-js/gestures';
import type { ActionParamSchema } from '../../index';
import type { BindingOptions } from './invoker';
import { dynamicActionId, type DynamicActionId, type InvokeParams, type KnownActionId, type NoParams } from './actionIds';

/** A binding to the action `Id`, its params typed `P`. */
export interface BindingOf<Id extends string, P> {
  spec: GestureSpec;
  actionId: Id;
  opts?: BindingOptions<P>;
}

/**
 * An interaction: a gesture spec composed with the id of the action it
 * invokes. Tools declare arrays of these; the dispatcher matches an incoming
 * input event against them and runs the winner's action.
 *
 * An id `ActionParamSchema` names passes that entry's params, whole; any other
 * id passes none, unless it is a `dynamicActionId`, whose params go unchecked.
 */
export type GestureBinding =
  | { [K in KnownActionId]: BindingOf<K, ActionParamSchema[K]> }[KnownActionId]
  | BindingOf<DynamicActionId, Record<string, unknown>>
  | BindingOf<string, NoParams>;

/**
 * A binding of `spec` to `actionId`, its params typed as `trigger`'s are: for an id a literal binding cannot name
 * by itself, such as one of several known ids (`` `${kind}.drag` ``) or one a generic function is handed.
 */
export function bindAction<Id extends string>(
  spec: GestureSpec,
  actionId: Id,
  opts?: BindingOptions<InvokeParams<Id>>,
): GestureBinding {
  // `InvokeParams` gives each id of `Id` its own entry's params, as a binding of that id alone takes.
  return { spec, actionId, ...(opts !== undefined ? { opts } : {}) } as GestureBinding;
}

/** `binding`'s options as routing reads them, whichever action it names: its params an open record. */
export function routedOpts(binding: GestureBinding): BindingOptions | undefined {
  // Every schema entry is a record of params; an entry declared as an interface just does not say so.
  return binding.opts as BindingOptions | undefined;
}

/**
 * A single entry in `Action.defaultBinding[]`. Either a bare `GestureSpec`
 * (no per-binding opts) or an object form that pairs a spec with
 * `BindingOptions` for parametric actions (e.g. `{ params: { axis: 'x' } }`).
 * Use the object form when two bindings for the same action differ only in
 * a runtime parameter — the dispatcher extracts `opts.params` and passes
 * them to `ImmediateInvoker.run` as its second argument.
 */
export type BoundGesture<P = Record<string, unknown>> = GestureSpec | { spec: GestureSpec; opts?: BindingOptions<P> };

/**
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
 * Flatten an action's `defaultBinding` into `GestureBinding`s. A bare
 * `GestureSpec` has `kind` at top level; the object form has `spec`.
 */
export function actionBindings(action: BindingSource): BindingOf<DynamicActionId, Record<string, unknown>>[] {
  const gs = action.defaultBinding;
  if (!gs) return [];
  const raw: BoundGesture[] = Array.isArray(gs) ? gs : [gs as BoundGesture];
  return raw.map((entry) => {
    const isBoundObj = !('kind' in entry);
    const spec = isBoundObj ? (entry as { spec: GestureSpec }).spec : (entry as GestureSpec);
    const opts = isBoundObj ? (entry as { opts?: BindingOptions }).opts : undefined;
    return { spec, actionId: dynamicActionId(action.id), ...(opts !== undefined ? { opts } : {}) };
  });
}
