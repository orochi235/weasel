import { isPrefLeaf, type PrefAlias } from '@weasel-js/prefs';
import { checkKey, keysTakenAt, takesDottedKey, uniqueKey } from './schemaKeys';
import {
  checkFits, childrenOf, editChildren, insertAt, isUnder, joinPath, keyOf, nodeAt, outermost, parentPath,
  type ChildMap, type SchemaNode, type SchemaRoot, type SchemaTarget,
} from './schemaTree';
import { rebaseValuePaths, valueMove, valuePathsAt } from './valuePaths';

export {
  branchUnder, childrenOf, entryHolderAt, fitsUnder, isUnder, joinPath, keyOf, keysOf, levelsOf, nodeAt, outermost, ownChildrenOf,
  ownSlotOf, parentPath, pathOf, slotOf, withinDepth, type ChildMap, type SchemaNode, type SchemaRoot, type SchemaTarget,
} from './schemaTree';
export { isValidKey, keyClashes, keyFromName, keyProblem, keysTakenAt, takesDottedKey, undigit, uniqueKey } from './schemaKeys';
export { heldValuePaths, rebaseValuePaths, valueMove, valuePathOf, valuePathsAt, type ValueMove } from './valuePaths';
export { aliasNodes, aliasOf, canAlias, copyNodes } from './schemaCopy';

export function addNode<R extends SchemaRoot>(root: R, parent: string | null, key: string, node: SchemaNode, index?: number): R {
  const host = nodeAt(root, parent);
  checkFits(host, node);
  return editChildren(root, parent, (kids) => {
    checkKey(keysTakenAt(root, parent, isPrefLeaf(node)), key, !!host && takesDottedKey(host, node));
    return insertAt(kids, [[key, node]], index ?? Object.keys(kids).length);
  });
}

export function removeNode<R extends SchemaRoot>(root: R, path: string): R {
  const key = keyOf(path);
  return editChildren(root, parentPath(path), (kids) => {
    const { [key]: _gone, ...rest } = kids;
    return rest;
  });
}

/** The tree paths of the aliases showing a value at or beneath one of `values`. */
function aliasesOf(root: SchemaRoot, values: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (node: SchemaNode, path: string | null): void => {
    if (path !== null && isPrefLeaf(node) && node.kind === 'alias') {
      const of = (node as PrefAlias).of;
      if (values.some((v) => of === v || of.startsWith(`${v}.`))) out.push(path);
    }
    for (const [key, kid] of Object.entries(childrenOf(node) ?? {})) walk(kid, joinPath(path, key));
  };
  walk(root, null);
  return out;
}

/**
 * `root` without the nodes at `paths`; one beneath another goes with it. So does every alias of a removed pref,
 * which would be left showing nothing, and any alias of one of those.
 */
export function removeNodes<R extends SchemaRoot>(root: R, paths: readonly string[]): R {
  let next = root;
  for (let gone = outermost(paths); gone.length > 0;) {
    const values = gone.flatMap((p) => {
      const node = nodeAt(next, p);
      return node ? valuePathsAt(next, p, node) : [];
    });
    next = gone.reduce((r, p) => removeNode(r, p), next);
    gone = outermost(aliasesOf(next, values));
  }
  return next;
}

export function renameKey<R extends SchemaRoot>(root: R, path: string, next: string): R {
  const renamed = rekeyed(root, path, next);
  return renamed === root ? root : rebaseValuePaths(renamed, [valueMove(root, path, joinPath(parentPath(path), next))]);
}

/** `root` with the node at `path` under the key `next`, where it sat; no value path held anywhere follows it. */
export function rekeyed<R extends SchemaRoot>(root: R, path: string, next: string): R {
  const key = keyOf(path);
  if (next === key) return root;
  const host = nodeAt(root, parentPath(path));
  const node = nodeAt(root, path);
  return editChildren(root, parentPath(path), (kids) => {
    checkKey(keysTakenAt(root, parentPath(path), !!node && isPrefLeaf(node)), next, !!host && !!node && takesDottedKey(host, node));
    return Object.fromEntries(Object.entries(kids).map(([k, v]) => [k === key ? next : k, v]));
  });
}

export function replaceNode<R extends SchemaRoot>(root: R, path: string | null, fn: (n: SchemaNode) => SchemaNode): R {
  if (path === null) return fn(root) as R;
  const key = keyOf(path);
  return editChildren(root, parentPath(path), (kids) => {
    const node = kids[key];
    if (!node) throw new Error(`schemaEdit: no node at ${path}`);
    return { ...kids, [key]: fn(node) };
  });
}

