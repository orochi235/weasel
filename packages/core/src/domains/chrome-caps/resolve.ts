import type { ChromeId, VisibilityRules } from './types';
import type { RuleCtx } from '@weasel-js/routing';
import { evaluate } from '@weasel-js/routing';
import { defaultVisibilityRules } from './defaults';

/**
 * Build the per-frame visibility check: consumer rules merged on top of
 * the kit defaults, evaluated against `ctx`.
 */
export function resolveVisibility(
  consumer: VisibilityRules | undefined,
  ruleCtx: RuleCtx,
): (id: ChromeId) => boolean {
  const merged: VisibilityRules = consumer
    ? { ...defaultVisibilityRules, ...consumer }
    : defaultVisibilityRules;
  return (id) => {
    if (ruleCtx.hiddenChrome?.has(id)) return false;
    const entry = merged[id];
    if (entry === undefined) return true;
    if (typeof entry === 'function') return entry(ruleCtx);
    return evaluate(entry, ruleCtx);
  };
}
