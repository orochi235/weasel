import { isPrefLeaf, isPrefSection, prefHoldsValue, type PrefAlias } from '@weasel-js/prefs';
import { keysTakenAt, uniqueKey } from './schemaKeys';
import {
  checkFits, childrenOf, editChildren, insertAt, joinPath, keyOf, keysOf, nodeAt, outermost, pathOf,
  type ChildMap, type SchemaNode, type SchemaRoot, type SchemaTarget,
} from './schemaTree';
import { valuePathOf } from './valuePaths';

/** Whether the node at `path` can be shown a second time: a leaf that holds a value, or an alias of one, and no field of an `object` leaf. */
export function canAlias(root: SchemaRoot, path: string): boolean {
  const node = nodeAt(root, path);
  if (!node || !isPrefLeaf(node) || !(prefHoldsValue(node) || node.kind === 'alias')) return false;
  const keys = keysOf(path);
  return !keys.slice(0, -1).some((_, i) => isPrefLeaf(nodeAt(root, pathOf(keys.slice(0, i + 1)))!));
}

/** An alias of the leaf at `path`: unnamed, so it reads as the leaf it shows. */
export function aliasOf(root: SchemaRoot, path: string): PrefAlias {
  return { kind: 'alias', name: '', description: '', default: undefined, of: valuePathOf(root, path) };
}

/** What a link drag sets down: whether the node at a path can be shown a second time, and the node that shows it. */
export interface LinkRule {
  can(root: SchemaRoot, path: string): boolean;
  of(root: SchemaRoot, path: string): SchemaNode;
  /** The bar's tool that makes one: its label, and what its tooltip says it does. */
  label: string;
  title: string;
}

/** A pref's links: an alias of a leaf that holds a value. */
export const VALUE_LINKS: LinkRule = { can: canAlias, of: aliasOf, label: 'Add alias', title: 'Show each selected pref in a second place' };

/** The key an alias of the leaf keyed `key` starts from. Under a section root a key is a value's path, and an alias holds no value to put at its leaf's. */
function aliasKey(root: SchemaRoot, key: string): string {
  return isPrefSection(root) ? `${key.replaceAll('.', '_')}Alias` : key;
}

/**
 * `root` with a link of each node at `paths` set at `target`, as `links` makes them, the nodes left where they are.
 * A link takes its node's key where {@link keysTakenAt} has none like it for the target, and a numbered one where it does.
 */
export function aliasNodes<R extends SchemaRoot>(root: R, paths: readonly string[], target: SchemaTarget, links: LinkRule = VALUE_LINKS): { root: R; paths: string[] } {
  const dest = target.parentPath;
  const destNode = nodeAt(root, dest) ?? root;
  if (!childrenOf(destNode)) throw new Error(`schemaEdit: ${dest} cannot hold children`);
  const made = paths.map((p) => {
    if (!nodeAt(root, p)) throw new Error(`schemaEdit: no node at ${p} to alias`);
    if (!links.can(root, p)) throw new Error(`schemaEdit: ${p} cannot be aliased`);
    const alias = links.of(root, p);
    checkFits(destNode, alias);
    return { key: keyOf(p), alias };
  });
  const out: string[] = [];
  const next = editChildren(root, dest, (kids) => {
    const taken: ChildMap = { ...keysTakenAt(root, dest, true) };
    const entries: Array<[string, SchemaNode]> = made.map((m) => {
      const key = uniqueKey(taken, aliasKey(root, m.key));
      taken[key] = m.alias;
      out.push(joinPath(dest, key));
      return [key, m.alias];
    });
    return insertAt(kids, entries, target.index);
  });
  return { root: next, paths: out };
}

/**
 * `root` with a copy of each node at `paths` set at `target`, the originals left where they are. A copy keeps its
 * key where {@link keysTakenAt} has none like it for the target, and takes a numbered one where it does. `paths`
 * are the copies' paths, in the order given, less any node already under another one copied.
 *
 * Under a section root a leaf's key is the path its value lives at, which no second leaf can have, so the copy of
 * a leaf that holds a value is an alias of it, and a copied section holds an alias of each such leaf inside it.
 */
export function copyNodes<R extends SchemaRoot>(root: R, paths: readonly string[], target: SchemaTarget): { root: R; paths: string[] } {
  const tops = outermost(paths);
  const dest = target.parentPath;
  const destNode = nodeAt(root, dest) ?? root;
  if (!childrenOf(destNode)) throw new Error(`schemaEdit: ${dest} cannot hold children`);
  const copying = tops.map((p) => {
    const node = nodeAt(root, p);
    if (!node) throw new Error(`schemaEdit: no node at ${p}`);
    checkFits(destNode, node);
    return { path: p, node };
  });
  const aliasing = isPrefSection(root);
  const out: string[] = [];
  const next = editChildren(root, dest, (kids) => {
    const taken: ChildMap = { ...keysTakenAt(root, dest, false) };
    const leafKeys: ChildMap = { ...keysTakenAt(root, dest, true) };
    const leafKey = (key: string, node: SchemaNode): string => {
      const free = uniqueKey(leafKeys, key);
      leafKeys[free] = node;
      return free;
    };
    /** The copy of the node at `path`, and the key it takes; a section inside a copied one keeps its own. */
    const copyOf = (path: string, node: SchemaNode, top: boolean): [string, SchemaNode] => {
      if (isPrefLeaf(node)) {
        const shown = aliasing && prefHoldsValue(node) && canAlias(root, path) ? aliasOf(root, path) : node;
        return [leafKey(shown === node ? keyOf(path) : aliasKey(root, keyOf(path)), shown), shown];
      }
      const key = top ? uniqueKey(taken, keyOf(path)) : keyOf(path);
      if (!aliasing || !isPrefSection(node)) return [key, node];
      const members = Object.fromEntries(Object.entries(node.members).map(([k, kid]) => copyOf(joinPath(path, k), kid, false)));
      return [key, { ...node, members } as SchemaNode];
    };
    const entries: Array<[string, SchemaNode]> = copying.map((c) => {
      const entry = copyOf(c.path, c.node, true);
      taken[entry[0]] = entry[1];
      leafKeys[entry[0]] = entry[1];
      out.push(joinPath(dest, entry[0]));
      return entry;
    });
    return insertAt(kids, entries, target.index);
  });
  return { root: next, paths: out };
}
