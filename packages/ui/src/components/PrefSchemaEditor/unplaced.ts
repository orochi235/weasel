import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { childrenOf, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** The key of every leaf `root` holds, at any depth. */
function leafKeys(root: SchemaRoot): Set<string> {
  const out = new Set<string>();
  const walk = (node: SchemaNode): void => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      if (isPrefLeaf(child)) out.add(key);
      walk(child);
    }
  };
  walk(root);
  return out;
}

/**
 * What of `unplaced` the schema does not hold yet: a leaf is held once the schema has a leaf of its key, wherever
 * that sits, and a group goes when every leaf under it is held. `null` with nothing left.
 */
export function stillUnplaced(unplaced: PrefGroup, schema: SchemaRoot): PrefGroup | null {
  const held = leafKeys(schema);
  const cut = (group: PrefGroup): PrefGroup | null => {
    const children: Record<string, PrefLeaf | PrefGroup> = {};
    for (const [key, child] of Object.entries(group.children)) {
      if (isPrefLeaf(child)) {
        if (!held.has(key)) children[key] = child;
      } else {
        const left = cut(child);
        if (left) children[key] = left;
      }
    }
    return Object.keys(children).length === 0 ? null : { ...group, children };
  };
  return cut(unplaced);
}

/** The node at a path of keys under `root`, or undefined. */
export function unplacedAt(root: PrefGroup, keys: readonly string[]): PrefLeaf | PrefGroup | undefined {
  let at: PrefLeaf | PrefGroup | undefined = root;
  for (const key of keys) {
    if (at === undefined || isPrefLeaf(at)) return undefined;
    at = at.children[key];
  }
  return at;
}
