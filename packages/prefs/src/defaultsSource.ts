import type { PrefsCssSource } from './css';
import { type PrefGroup, prefHoldsValue, prefLeaves, isPrefScope, type PrefSelection, prefScopedDefault } from '@weasel-js/prefs-schema';
import { assignPrefValueAtPath, selectionWeights } from '@weasel-js/prefs-schema/internal';
import { readStored, resolveHeld, selectionAt } from './snapshot';
import { prefSelectors, admittedSelectors } from './splitCheck';

/**
 * A schema's defaults read the way a store at defaults reads them, a split
 * default by its `defaultScope` — what `prefsCss` needs to write a schema's
 * stylesheet with no store and no storage, at build time say.
 */
export function prefsDefaultsSource(schema: PrefGroup): PrefsCssSource {
  const leaves = new Map([...prefLeaves(schema)].filter(([, leaf]) => prefHoldsValue(leaf)));
  const selectors = prefSelectors(leaves);
  const admitted = admittedSelectors(schema);
  const held = new Map([...leaves].map(([path, leaf]) => {
    const scope = prefScopedDefault(leaf);
    return [path, scope === undefined ? leaf.default : readStored({ selectors, admitted }, leaf, scope)];
  }));
  const own: PrefSelection = Object.fromEntries([...selectors.keys()].map((path) => [path, held.get(path) as string]));

  const read = (path: string, selection: PrefSelection): unknown => {
    const leaf = leaves.get(path);
    if (!leaf) return undefined;
    return selectors.has(path) ? selection[path] : resolveHeld({}, leaf, held.get(path), selectionWeights(selection));
  };

  return {
    schema,
    values: (options) => {
      const selection = options?.at ? selectionAt(selectors, own, options.at, admitted) : own;
      const tree: Record<string, unknown> = {};
      for (const path of leaves.keys()) assignPrefValueAtPath(tree, path, read(path, selection));
      return tree;
    },
    scope: (path) => {
      const value = held.get(path);
      return isPrefScope(value) ? value : undefined;
    },
    get: (path) => read(path, own),
  };
}
