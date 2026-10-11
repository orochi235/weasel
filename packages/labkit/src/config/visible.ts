import { type PrefScope, prefJudge, prefScopeAt } from '@weasel-js/prefs';
import { schemaNodeAtPath, valueAtPath } from './path';
import type { ResolvedConfig } from './types';

/**
 * Whether the node at a dotted path is shown and enabled, with every group
 * above it counted. The conditions the schema carries as data are core's to
 * answer (`prefScopeAt`); the functions beside the tree are asked here, for
 * the node and for each group on the way to it.
 */
function scopeAt(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
): PrefScope {
  const data = prefScopeAt(
    resolved.group,
    path,
    prefJudge((at) => valueAtPath(config, at)),
  );
  let { shown, enabled } = data;
  const steps = path.split('.');
  for (let i = 1; i <= steps.length; i += 1) {
    const at = steps.slice(0, i).join('.');
    shown &&= resolved.showIf.get(at)?.(config) ?? true;
    enabled &&= resolved.enableIf?.get(at)?.(config) ?? true;
  }
  return { shown, enabled };
}

/**
 * Whether the row at a dotted path should be drawn right now: its `showIf`
 * holds, as a condition or a function, and so does that of every group above
 * it. `hidden` is the node's own static flag. Both are presentational — a
 * hidden leaf keeps its value and the instrument still reads it.
 */
export function isLeafVisible(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
  showHidden = false,
): boolean {
  const node = schemaNodeAtPath(resolved.group, path);
  if (node && 'hidden' in node && node.hidden === true && !showHidden) return false;
  return scopeAt(resolved, path, config).shown;
}

/**
 * Whether the row at a dotted path takes input right now: its `enableIf`
 * holds, and so does that of every group above it.
 */
export function isLeafEnabled(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
): boolean {
  return scopeAt(resolved, path, config).enabled;
}
