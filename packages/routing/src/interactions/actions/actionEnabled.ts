/**
 * Palette-side evaluation of `Action.enabled`. The dispatcher calls the
 * predicate raw as a gate; this is the surface that also enforces the
 * contract the predicate's JSDoc states — no throwing, under 4ms in dev.
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
const enabledThrewWarned = new Set<string>();
const ENABLED_BUDGET_MS = 4;
/**
 * Safely evaluate an action's `enabled` predicate. Returns `{enabled: true}`
 * when no predicate is supplied. Catches throws and treats them as disabled
 * with reason `'(predicate threw)'`. In dev mode, warns once per action id
 * when a single call exceeds 4ms (single frame at 240fps — generous; real
 * predicates should be sub-millisecond).
 */
export function evaluateEnabled(
  action: Action,
  deps?: ActionDeps,
  at?: { x: number; y: number },
): ActionEnabledResult {
  if (!action.enabled) return { enabled: true };
  const dev = isDev();
  const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? () => performance.now()
    : () => Date.now();
  const start = dev ? now() : 0;
  try {
    const result = action.enabled(deps, at);
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
  } catch (e) {
    if (dev && !enabledThrewWarned.has(action.id)) {
      enabledThrewWarned.add(action.id);
      console.warn(
        `weasel actions: enabled() for action "${action.id}" threw; treating as disabled. ` +
        `The predicate must not throw — see Action.enabled JSDoc.`,
        e,
      );
    }
    return { enabled: false, reason: ActionDisabledReason.PredicateThrew };
  }
}

/**
 * Safely evaluate an action's `active` predicate. `undefined` for an action
 * with no pressed state; a predicate that throws reads as not active.
 */
export function evaluateActive(action: Action, deps?: ActionDeps): boolean | undefined {
  if (!action.active) return undefined;
  try {
    return action.active(deps) === true;
  } catch {
    return false;
  }
}
