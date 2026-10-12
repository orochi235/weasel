import { isPrefLeaf, prefHoldsValue } from '@weasel-js/prefs';
import { childrenOf, joinPath, outermost, rekeyed, removeNode, shiftNodes, type SchemaNode, type SchemaRoot, type SchemaTarget } from './schemaEdit';

// A layout's pointers name value paths in its dialog, which no path in the layout's own tree is. `renameKey`,
// `moveNodes`, and `removeNodes` take one for the other, and rewrite or remove pointers that named something else.

export function renameLayoutKey<R extends SchemaRoot>(layout: R, path: string, next: string): R {
  return rekeyed(layout, path, next);
}

/** As `moveNodes`: the tree, `layout` itself when nothing ends up anywhere new, and each moved node's old path in `from` beside its new one in `paths`. */
export function moveLayoutNodes<R extends SchemaRoot>(
  layout: R, paths: readonly string[], target: SchemaTarget,
): { root: R; from: string[]; paths: string[] } {
  return shiftNodes(layout, paths, target);
}

/** `layout` without the nodes at `paths`; one beneath another goes with it. */
export function removeLayoutNodes<R extends SchemaRoot>(layout: R, paths: readonly string[]): R {
  return outermost(paths).reduce((root, path) => removeNode(root, path), layout);
}

/** Every leaf under `root` that holds a value, by its path in the tree. */
function settingsIn(root: SchemaRoot): Array<[path: string, leaf: SchemaNode]> {
  const out: Array<[string, SchemaNode]> = [];
  const walk = (node: SchemaNode, path: string | null): void => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const at = joinPath(path, key);
      if (!isPrefLeaf(child)) walk(child, at);
      else if (prefHoldsValue(child)) out.push([at, child]);
    }
  };
  walk(root, null);
  return out;
}

/**
 * Whether `next` holds a setting `layout` did not. A layout points at settings and a dialog holds them, so one is
 * not added here. One a draft edited by hand already holds is still the layout's: it is edited where it sits, a new
 * object at its path, and carried by a move or by a new key above it as the same object at another path.
 */
export function gainsSetting(layout: SchemaRoot, next: SchemaRoot): boolean {
  const [had, has] = [new Map(settingsIn(layout)), new Map(settingsIn(next))];
  // What left its path may turn up at another; what stayed is spoken for, and is no second setting somewhere else.
  const carried = new Set([...had].filter(([path]) => !has.has(path)).map(([, leaf]) => leaf));
  return [...has].some(([path, leaf]) => !had.has(path) && !carried.delete(leaf));
}
