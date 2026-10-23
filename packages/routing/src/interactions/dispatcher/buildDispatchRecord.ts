import { routesForSpec } from '../../tools/routing/reflection/registry';
import type { DispatcherContext } from './dispatcherApi';
import type { DispatchRecord, DroppedCandidate, RankedCandidate, RecordCandidate } from './dispatchRecord';
import { modifierStateOf, worldPointOf } from './inputFacts';
import { specificity, type InputEvent, type MatchResult } from './matcher';
import { describeEligible, namesView, placedBy, type Ranking, type Walked } from './ranking';

/** Project a ranking and its walk into a plain {@link DispatchRecord}. */
export function buildDispatchRecord(
  r: Ranking,
  walked: Walked,
  event: InputEvent,
  ctx: DispatcherContext,
  predicted: boolean,
  outcome: 'handled' | 'unhandled',
): DispatchRecord {
  const view = ctx.viewId ?? null;
  const candidates = new Map<MatchResult, RecordCandidate>();
  const candidateOf = (m: MatchResult): RecordCandidate => {
    let c = candidates.get(m);
    if (!c) {
      const eligible = r.actionMap.get(m.binding.actionId)?.eligible;
      c = {
        actionId: m.binding.actionId,
        routes: routesForSpec(m.binding.spec),
        scope: m.scope,
        ownerId: m.ownerId,
        namesView: namesView(m.binding, view),
        specificity: specificity(m.binding.spec),
        ...(eligible !== undefined ? { eligible: describeEligible(eligible) } : {}),
      };
      candidates.set(m, c);
    }
    return c;
  };
  const dropped: DroppedCandidate[] = [
    ...r.barred.map((m): DroppedCandidate => ({
      candidate: candidateOf(m),
      filter: 'claim',
      ...(r.claimOwner !== undefined ? { owner: r.claimOwner } : {}),
    })),
  ];
  for (const m of r.ordered) {
    if (r.eligible(m)) continue;
    const c = candidateOf(m);
    dropped.push({ candidate: c, filter: 'ineligible', rule: c.eligible ?? '' });
  }
  const gated = (m: MatchResult): boolean =>
    r.actionMap.get(m.binding.actionId)?.eligible !== undefined;
  const ranked: RankedCandidate[] = walked.steps.map(({ match, step }, i) => {
    const prev = walked.steps[i - 1]?.match;
    return {
      candidate: candidateOf(match),
      placedBy: prev ? placedBy(prev, match, view, r.ruleCtx !== undefined && gated(prev) && !gated(match)) : { step: 'first' },
      walk: step,
    };
  });
  const eventKey = event.kind === 'key' || event.kind === 'key-held' ? event.key : undefined;
  const world = worldPointOf(event);
  return {
    kind: 'dispatch',
    ts: Date.now(),
    input: {
      eventKind: event.kind,
      ...(eventKey !== undefined ? { key: eventKey } : {}),
      modifiers: modifierStateOf(event),
      viewId: view,
      ...(world !== undefined ? { world } : {}),
      ...(r.ruleCtx !== undefined ? { mode: r.ruleCtx.mode } : {}),
    },
    matched: [...r.ordered, ...r.barred].map(candidateOf),
    dropped,
    ranked,
    predicted,
    fired: walked.winner?.action.id ?? null,
    outcome,
  };
}
