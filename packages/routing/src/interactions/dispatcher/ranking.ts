/**
 * How the dispatcher orders one input's candidates: the view a binding names,
 * its scope tier, its specificity, then whether its action is gated by a rule
 * that holds. Dispatch, prediction, and the trace record all rank through here.
 */
import type { GestureSpec } from '@weasel-js/gestures';
import type { Action } from '../actions/action';
import type { GestureBinding } from '../actions/binding';
import { describeRule, evaluate, type Condition, type Rule, type RuleCtx } from '../../eligibility';
import type { DispatcherContext, KeyReach } from './dispatcherApi';
import type { PlacedBy, SpecificityPart, WalkStep } from './dispatchRecord';
import { specificity, type MatchResult } from './matcher';

/** Whether `binding` is live for input routed to `view`. */
export function liveInView(binding: GestureBinding, view: string | null): boolean {
  const views = binding.opts?.views;
  return views === undefined || views.includes(view);
}

/** Whether `binding` is live for a key that reached `reach`. See
 *  `BindingOpts.over`. */
export function liveForKeys(binding: GestureBinding, reach: KeyReach | undefined): boolean {
  if (reach === undefined) return true;
  return binding.opts?.over ? reach.over : reach.held;
}

/** Stable partition: matches whose binding names `view` first. See
 *  `BindingOpts.views` for why naming the view outranks the scope tier. */
export function namesView(binding: GestureBinding, view: string | null): boolean {
  return binding.opts?.views?.includes(view) ?? false;
}

export function preferViewScoped<M extends { binding: GestureBinding }>(
  matches: readonly M[],
  view: string | null,
): M[] {
  const named: M[] = [];
  const rest: M[] = [];
  for (const m of matches) {
    (namesView(m.binding, view) ? named : rest).push(m);
  }
  return named.length === 0 ? [...matches] : [...named, ...rest];
}

/** The routed view's rule context, carrying the view id. */
export function ruleCtxOf(ctx: DispatcherContext): RuleCtx | undefined {
  const r = ctx.getRuleCtx?.();
  return r ? { ...r, viewId: ctx.viewId ?? null } : undefined;
}

/**
 * Normalize an `Action.eligible` value to a raw `Rule`. Conditions are
 * callable functions carrying `.rule`; raw Rules are returned as-is.
 */
function eligibleToRule(eligible: Rule | Condition): Rule {
  return typeof eligible === 'function' ? (eligible as Condition).rule : eligible;
}

/** Does `action`'s declared eligibility rule pass against `ruleCtx`?
 *  An action with no `eligible` rule is always eligible. */
export function isEligible(action: Action, ruleCtx: RuleCtx): boolean {
  if (!action.eligible) return true;
  return evaluate(eligibleToRule(action.eligible), ruleCtx);
}

/** Render an `eligible` rule for display. `evaluate()` returns a bare
 *  boolean, so there is no reason string to carry — the rule itself is the
 *  most informative thing available. */
export function describeEligible(eligible: NonNullable<Action['eligible']>): string {
  return describeRule(eligibleToRule(eligible));
}

/**
 * Filter `matches` to only those whose backing action has no `eligible`
 * rule, or whose rule evaluates true against `ruleCtx`. Exported for
 * unit testing.
 *
 * @internal
 */
export function filterEligible<M extends { binding: { actionId: string } }>(
  matches: readonly M[],
  actionLookup: (id: string) => Action | undefined,
  ruleCtx: RuleCtx,
): M[] {
  return matches.filter((m) => {
    const action = actionLookup(m.binding.actionId);
    if (!action) return true;
    return isEligible(action, ruleCtx);
  });
}

/**
 * Among matches tied on scope and specificity, put those whose action is
 * gated by an `eligible` rule that holds now ahead of those with no rule: a
 * binding that applies only in the current context — Escape while editing a
 * path — outranks one that applies everywhere. Otherwise stable.
 *
 * @internal
 */
export function preferContextual<M extends { binding: GestureBinding; scope: string }>(
  matches: readonly M[],
  actionLookup: (id: string) => Action | undefined,
  /** Whether a gated action's rule holds; skip re-asking where the matches
   *  were already filtered by it. */
  holds: (action: Action) => boolean,
  /** The routed view: a binding naming it is never tied with one that does not. */
  view: string | null,
): M[] {
  const out: M[] = [];
  let run: M[] = [];
  const flush = (): void => {
    const gated = run.filter((m) => {
      const action = actionLookup(m.binding.actionId);
      return action?.eligible !== undefined && holds(action);
    });
    out.push(...gated, ...run.filter((m) => !gated.includes(m)));
    run = [];
  };
  for (const m of matches) {
    const head = run[0];
    if (
      head
      && (head.scope !== m.scope
        || namesView(head.binding, view) !== namesView(m.binding, view)
        || !sameSpecificity(head.binding.spec, m.binding.spec))
    ) flush();
    run.push(m);
  }
  flush();
  return out;
}

const SPECIFICITY_PARTS: readonly SpecificityPart[] = ['target', 'mods', 'phase', 'exact'];

/** The ranking step that put `cur` directly below `prev`. `contextual` says
 *  `prev` is gated by a rule that holds and `cur` is not — the only thing the
 *  step after specificity looks at. */
export function placedBy(
  prev: MatchResult,
  cur: MatchResult,
  view: string | null,
  contextual: boolean,
): PlacedBy {
  if (namesView(prev.binding, view) !== namesView(cur.binding, view)) return { step: 'view' };
  if (prev.scope !== cur.scope) return { step: 'tier' };
  const sp = specificity(prev.binding.spec);
  const sc = specificity(cur.binding.spec);
  const i = sp.findIndex((v, k) => v !== sc[k]);
  if (i >= 0) return { step: 'specificity', part: SPECIFICITY_PARTS[i]! };
  return contextual ? { step: 'context' } : { step: 'order' };
}

function sameSpecificity(a: GestureSpec, b: GestureSpec): boolean {
  const sa = specificity(a);
  const sb = specificity(b);
  return sa.every((v, i) => v === sb[i]);
}

/** One input's candidates, matched, filtered and ranked, before any is asked. */
export interface Ranking {
  /** Every match the claim admitted, best first — ineligible ones
   *  included, in the place they would hold. */
  ordered: MatchResult[];
  /** Matches an exclusive claim barred; collected only when recording. */
  barred: MatchResult[];
  claimOwner?: string;
  actionMap: Map<string, Action>;
  ruleCtx: RuleCtx | undefined;
  /** Whether a match survives the eligibility filter. */
  eligible(m: MatchResult): boolean;
}

export interface Walked {
  /** Survivors of both filters, best first, each with what the walk did. */
  steps: Array<{ match: MatchResult; step: WalkStep }>;
  /** Why the walk ended: a candidate fired (or would), one was misbound, or
   *  every candidate was exhausted. */
  stop: 'fired' | 'misbound' | 'exhausted';
  winner: { match: MatchResult; action: Action } | null;
}
