import { type PrefCondition, prefConditionHolds } from '@weasel-js/prefs';
import { schemaNodeAtPath, valueAtPath } from './path';
import type { ConfigPredicate, ResolvedConfig } from './types';

/** Whether a node's condition and the function beside the tree both hold; either may be absent. */
function holds(
  condition: PrefCondition | undefined,
  predicate: ConfigPredicate | undefined,
  config: Record<string, unknown>,
): boolean {
  if (condition && !prefConditionHolds(condition, (path) => valueAtPath(config, path)))
    return false;
  return predicate ? predicate(config) : true;
}

/**
 * Whether the row at a dotted path should be drawn right now. A group answers
 * for its whole subtree — hiding one hides everything under it.
 *
 * `hidden` is the node's own static flag; `showIf` is the schema's condition
 * on the node, or its function beside the tree, over the live config. Both are presentational — a hidden leaf keeps its
 * value and the instrument still reads it.
 */
export function isLeafVisible(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
  showHidden = false,
): boolean {
  const node = schemaNodeAtPath(resolved.group, path);
  if (node && 'hidden' in node && node.hidden === true && !showHidden) return false;
  return holds(node?.showIf, resolved.showIf.get(path), config);
}

/**
 * Whether the row at a dotted path takes input right now: its `enableIf`
 * holds, or it has none. As {@link isLeafVisible}, a group answers for its
 * whole subtree, and a path answers for its own node only.
 */
export function isLeafEnabled(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
): boolean {
  const node = schemaNodeAtPath(resolved.group, path);
  return holds(node?.enableIf, resolved.enableIf?.get(path), config);
}