/**
 * Set one attribute; `undefined` removes it. Every other field keeps its value, functions included, but for one:
 * an enum made clearable gives up its default, which a clearable enum cannot have.
 */
export function setAttribute<R extends SchemaRoot>(root: R, path: string | null, key: string, value: unknown): R {
  return replaceNode(root, path, (node) => {
    const next: Record<string, unknown> = { ...node };
    if (value === undefined) delete next[key];
    else next[key] = value;
    if (next.kind === 'enum' && next.clearable === true) next.default = undefined;
    return next as unknown as SchemaNode;
  });
}

/**
 * Move the nodes at `paths` to `target`, in the order given. A path beneath another moved path travels with it. A
 * moved key that collides with one {@link keysTakenAt} gives for the target parent is renamed with {@link uniqueKey}. Returns the
 * tree, `root` itself when nothing ends up anywhere new, and each moved node's old path in `from` beside its new
 * one in `paths`.
 */
export function moveNodes<R extends SchemaRoot>(
  root: R, paths: readonly string[], target: SchemaTarget,
): { root: R; from: string[]; paths: string[] } {
  const moved = shiftNodes(root, paths, target);
  if (moved.root === root) return moved;
  return { ...moved, root: rebaseValuePaths(moved.root, moved.from.map((f, i) => valueMove(root, f, moved.paths[i]!))) };
}

/** {@link moveNodes} as far as the tree goes: no value path held anywhere follows a moved node. */
export function shiftNodes<R extends SchemaRoot>(
  root: R, paths: readonly string[], target: SchemaTarget,
): { root: R; from: string[]; paths: string[] } {
  const tops = outermost(paths);
  const dest = target.parentPath;
  if (dest !== null && tops.some((p) => dest === p || isUnder(dest, p))) {
    throw new Error('schemaEdit: cannot move a node into itself');
  }
  const moving = tops.map((p) => {
    const node = nodeAt(root, p);
    if (!node) throw new Error(`schemaEdit: no node at ${p}`);
    return { path: p, key: keyOf(p), node };
  });
  const destNode = nodeAt(root, dest) ?? root;
  const destKids = childrenOf(destNode);
  if (!destKids) throw new Error(`schemaEdit: ${dest} cannot hold children`);
  for (const m of moving) checkFits(destNode, m.node);
  const destKeys = Object.keys(destKids);
  const shift = moving.filter((m) => parentPath(m.path) === dest && destKeys.indexOf(m.key) < target.index).length;

  let next = root;
  for (const m of moving) next = removeNode(next, m.path);
  const out: string[] = [];
  const lifted = next;
  next = editChildren(next, dest, (kids) => {
    const taken: ChildMap = { ...keysTakenAt(lifted, dest, false) };
    const leafKeys: ChildMap = { ...keysTakenAt(lifted, dest, true) };
    const entries: Array<[string, SchemaNode]> = moving.map((m) => {
      const key = uniqueKey(isPrefLeaf(m.node) ? leafKeys : taken, m.key);
      taken[key] = m.node;
      leafKeys[key] = m.node;
      out.push(joinPath(dest, key));
      return [key, m.node];
    });
    return insertAt(kids, entries, target.index - shift);
  });
  const from = moving.map((m) => m.path);
  const settled = Object.keys(childrenOf(nodeAt(next, dest) ?? next) ?? {});
  if (out.every((p, i) => p === from[i]) && settled.every((k, i) => k === destKeys[i])) return { root, from, paths: from };
  return { root: next, from, paths: out };
}

/** The outermost of `paths`, in the order the schema holds them. */
export function carried(root: SchemaRoot, paths: readonly string[]): string[] {
  const tops = new Set(outermost(paths));
  const out: string[] = [];
  const walk = (node: SchemaNode, path: string | null) => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const p = joinPath(path, key);
      if (tops.has(p)) out.push(p);
      else walk(child, p);
    }
  };
  walk(root, null);
  return out;
}

/** `paths` with each one at or beneath a `from` re-rooted at its `to`; the moves apply all at once. */
export function rebasePaths(paths: Iterable<string>, moves: ReadonlyArray<readonly [from: string, to: string]>): Set<string> {
  const out = new Set<string>();
  for (const p of paths) {
    const hit = moves.find(([from]) => p === from || isUnder(p, from));
    out.add(hit ? hit[1] + p.slice(hit[0].length) : p);
  }
  return out;
}
