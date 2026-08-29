import type { ResolvedConfig } from './types';

/**
 * Whether a leaf's row should be drawn right now.
 *
 * `hidden` is the leaf's own static flag; `showIf` is the schema's predicate
 * over the live config. Both are presentational — a hidden leaf keeps its
 * value and the instrument still reads it.
 */
export function isLeafVisible(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
  showHidden = false,
): boolean {
  const leaf = resolved.group.children[path];
  if (leaf && 'hidden' in leaf && leaf.hidden === true && !showHidden) return false;
  const predicate = resolved.showIf.get(path);
  return predicate ? predicate(config) : true;
}
