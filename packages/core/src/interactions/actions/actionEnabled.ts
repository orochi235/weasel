/**
 * @experimental
 * Palette-side evaluation of `Action.enabled`. The dispatcher calls the
 * predicate raw as a gate; this is the surface that also enforces the
 * contract the predicate's JSDoc states — no throwing, under 4ms in dev.
 */
import type { ActionDeps } from './invoker';
import { ActionDisabledReason, type Action } from './action';

/**
 * @experimental
 * Result of evaluating an Action's `enabled` predicate.
 */
export interface ActionEnabledResult {
  enabled: boolean;
  reason?: ActionDisabledReason;
}

const enabledSlowWarned = new Set<string>();
const enabledThrewWarned = new Set<string>();
const ENABLED_BUDGET_MS = 4;
/**
 * @experimental
 * Safely evaluate an action's `enabled` predicate. Returns `{enabled: true}`
 * when no predicate is supplied. Catches throws and treats them as disabled
 * with reason `'(predicate threw)'`. In dev mode, warns once per action id
 * when a single call exceeds 4ms (single frame at 240fps — generous; real
 * predicates should be sub-millisecond).
 */
export function evaluateEnabled(
  action: Action,
  deps?: ActionDeps,
): ActionEnabledResult {
  if (!action.enabled) return { enabled: true };
  const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
  const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? () => performance.now()
    : () => Date.now();
  const start = isDev ? now() : 0;
  try {
    const result = action.enabled(deps);
    if (isDev) {
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
    if (isDev && !enabledThrewWarned.has(action.id)) {
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
