import { isPrefLeaf, type PrefSection } from '@weasel-js/prefs';
import { pathWithin } from '../Prefs/selection';
import { childrenOf, joinPath, ownChildrenOf, type SchemaNode } from './schemaEdit';

/** Every leaf and field the tree shows, as its tree path and the path a properties panel draws its row at. */
function panelRows(root: PrefSection): Array<[tree: string, panel: string]> {
  const out: Array<[string, string]> = [];
  const walk = (node: SchemaNode, tree: string | null, panel: string): void => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const at = joinPath(tree, key);
      if (!isPrefLeaf(child)) {
        walk(child, at, panel);
        continue;
      }
      const shown = panel === '' ? key : `${panel}.${key}`;
      out.push([at, shown]);
      // A field of an entry is drawn once per entry, at no one path of its own.
      if (ownChildrenOf(child)) walk(child, at, shown);
    }
  };
  walk(root, null, '');
  return out;
}

/** Whether `key` is a section at the top of `root`: the one kind a panel names by its key, which is its tree path too. */
function isTopSection(root: PrefSection, key: string): boolean {
  return Object.hasOwn(root.members, key) && !isPrefLeaf(root.members[key]!);
}

/**
 * What a properties panel names the node at tree path `path`: a leaf by its own key, a field by its key under its
 * leaf's, the sections on the way adding nothing, and a top-level section by its key. Null for any other section,
 * which the panel draws no heading for, and for a path that names no node.
 */
export function panelPathOf(root: PrefSection, path: string): string | null {
  return panelRows(root).find(([tree]) => tree === path)?.[1] ?? (isTopSection(root, path) ? path : null);
}

/**
 * The tree path of what a panel names `panelPath`: the row it draws there or the nearest leaf that lies in, else
 * the top-level section of that key. Null when there is none.
 */
export function treePathOfPanel(root: PrefSection, panelPath: string): string | null {
  let best: [string, string] | undefined;
  for (const row of panelRows(root)) {
    if (pathWithin(row[1], panelPath) && (best === undefined || row[1].length > best[1].length)) best = row;
  }
  return best?.[0] ?? (isTopSection(root, panelPath) ? panelPath : null);
}
