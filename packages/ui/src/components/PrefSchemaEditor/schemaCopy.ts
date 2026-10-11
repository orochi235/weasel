import { isPrefLeaf, isPrefSection, prefHoldsValue, type PrefAlias } from '@weasel-js/prefs';
import { uniqueKey } from './schemaKeys';
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

/**
 * `root` with an alias of each leaf at `paths` set at `target`, the leaves left where they are. An alias takes
 * its leaf's key where the target's children have none like it, and a numbered one where they do.
 */
export function aliasNodes<R extends SchemaRoot>(root: R, paths: readonly string[], target: SchemaTarget): { root: R; paths: string[] } {
  const dest = target.parentPath;
  const destNode = nodeAt(root, dest) ?? root;
  if (!childrenOf(destNode)) throw new Error(`schemaEdit: ${dest} cannot hold children`);
  const made = paths.map((p) => {
    const node = nodeAt(root, p);
    if (!node || !isPrefLeaf(node)) throw new Error(`schemaEdit: no leaf at ${p} to alias`);
    if (!canAlias(root, p)) throw new Error(`schemaEdit: ${p} cannot be aliased`);
    const alias = aliasOf(root, p);
    checkFits(destNode, alias);
    return { key: keyOf(p), alias };
  });
  const out: string[] = [];
  const next = editChildren(root, dest, (kids) => {
    const taken: ChildMap = { ...kids };
    const entries: Array<[string, SchemaNode]> = made.map((m) => {
      // Under a section root a key is the value's path, and the alias holds no value to put at the leaf's.
      const key = uniqueKey(taken, isPrefSection(root) ? `${m.key.replaceAll('.', '_')}Alias` : m.key);
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
 * key where the target's children have none like it, and takes a numbered one where they do. `paths` are the
 * copies' paths, in the order given, less any node already under another one copied.
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
    return { key: keyOf(p), node };
  });
  const out: string[] = [];
  const next = editChildren(root, dest, (kids) => {
    const taken: ChildMap = { ...kids };
    const entries: Array<[string, SchemaNode]> = copying.map((c) => {
      const key = uniqueKey(taken, c.key);
      taken[key] = c.node;
      out.push(joinPath(dest, key));
      return [key, c.node];
    });
    return insertAt(kids, entries, target.index);
  });
  return { root: next, paths: out };
}
