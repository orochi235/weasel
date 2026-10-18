/**
 * Tuning: what a host changes about an action it did not write — the params
 * every invocation starts from, and bindings added beside the action's own —
 * without restating the descriptor. `ActionsRegistry.tune` holds tunings and
 * applies them to whatever descriptor is live for the id.
 */
import type { GestureSpec } from '@weasel-js/gestures';
import type { Action } from './action';
import type { BoundGesture } from './binding';
import { resolveParams, type BindingOpts, type Invoker } from './invoker';
import { rebindRoles, type RoleRebinds } from './modifierRoles';

/** An action's params, or a thunk read each time the action asks for them. */
export type ActionParams<P = Record<string, unknown>> = Partial<P> | (() => Partial<P>);

/** A binding added for an action: a gesture alone, or a gesture with the
 *  options it passes — the {@link BoundGesture} shape, its params typed. */
export type TunedBinding<P = Record<string, unknown>> =
  | GestureSpec
  | { spec: GestureSpec; opts: Omit<BindingOpts, 'params'> & { params?: ActionParams<P> } };

/** What a host changes about one action. */
export interface ActionTuning<P = Record<string, unknown>> {
  /** Params every invocation starts from. What a binding or a `trigger` call
   *  passes is laid over them, so these fill in what it leaves out. A thunk is
   *  read on every call, and an ongoing action resolving its `opts.params`
   *  mid-gesture sees the value as it is then. */
  params?: ActionParams<P>;
  /** Bindings added after the action's own `defaultBinding`. */
  bindings?: readonly TunedBinding<P>[];
  /** Keys for some of the action's `modifierRoles`, by role id. A binding's
   *  own `opts.roles` is laid over these. */
  roles?: RoleRebinds;
}

type Params = BindingOpts['params'];

const WRAPS = new WeakMap<Invoker, { inner: Invoker; params: ActionParams }>();

function layered(under: ActionParams, over: Params): Params {
  if (typeof under !== 'function' && typeof over !== 'function') return tunedParams([{ params: under }], over);
  return () => tunedParams([{ params: under }], resolveParams(over));
}

function wrapInvoker(invoker: Invoker, params: ActionParams): Invoker {
  for (let w: Invoker | undefined = invoker; w; w = WRAPS.get(w)?.inner) {
    if (WRAPS.get(w)?.params === params) return invoker;
  }
  const base = (given: Record<string, unknown> | undefined) => tunedParams([{ params }], given);
  const wrapped: Invoker = invoker.timing === 'immediate'
    ? { timing: 'immediate', run: (deps, given) => invoker.run(deps, base(given)) }
    : {
        timing: 'ongoing',
        start: (ctx, opts) => invoker.start(
          ctx.params ? { ...ctx, params: base(ctx.params) } : ctx,
          { ...opts, params: layered(params, opts?.params) },
        ),
      };
  WRAPS.set(wrapped, { inner: invoker, params });
  return wrapped;
}

function withBindings(
  own: Action['defaultBinding'],
  added: readonly TunedBinding[],
): BoundGesture[] {
  const base: BoundGesture[] = own === undefined ? [] : Array.isArray(own) ? own : [own];
  return [...base, ...(added as readonly BoundGesture[]).filter((b) => !base.includes(b))];
}

const CURSOR_WRAPS = new WeakMap<object, { inner: Action['cursor']; params: ActionParams }>();

/** A cursor that reads params, handed the tuning's under the call's. */
function wrapCursor(cursor: Action['cursor'], params: ActionParams): Action['cursor'] {
  if (typeof cursor !== 'function') return cursor;
  for (let w: Action['cursor'] = cursor; typeof w === 'function'; w = CURSOR_WRAPS.get(w)?.inner) {
    if (CURSOR_WRAPS.get(w)?.params === params) return cursor;
  }
  const wrapped = (given: Record<string, unknown> | undefined) => cursor(tunedParams([{ params }], given));
  CURSOR_WRAPS.set(wrapped, { inner: cursor, params });
  return wrapped;
}

function tuneOnce(action: Action, tuning: ActionTuning): Action {
  const invoker = tuning.params && action.invoker ? wrapInvoker(action.invoker, tuning.params) : action.invoker;
  const cursor = tuning.params ? wrapCursor(action.cursor, tuning.params) : action.cursor;
  const bindings = tuning.bindings?.length ? withBindings(action.defaultBinding, tuning.bindings) : null;
  const modifierRoles = tuning.roles && action.modifierRoles ? rebindRoles(action.modifierRoles, tuning.roles) : null;
  if (invoker === action.invoker && cursor === action.cursor && bindings === null && modifierRoles === null) return action;
  return {
    ...action,
    ...(modifierRoles ? { modifierRoles } : {}),
    ...(invoker ? { invoker } : {}),
    ...(cursor ? { cursor } : {}),
    ...(bindings ? { defaultBinding: bindings } : {}),
  };
}

/** The params an invocation passing `given` starts with under `tunings`:
 *  each tuning's params over the one before, and `given` over them all. */
export function tunedParams(
  tunings: readonly ActionTuning[],
  given?: Record<string, unknown>,
): Record<string, unknown> {
  let out: Record<string, unknown> = {};
  for (const t of tunings) out = { ...out, ...resolveParams(t.params as Params) };
  return { ...out, ...given };
}

/** `action` with each tuning applied in turn, a later one's params over an
 *  earlier one's. Applying a tuning to a copy it already tuned changes nothing. */
export function tuneAction(action: Action, tunings: readonly ActionTuning[]): Action {
  let out = action;
  for (const t of tunings) out = tuneOnce(out, t);
  return out;
}
