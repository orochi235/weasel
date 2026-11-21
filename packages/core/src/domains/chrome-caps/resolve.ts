import type { ChromeId, VisibilityRules } from './types';
import type { RuleCtx } from '@weasel-js/routing';
import { evaluate } from '@weasel-js/routing';
import { defaultVisibilityRules } from './defaults';

/**
 * `layers` merged left to right, each over the last. A key whose value is
 * `undefined` counts as absent, so it falls through to the layer below rather
 * than replacing its rule with "always visible".
 */
export function mergeVisibilityRules(...layers: readonly (VisibilityRules | undefined)[]): VisibilityRules {
  const merged: VisibilityRules = Object.create(null) as VisibilityRules;
  for (const layer of layers) {
    if (!layer) continue;
    for (const [id, rule] of Object.entries(layer)) if (rule !== undefined) merged[id] = rule;
  }
  return merged;
}

/**
 * Build the per-frame visibility check: consumer rules merged on top of
 * the kit defaults, evaluated against `ctx`.
 */
export function resolveVisibility(
  consumer: VisibilityRules | undefined,
  ruleCtx: RuleCtx,
): (id: ChromeId) => boolean {
  const merged = consumer ? mergeVisibilityRules(defaultVisibilityRules, consumer) : defaultVisibilityRules;
  return (id) => {
    if (ruleCtx.hiddenChrome?.has(id)) return false;
    const entry = Object.hasOwn(merged, id) ? merged[id] : undefined;
    if (entry === undefined) return true;
    if (typeof entry === 'function') return entry(ruleCtx);
    return evaluate(entry, ruleCtx);
  };
}
