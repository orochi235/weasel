/**
 * Prediction without invocation: what an input would do, asked of the same
 * ranking and walk a real dispatch takes. `engaged` is the ids of the entries
 * that own a gesture in flight.
 */
import { buildDispatchRecord } from './buildDispatchRecord';
import type { DispatcherContext, ResolveAllOptions, ResolveOnlyResult, ResolvedCandidate } from './dispatcherApi';
import type { DispatchRecord } from './dispatchRecord';
import type { InputEvent } from './matcher';
import { rank, verdictsOf, walk } from './walk';

export function resolveAll(
  event: InputEvent,
  ctx: DispatcherContext,
  engaged: ReadonlySet<string>,
  opts?: ResolveAllOptions,
): ResolvedCandidate[] {
  const evaluateShadowed = opts?.evaluateShadowed ?? false;
  const r = rank(event, ctx, engaged, false);
  if (r.ordered.length === 0) return [];
  return verdictsOf(r, walk(r, event, ctx, null, evaluateShadowed), evaluateShadowed);
}

export function resolveOnly(
  event: InputEvent,
  ctx: DispatcherContext,
  engaged: ReadonlySet<string>,
): ResolveOnlyResult | null {
  const r = rank(event, ctx, engaged, false);
  const { winner } = walk(r, event, ctx, null, false);
  if (!winner) return null;
  return {
    actionId: winner.action.id,
    action: winner.action,
    scope: winner.match.scope,
    ownerId: winner.match.ownerId,
  };
}

export function explain(
  event: InputEvent,
  ctx: DispatcherContext,
  engaged: ReadonlySet<string>,
  opts?: ResolveAllOptions,
): DispatchRecord {
  const r = rank(event, ctx, engaged, true);
  const walked = walk(r, event, ctx, null, opts?.evaluateShadowed ?? false);
  return buildDispatchRecord(r, walked, event, ctx, true, walked.winner ? 'handled' : 'unhandled');
}
