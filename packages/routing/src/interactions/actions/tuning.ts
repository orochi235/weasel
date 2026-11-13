/**
 * Tuning: what a host changes about an action it did not write — the params
 * every invocation starts from, and bindings added beside the action's own —
 * without restating the descriptor. `ActionsRegistry.tune` holds tunings and
 * applies them to whatever descriptor is live for the id.
 */
import type { GestureSpec } from '@weasel-js/gestures';
import type { Action } from './action';
import type { BoundGesture } from './binding';
import { resolveParams, type BindingOptions, type Invoker } from './invoker';
import { rebindRoles, type RoleRebinds } from './modifierRoles';
import { formWith } from './tunedForm';

/** An action's params, or a thunk read each time the action asks for them. */
export type ActionParams<P = Record<string, unknown>> = Partial<P> | (() => Partial<P>);

/** A binding added for an action: a gesture alone, or a gesture with the
 *  options it passes — the {@link BoundGesture} shape, its params typed. */
export type TunedBinding<P = Record<string, unknown>> =
  | GestureSpec
  | { spec: GestureSpec; opts?: Omit<BindingOptions, 'params'> & { params?: ActionParams<P> } };

/** What a host changes about one action. */
export interface ActionTuning<P = Record<string, unknown>> {
  /** Params every invocation starts from. What a binding or a `trigger` call
   *  passes is laid over them, so these fill in what it leaves out. A thunk is
   *  read on every call, and an ongoing action resolving its `opts.params`
   *  mid-gesture sees the value as it is then. */
  params?: ActionParams<P>;
  /** Its params lie under every other tuning's, the last-operation panel's included: the values an action reads
   *  where nothing more particular sets one, as a tool's options give their defaults. */
  under?: boolean;
  /** Bindings added after the action's own `defaultBinding`. */
  bindings?: readonly TunedBinding<P>[];
  /** Keys for some of the action's `modifierRoles`, by role id. A binding's
   *  own `opts.roles` is laid over these. */
  roles?: RoleRebinds;
  /** Told the params the last-operation panel just set for the action, which hold for the rest of the session.
   *  A tuning whose `params` thunk reads a host's store writes the ones it supplies back there, so the store, and
   *  whatever draws it, says what the next run will use rather than overriding it. An action with such a tuning
   *  keeps no session params of its own. */
  keep?(params: Readonly<Record<string, unknown>>): void;
  /** The params this tuning supplies, as a form the last-operation panel draws beside the action's own `params`
   *  (an action's leaf of the same key wins), so a run's tuned values can be changed after it as its own can. A
   *  function answers it for one run from the params that run resolved, or `null` when this tuning set none of
   *  them, as a tool's options answer only while their tool is the live one. An action given a form this way is
   *  kept as the last operation as one declaring `params` is. */
  form?: Action['params'];
}

type Params = BindingOptions['params'];

/** Each wrapped invoker's inner one, and the params a tuning wrapped it with: none for a wrapper that adds none. */
const WRAPS = new WeakMap<Invoker, { inner: Invoker; params?: ActionParams }>();

/** Record that `outer` runs `inner` and adds no params, so {@link invokedParams} reads through it to the tunings
 *  `inner` carries. */
export function runsInvoker(outer: Invoker, inner: Invoker): Invoker {
  WRAPS.set(outer, { inner });
  return outer;
}

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
        ...invoker,
        start: (ctx, opts) => invoker.start(
          ctx.params ? { ...ctx, params: base(ctx.params) } : ctx,
          { ...opts, params: layered(params, opts?.params) },
        ),
      };
  WRAPS.set(wrapped, { inner: invoker, params });
  return wrapped;
}

/** The params `action`'s invoker runs with when a binding passes `given`: each tuning wrapped around it, a later
 *  one's over an earlier one's, and `given` over them all, as the wrapped `run` and `start` layer them. */
export function invokedParams(action: Pick<Action, 'invoker'>, given?: Record<string, unknown>): Record<string, unknown> {
  const tunings: ActionTuning[] = [];
  for (let w = action.invoker, rec = w && WRAPS.get(w); rec; w = rec.inner, rec = WRAPS.get(w)) {
    if (rec.params) tunings.unshift({ params: rec.params });
  }
  return tunedParams(tunings, given);
}

function withBindings(
  own: Action['defaultBinding'],
  added: readonly TunedBinding[],
): BoundGesture[] {
  const base: BoundGesture[] = own === undefined ? [] : Array.isArray(own) ? own : [own];
  return [...base, ...(added as readonly BoundGesture[]).filter((b) => !base.includes(b))];
}

const FN_WRAPS = new WeakMap<object, { inner: unknown; params: ActionParams }>();

/** `fn` handed the tuning's params under the ones it is called with, in argument `at`, as `run` is. Wrapping a
 *  function already wrapped with these params returns it as it is. */
function wrapParams<F extends (...args: never[]) => unknown>(fn: F | undefined, params: ActionParams, at: number): F | undefined {
  if (typeof fn !== 'function') return fn;
  for (let w: unknown = fn; typeof w === 'function'; w = FN_WRAPS.get(w)?.inner) {
    if (FN_WRAPS.get(w)?.params === params) return fn;
  }
  const wrapped = ((...args: unknown[]) => {
    const given = [...args];
    given[at] = tunedParams([{ params }], given[at] as Record<string, unknown> | undefined);
    return (fn as unknown as (...a: unknown[]) => unknown)(...given);
  }) as unknown as F;
  FN_WRAPS.set(wrapped, { inner: fn, params });
  return wrapped;
}

function tuneOnce(action: Action, tuning: ActionTuning): Action {
  const invoker = tuning.params && action.invoker ? wrapInvoker(action.invoker, tuning.params) : action.invoker;
  const p = tuning.params;
  const cursor = p && typeof action.cursor === 'function' ? wrapParams(action.cursor, p, 0) : action.cursor;
  const preview = p ? wrapParams(action.preview, p, 1) : action.preview;
  const enabled = p ? wrapParams(action.enabled, p, 3) : action.enabled;
  const active = p ? wrapParams(action.active, p, 1) : action.active;
  const bindings = tuning.bindings?.length ? withBindings(action.defaultBinding, tuning.bindings) : null;
  const modifierRoles = tuning.roles && action.modifierRoles ? rebindRoles(action.modifierRoles, tuning.roles) : null;
  const form = tuning.form ? formWith(action.params, tuning.form) : action.params;
  if (
    invoker === action.invoker && cursor === action.cursor && preview === action.preview &&
    enabled === action.enabled && active === action.active && bindings === null && modifierRoles === null &&
    form === action.params
  ) {
    return action;
  }
  return {
    ...action,
    ...(modifierRoles ? { modifierRoles } : {}),
    ...(invoker ? { invoker } : {}),
    ...(cursor ? { cursor } : {}),
    ...(preview ? { preview } : {}),
    ...(enabled ? { enabled } : {}),
    ...(active ? { active } : {}),
    ...(bindings ? { defaultBinding: bindings } : {}),
    ...(form ? { params: form } : {}),
  };
}

/** `tunings` in the order they apply, those marked `under` first: a later tuning's params are laid over an earlier
 *  one's. */
export function underFirst(tunings: readonly ActionTuning[]): ActionTuning[] {
  return [...tunings.filter((t) => t.under), ...tunings.filter((t) => !t.under)];
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
