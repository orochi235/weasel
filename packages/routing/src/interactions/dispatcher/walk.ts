/**
 * The walk: one computation behind dispatch, prediction, and the record.
 * `rank` orders an input's candidates; `walk` asks each in turn, and either
 * runs the first that passes or names it as the predicted winner.
 */
import type { Action, ActionSource } from '../actions/action';
import { actionBindings, type GestureBinding } from '../actions/binding';
import { NO_OVERRIDES } from '../actions/bindingOverrides';
import { buildDepsFromRequires } from '../actions/buildDeps';
import type { ActionDeps } from '../actions/invoker';
import { assembleEntries, scopeBindings } from '../../contributions/assemble';
import type { DispatcherContext, ResolvedCandidate } from './dispatcherApi';
import type { WalkStep } from './dispatchRecord';
import { carriedBy, worldPointOf } from './inputFacts';
import type { BindingScope, InputEvent, MatchResult, ScopedBinding } from './matcher';
import { matchSortedWithBarred, specificity } from './matcher';
import {
  describeEligible, isEligible, liveForKeys, liveInView, preferContextual, preferViewScoped, ruleCtxOf,
  type Ranking, type Walked,
} from './ranking';

/** What running a candidate came to: `'fired'` ends the walk, `'empty-handle'`
 *  falls through to the next candidate, `'misbound'` ends it unhandled. */
export type AttemptResult = 'fired' | 'empty-handle' | 'misbound';
export type Attempt = (match: MatchResult, action: Action, deps: ActionDeps) => AttemptResult;

/** Every registered entry's bindings, tiered by what the entry declares about
 *  its own eligibility, then the actions registry's. */
function assembleScopedBindings(ctx: DispatcherContext): ScopedBinding[] {
  // `allowedCapabilities` is absent for a consumer with no mode system, who
  // supplies no `getRuleCtx`, and then every entry is permitted.
  const allowedCapabilities = ctx.getRuleCtx?.()?.allowedCapabilities;
  const openKeymap = ctx.keymapPass === 'none' ? null : ctx.keymaps?.innermost()?.id ?? null;
  const { ordered, state } = assembleEntries(ctx.entriesById.values(), {
    focusedId: ctx.activeToolId,
    hotkeyStack: ctx.hotkeyStack,
    ...(allowedCapabilities ? { allowedCapabilities } : {}),
    ...(openKeymap ? { openKeymap } : {}),
  });
  const view = ctx.viewId ?? null;
  const live = (b: GestureBinding): boolean => liveInView(b, view) && liveForKeys(b, ctx.keyReach);
  const overrides = ctx.bindingOverrides?.() ?? NO_OVERRIDES;
  const result: ScopedBinding[] = scopeBindings(ordered, state, overrides)
    .filter((sb) => live(sb.binding));
  if (ctx.keymapPass === 'only') return result.filter((sb) => sb.ownerId === openKeymap);

  // Actions have no owning tool — `'&'`-channel phase atoms on their
  // bindings won't match.
  for (const action of ctx.actions.list()) {
    const targetScope: BindingScope = action.scope === 'hotkey' ? 'hotkey' : 'ambient';
    // The registry has already laid binding overrides over an action's own.
    for (const binding of actionBindings(action)) {
      if (live(binding)) result.push({ binding, scope: targetScope, ownerId: null });
    }
  }

  return result;
}

/** Whether any live binding's spec passes `test`. Asks no `enabled`, and needs
 *  no event, so nothing is hit-tested to answer it. */
export function anyBinding(ctx: DispatcherContext, test: (spec: GestureBinding['spec']) => boolean): boolean {
  return assembleScopedBindings(ctx).some((sb) => test(sb.binding.spec));
}

function buildActionMap(registry: ActionSource): Map<string, Action> {
  const map = new Map<string, Action>();
  for (const action of registry.list()) {
    map.set(action.id, action);
  }
  return map;
}

/**
 * Match, filter, and order `event`'s candidates. `engaged` is the ids of the
 * entries that own a gesture in flight, which the matcher's phase atoms read.
 */
export function rank(
  event: InputEvent,
  ctx: DispatcherContext,
  engaged: ReadonlySet<string>,
  collectBarred: boolean,
): Ranking {
  const view = ctx.viewId ?? null;
  const outcome = matchSortedWithBarred(
    event, assembleScopedBindings(ctx), ctx.isMac, engaged, { collectBarred },
  );
  const sorted = preferViewScoped(outcome.matches, view);
  const actionMap = buildActionMap(ctx.actions);
  const ruleCtx = ruleCtxOf(ctx);
  // Asked from the ranking, the filter and the record; a rule runs once per input.
  const held = new Map<Action, boolean>();
  const holds = (a: Action): boolean => {
    if (ruleCtx === undefined) return true;
    let h = held.get(a);
    if (h === undefined) held.set(a, h = isEligible(a, ruleCtx));
    return h;
  };
  // Ranking the ineligible alongside the rest leaves the survivors in the
  // order ranking them alone would: `preferContextual` only reorders within
  // a run of ties, and every tie's members sit together.
  const ordered = ruleCtx
    ? preferContextual(sorted, (id) => actionMap.get(id), holds, view)
    : sorted;
  return {
    ordered,
    barred: outcome.barred,
    ...(outcome.claimOwner !== undefined ? { claimOwner: outcome.claimOwner } : {}),
    actionMap,
    ruleCtx,
    eligible: (m) => {
      const a = actionMap.get(m.binding.actionId);
      return a === undefined || holds(a);
    },
  };
}

