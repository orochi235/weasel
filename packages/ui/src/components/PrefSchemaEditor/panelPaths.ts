import { isPrefLeaf, type PrefSection } from '@weasel-js/prefs';
import { pathWithin } from '../Prefs/selection';
import { childrenOf, joinPath, type SchemaNode } from './schemaEdit';

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
      walk(child, at, shown);
    }
  };
  walk(root, null, '');
  return out;
}

/**
 * The path a properties panel draws a row at for the node at tree path `path`: a leaf's own key, and a field's
 * under its leaf's, the sections on the way adding nothing. Null for a section, and for a path that names no node.
 */
export function panelPathOf(root: PrefSection, path: string): string | null {
  return panelRows(root).find(([tree]) => tree === path)?.[1] ?? null;
}

/** The tree path of the row a panel draws at `panelPath`, or of the nearest leaf it lies in. Null when there is none. */
export function treePathOfPanel(root: PrefSection, panelPath: string): string | null {
  let best: [string, string] | undefined;
  for (const row of panelRows(root)) {
    if (pathWithin(row[1], panelPath) && (best === undefined || row[1].length > best[1].length)) best = row;
  }
  return best?.[0] ?? null;
}
