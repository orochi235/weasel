/**
 * Evaluation of `Action.enabled` and `Action.active` under the contract their
 * JSDoc states: a throw reads as disabled or off, with a dev warning, at the
 * dispatcher's gate and everywhere else; the palette's reads are also held to
 * 4ms in dev.
 */
import type { ActionDeps } from './invoker';
import { ActionDisabledReason, type Action, type ActionUnavailable } from './action';
import { isDev } from '@weasel-js/react';

/**
 * Result of evaluating an Action's `enabled` predicate.
 */
export interface ActionEnabledResult {
  enabled: boolean;
  reason?: ActionUnavailable;
}

const enabledSlowWarned = new Set<string>();
/** The action ids warned of, by the predicate that threw. */
const threwWarned = { enabled: new Set<string>(), active: new Set<string>() };
const ENABLED_BUDGET_MS = 4;

/** In dev, warns once per action that its `enabled` or `active` predicate threw, and what it then reads as. */
function warnThrew(which: 'enabled' | 'active', action: Action, e: unknown, readsAs: string): void {
  const warned = threwWarned[which];
  if (!isDev() || warned.has(action.id)) return;
  warned.add(action.id);
  console.warn(
    `weasel actions: ${which}() for action "${action.id}" threw; treating as ${readsAs}. ` +
    `The predicate must not throw — see Action.${which} JSDoc.`,
    e,
  );
}

/**
 * `ask()`, the call of `action.enabled` a caller makes with its own arguments, or the disabled reason a
 * throw reads as, warned of once per action in dev. The dispatcher's gate and {@link evaluateEnabled} both
 * read the predicate through this.
 */
export function gateEnabled(action: Action, ask: () => true | ActionUnavailable): true | ActionUnavailable {
  try {
    return ask();
  } catch (e) {
    warnThrew('enabled', action, e, 'disabled');
    return ActionDisabledReason.PredicateThrew;
  }
}

/**
 * Safely evaluate an action's `enabled` predicate for the entry `params`
 * names. Returns `{enabled: true}` when no predicate is supplied. Catches
 * throws and treats them as disabled with reason `'(predicate threw)'`. In
 * dev mode, warns once per action id when a single call exceeds 4ms (single
 * frame at 240fps — generous; real predicates should be sub-millisecond).
 */
export function evaluateEnabled(
  action: Action,
  deps?: ActionDeps,
  at?: { x: number; y: number },
  params?: Readonly<Record<string, unknown>>,
): ActionEnabledResult {
  if (!action.enabled) return { enabled: true };
  const dev = isDev();
  const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? () => performance.now()
    : () => Date.now();
  const start = dev ? now() : 0;
  const { enabled } = action;
  const result = gateEnabled(action, () => enabled(deps, at, undefined, params));
  if (dev) {
    const elapsed = now() - start;
    if (elapsed > ENABLED_BUDGET_MS && !enabledSlowWarned.has(action.id)) {
      enabledSlowWarned.add(action.id);
      console.warn(
        `weasel actions: enabled() for action "${action.id}" took ${elapsed.toFixed(2)}ms ` +
        `(budget ${ENABLED_BUDGET_MS}ms). The predicate must be pure and fast — see Action.enabled JSDoc.`,
      );
    }
  }
  if (result === true) return { enabled: true };
  return { enabled: false, reason: result };
}

/**
 * Safely evaluate an action's `active` predicate, for the entry `params`
 * names. `undefined` for an action with no pressed state; a predicate that
 * throws reads as not active, with the dev warning `enabled` gets.
 */
export function evaluateActive(
  action: Action,
  deps?: ActionDeps,
  params?: Readonly<Record<string, unknown>>,
): boolean | undefined {
  if (!action.active) return undefined;
  try {
    return action.active(deps, params) === true;
  } catch (e) {
    warnThrew('active', action, e, 'not active');
    return false;
  }
}