/**
 * Walk the ranked survivors, asking each action's `enabled()` in turn. With
 * `attempt`, the first that passes is run and the walk ends unless it bails;
 * without, it is the predicted winner. Each action is asked at most once.
 */
export function walk(
  r: Ranking,
  event: InputEvent,
  ctx: DispatcherContext,
  attempt: Attempt | null,
  evaluateShadowed: boolean,
): Walked {
  const steps: Walked['steps'] = [];
  const tried = new Set<string>();
  let stop: Walked['stop'] = 'exhausted';
  let winner: Walked['winner'] = null;
  for (const match of r.ordered) {
    if (!r.eligible(match)) continue;
    const push = (step: WalkStep): void => { steps.push({ match, step }); };
    const actionId = match.binding.actionId;
    if (tried.has(actionId)) { push({ kind: 'duplicate' }); continue; }
    if (stop !== 'exhausted' && !evaluateShadowed) { push({ kind: 'not-asked' }); continue; }
    tried.add(actionId);
    const action = r.actionMap.get(actionId);
    if (!action) {
      if (attempt) {
        console.warn(
          `weasel dispatcher: binding resolved actionId "${actionId}" which has `
          + `no registered action. Skipping. (misconfiguration)`,
        );
      }
      push({ kind: 'no-such-action' });
      continue;
    }
    // Deps are built before the gate so predicates can read them; the
    // winner's invoke reuses the same bag. Shared with
    // `ActionsRegistry.trigger`, including the dev undeclared-read guard.
    const deps = buildDepsFromRequires(action, ctx.depRegistry);
    const enabled = action.enabled ? action.enabled(deps, worldPointOf(event), carriedBy(event)) : true;
    if (enabled !== true) { push({ kind: 'declined', reason: String(enabled) }); continue; }
    if (stop !== 'exhausted') { push({ kind: 'outranked' }); continue; }
    if (!attempt) {
      push({ kind: 'would-fire' });
      stop = 'fired';
      winner = { match, action };
      continue;
    }
    const result = attempt(match, action, deps);
    if (result === 'empty-handle') { push({ kind: 'empty-handle' }); continue; }
    push({ kind: result === 'fired' ? 'fired' : 'misbound' });
    stop = result;
    winner = { match, action };
  }
  return { steps, stop, winner };
}

/** Every ranked candidate of a predicting walk, with why it would or would not fire. */
export function verdictsOf(r: Ranking, walked: Walked, evaluateShadowed: boolean): ResolvedCandidate[] {
  const stepOf = new Map(walked.steps.map((s) => [s.match, s.step]));
  // Verdict per action id, so a second binding for an action already judged
  // higher up inherits that verdict — the walk asks each action once.
  const verdictByAction = new Map<string, ResolvedCandidate['verdict']>();
  let fired = false;
  const out: ResolvedCandidate[] = [];
  for (const match of r.ordered) {
    const actionId = match.binding.actionId;
    const action = r.actionMap.get(actionId);
    // A binding pointing at an unregistered action can never fire.
    if (!action) continue;

    let verdict = verdictByAction.get(actionId);
    if (verdict === undefined) {
      if (!r.eligible(match)) {
        verdict = fired && !evaluateShadowed
          ? { kind: 'shadowed' }
          : { kind: 'ineligible', reason: describeEligible(action.eligible!) };
      } else {
        const step = stepOf.get(match);
        if (step?.kind === 'would-fire') {
          verdict = { kind: 'would-fire' };
          fired = true;
        } else if (step?.kind === 'declined') {
          verdict = { kind: 'disabled', reason: step.reason };
        } else {
          verdict = { kind: 'shadowed' };
        }
      }
      verdictByAction.set(actionId, verdict);
    } else if (verdict.kind === 'would-fire') {
      // The action already won on an earlier binding; this one never runs.
      verdict = { kind: 'shadowed' };
    }

    out.push({
      actionId,
      action,
      binding: match.binding,
      scope: match.scope,
      ownerId: match.ownerId,
      specificity: specificity(match.binding.spec),
      verdict,
    });
  }
  return out;
}
