import { schemaNodeAtPath } from './path';
import type { ResolvedConfig } from './types';

/**
 * Whether the row at a dotted path should be drawn right now. A group answers
 * for its whole subtree — hiding one hides everything under it.
 *
 * `hidden` is the node's own static flag; `showIf` is the schema's predicate
 * over the live config. Both are presentational — a hidden leaf keeps its
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
  const predicate = resolved.showIf.get(path);
  return predicate ? predicate(config) : true;
}
