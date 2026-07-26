import type { ChromeCtx, ChromeId, VisibilityRules } from './types';
import type { RuleCtx } from './ruleCtx';
import { evaluate } from './rule';
import { defaultVisibilityRules } from './defaults';

/**
 * Build the per-frame visibility check. Merges consumer rules on top
 * of the kit defaults, then closes over `ctx` so each chrome-id
 * lookup runs its rule against the current state.
 *
 * `VisibilityRules` entries may be either fluent `Condition` values
 * (callable) or raw `Rule` trees — we normalize at lookup time.
 *
 * Predicates are O(1) and run once per chrome id per frame; no
 * memoization in v1 — profile before adding any.
 *
 * `ChromeCtx` is the legacy shape; surfaces still on it supply
 * `mode='normal'` and an empty `allowedCapabilities` to satisfy
 * `RuleCtx` when calling. We do the same here so callers in
 * legacy shape keep working transparently.
 */
export function resolveVisibility(
  consumer: VisibilityRules | undefined,
  ctx: ChromeCtx | RuleCtx,
): (id: ChromeId) => boolean {
  const merged: VisibilityRules = consumer
    ? { ...defaultVisibilityRules, ...consumer }
    : defaultVisibilityRules;
  const ruleCtx: RuleCtx = 'mode' in ctx
    ? ctx
    : { ...ctx, mode: 'normal', allowedCapabilities: new Set() };
  return (id) => {
    const entry = merged[id];
    if (entry === undefined) return true;
    if (typeof entry === 'function') return entry(ruleCtx);
    return evaluate(entry, ruleCtx);
  };
}
