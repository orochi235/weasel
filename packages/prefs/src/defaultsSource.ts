import type { PrefsCssSource } from './css';
import type { PrefGroup } from './groups';
import { assignPrefValueAtPath, prefHoldsValue, prefLeaves } from './helpers';
import { isPrefLocus, selectionWeights, type PrefSelection } from './locus';
import { readStored, resolveHeld, selectionAt } from './snapshot';
import { prefSelectors } from './splitCheck';

/**
 * A schema's defaults read the way a store at defaults reads them, a split
 * default by its `defaultLocus` — what `prefsCss` needs to write a schema's
 * stylesheet with no store and no storage, at build time say.
 */
export function prefsDefaultsSource(schema: PrefGroup): PrefsCssSource {
  const leaves = new Map([...prefLeaves(schema)].filter(([, leaf]) => prefHoldsValue(leaf)));
  const selectors = prefSelectors(leaves);
  const source = { selectors };
  const held = new Map([...leaves].map(([path, leaf]) => [path, leaf.defaultLocus === undefined ? leaf.default : readStored(source, leaf, leaf.defaultLocus)]));
  const own: PrefSelection = Object.fromEntries([...selectors.keys()].map((path) => [path, held.get(path) as string]));

  const read = (path: string, selection: PrefSelection): unknown => {
    const leaf = leaves.get(path);
    if (!leaf) return undefined;
    return selectors.has(path) ? selection[path] : resolveHeld(source, leaf, held.get(path), selectionWeights(selection));
  };

  return {
    schema,
    values: (options) => {
      const selection = options?.at ? selectionAt(selectors, own, options.at) : own;
      const tree: Record<string, unknown> = {};
      for (const path of leaves.keys()) assignPrefValueAtPath(tree, path, read(path, selection));
      return tree;
    },
    locus: (path) => {
      const value = held.get(path);
      return isPrefLocus(value) ? value : undefined;
    },
    get: (path) => read(path, own),
  };
}
