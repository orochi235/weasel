import type { ChromeCtx, ChromeId, VisibilityRules } from './types';
import type { RuleCtx } from '@weasel-js/routing';
import { DEFAULT_ALLOWED_CAPABILITIES } from '@weasel-js/routing';
import { evaluate } from '@weasel-js/routing';
import { defaultVisibilityRules } from './defaults';
import { viewZoom } from 'core/viewport/view';

/**
 * Build the per-frame visibility check: consumer rules merged on top of
 * the kit defaults, evaluated against `ctx`.
 *
 * `ChromeCtx` is the legacy shape; surfaces still on it get `mode='normal'`
 * and `DEFAULT_ALLOWED_CAPABILITIES` filled in here, so a caller that never
 * opted into modality behaves exactly like one sitting in normal mode.
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
    : {
      ...ctx,
      zoom: viewZoom(ctx.view),
      mode: 'normal',
      allowedCapabilities: DEFAULT_ALLOWED_CAPABILITIES,
    };
  return (id) => {
    if (ruleCtx.hiddenChrome?.has(id)) return false;
    const entry = merged[id];
    if (entry === undefined) return true;
    if (typeof entry === 'function') return entry(ruleCtx);
    return evaluate(entry, ruleCtx);
  };
}
