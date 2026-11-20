/**
 * Prediction without invocation: what an input would do, asked of the same
 * ranking, keymap routing and walk a real dispatch takes. `engaged` is the ids
 * of the entries that own a gesture in flight, and `busy` whether any gesture is.
 */
import { bindingOptionsOf, type GestureBinding } from '../actions/binding';
import { resolveParams } from '../actions/invoker';
import { buildDispatchRecord } from './buildDispatchRecord';
import type { DispatcherContext, ResolveAllOptions, ResolveOnlyResult, ResolvedCandidate } from './dispatcherApi';
import type { DispatchRecord } from './dispatchRecord';
import type { InputEvent } from './matcher';
import { routeThroughKeymap } from './keymapRoute';
import { rank, verdictsOf, walk } from './walk';

/** Whether a binding of the innermost open keymap matches `event`. */
export function bindsInKeymap(event: InputEvent, ctx: DispatcherContext, engaged: ReadonlySet<string>): boolean {
  return rank(event, { ...ctx, keymapPass: 'only' }, engaged, false).ordered.length > 0;
}

/** The context a dispatch of `event` walks, with an open keymap's pass applied, and whether its winner would run. */
function routed(
  event: InputEvent, ctx: DispatcherContext, engaged: ReadonlySet<string>, busy: boolean,
): { ctx: DispatcherContext; fires: boolean; outcome: 'handled' | 'unhandled' } {
  let last: DispatcherContext | null = null;
  let fired = false;
  const outcome = routeThroughKeymap(event, ctx, {
    run: (pass, ev) => {
      last = { ...ctx, keymapPass: pass };
      fired = walk(rank(ev, last, engaged, false), ev, last, null, false).winner !== null;
      return fired ? 'handled' : 'unhandled';
    },
    binds: (ev) => bindsInKeymap(ev, ctx, engaged),
    engaged: () => busy,
    quiet: true,
  });
  if (outcome === undefined) return { ctx, fires: true, outcome: 'handled' };
  return { ctx: last ?? { ...ctx, keymapPass: 'only' }, fires: outcome === 'handled' && fired, outcome };
}

export function resolveAll(
  event: InputEvent,
  ctx: DispatcherContext,
  engaged: ReadonlySet<string>,
  busy: boolean,
  opts?: ResolveAllOptions,
): ResolvedCandidate[] {
  const evaluateShadowed = opts?.evaluateShadowed ?? false;
  const route = routed(event, ctx, engaged, busy);
  if (!route.fires) return [];
  const r = rank(event, route.ctx, engaged, false);
  if (r.ordered.length === 0) return [];
  return verdictsOf(r, walk(r, event, route.ctx, null, evaluateShadowed), evaluateShadowed);
}

export function resolveOnly(
  event: InputEvent,
  ctx: DispatcherContext,
  engaged: ReadonlySet<string>,
  busy: boolean,
): ResolveOnlyResult | null {
  const route = routed(event, ctx, engaged, busy);
  if (!route.fires) return null;
  const { winner } = walk(rank(event, route.ctx, engaged, false), event, route.ctx, null, false);
  if (!winner) return null;
  return {
    actionId: winner.action.id,
    action: winner.action,
    scope: winner.match.scope,
    ownerId: winner.match.ownerId,
    ...paramsOf(winner.match.binding),
  };
}

function paramsOf(binding: GestureBinding): { params?: Record<string, unknown> } {
  const params = resolveParams(bindingOptionsOf(binding)?.params);
  return params ? { params } : {};
}

export function explain(
  event: InputEvent,
  ctx: DispatcherContext,
  engaged: ReadonlySet<string>,
  busy: boolean,
  opts?: ResolveAllOptions,
): DispatchRecord {
  const route = routed(event, ctx, engaged, busy);
  const r = rank(event, route.ctx, engaged, true);
  const walked = walk(r, event, route.ctx, null, opts?.evaluateShadowed ?? false);
  const outcome = route.fires ? (walked.winner ? 'handled' : 'unhandled') : route.outcome;
  return buildDispatchRecord(r, walked, event, route.ctx, true, outcome);
}
