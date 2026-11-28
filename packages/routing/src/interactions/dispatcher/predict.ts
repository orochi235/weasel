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
import type { Ranking, Walked } from './ranking';
import { rank, verdictsOf, walk } from './walk';

/** Whether a binding of the innermost open keymap matches `event`. */
export function bindsInKeymap(event: InputEvent, ctx: DispatcherContext, engaged: ReadonlySet<string>): boolean {
  return rank(event, { ...ctx, keymapPass: 'only' }, engaged, false).ordered.length > 0;
}

/** One walk of a keymap pass, or of the whole input when no keymap is open. */
interface Pass {
  ctx: DispatcherContext;
  r: Ranking;
  walked: Walked;
}

/** How a dispatch of `event` would route: the pass whose candidates it reaches, `null` when the keymap settled it
 *  without walking any or withheld it from those walked; the last pass walked; and the outcome it would report. */
interface Route {
  pass: Pass | null;
  last: Pass | null;
  outcome: 'handled' | 'unhandled';
}

/**
 * Route `event` as a dispatch would, through an open keymap's passes, walking each pass once as the dispatch does,
 * so no gate is asked more often than it would be. `collectBarred` and `evaluateShadowed` are the record's and
 * `resolveAll`'s.
 */
function routed(
  event: InputEvent, ctx: DispatcherContext, engaged: ReadonlySet<string>, busy: boolean,
  collectBarred: boolean, evaluateShadowed: boolean,
): Route {
  const walkPass = (passCtx: DispatcherContext): Pass => {
    const r = rank(event, passCtx, engaged, collectBarred);
    return { ctx: passCtx, r, walked: walk(r, event, passCtx, null, evaluateShadowed) };
  };
  let last: Pass | null = null;
  const outcome = routeThroughKeymap(event, ctx, {
    run: (pass) => {
      last = walkPass({ ...ctx, keymapPass: pass });
      return last.walked.winner ? 'handled' : 'unhandled';
    },
    binds: (ev) => bindsInKeymap(ev, ctx, engaged),
    engaged: () => busy,
    quiet: true,
  });
  if (outcome === undefined) {
    const pass = walkPass(ctx);
    return { pass, last: pass, outcome: pass.walked.winner ? 'handled' : 'unhandled' };
  }
  const pass = last as Pass | null;
  // The input reaches the candidates of the pass it ended on only when that pass's verdict is the outcome: a
  // keymap that swallows a key, keeps a press for a click, or closes on Escape withholds it.
  const reached = pass !== null && outcome === (pass.walked.winner ? 'handled' : 'unhandled')
    && (outcome === 'handled' || pass.ctx.keymapPass === 'none');
  return { pass: reached ? pass : null, last: pass, outcome };
}

export function resolveAll(
  event: InputEvent,
  ctx: DispatcherContext,
  engaged: ReadonlySet<string>,
  busy: boolean,
  opts?: ResolveAllOptions,
): ResolvedCandidate[] {
  const evaluateShadowed = opts?.evaluateShadowed ?? false;
  const { pass } = routed(event, ctx, engaged, busy, false, evaluateShadowed);
  return pass ? verdictsOf(pass.r, pass.walked, evaluateShadowed) : [];
}

export function resolveOnly(
  event: InputEvent,
  ctx: DispatcherContext,
  engaged: ReadonlySet<string>,
  busy: boolean,
): ResolveOnlyResult | null {
  const winner = routed(event, ctx, engaged, busy, false, false).pass?.walked.winner;
  if (!winner) return null;
  return {
    actionId: winner.action.id,
    action: winner.action,
    binding: winner.match.binding,
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
  const { last, outcome } = routed(event, ctx, engaged, busy, true, opts?.evaluateShadowed ?? false);
  if (last) return buildDispatchRecord(last.r, last.walked, event, last.ctx, true, outcome);
  // The keymap settled it without walking any binding (Escape closing it, a taken keystroke): none is shown firing.
  const only = { ...ctx, keymapPass: 'only' as const };
  const none: Walked = { steps: [], stop: 'exhausted', winner: null };
  return buildDispatchRecord(rank(event, only, engaged, true), none, event, only, true, outcome);
}
