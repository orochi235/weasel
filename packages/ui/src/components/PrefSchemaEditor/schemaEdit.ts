import { isPlainObject } from '@weasel-js/core';
import { prefFieldChoices } from '../Prefs/schema';
import {
  isPrefLeaf,
  type PrefGroup,
  type PrefLeaf,
  type PrefObject,
} from '@weasel-js/prefs';

export type SchemaNode = PrefLeaf | PrefGroup;
export type ChildMap = Record<string, SchemaNode>;

/** Where moved nodes land: among `parentPath`'s children (`null` is the root), at `index` counted before the move. */
export interface SchemaTarget {
  parentPath: string | null;
  index: number;
}

const KEY = /^[A-Za-z_$][\w$]*$/;

/** A key is one path segment, so it can hold no `.`; an identifier also prints bare in the exported literal. */
export function isValidKey(key: string): boolean {
  return KEY.test(key);
}

/** `name` as a camelCase key: `'Line width'` gives `'lineWidth'`. Empty when the name holds no letter or digit;
 *  prefixed with `_` when it would start with a digit. */
export function keyFromName(name: string): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? [];
  const key = words
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  return /^\d/.test(key) ? `_${key}` : key;
}

/** The children of a group, or of an `object` leaf; `undefined` for anything that cannot hold any. */
export function childrenOf(node: SchemaNode): ChildMap | undefined {
  if (!isPrefLeaf(node)) return node.children;
  return node.kind === 'object' ? (node as PrefObject).children : undefined;
}

export function parentPath(path: string): string | null {
  const i = path.lastIndexOf('.');
  return i === -1 ? null : path.slice(0, i);
}

export function keyOf(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1);
}

export function joinPath(parent: string | null, key: string): string {
  return parent === null ? key : `${parent}.${key}`;
}

function ownChild(kids: ChildMap | undefined, key: string): SchemaNode | undefined {
  return kids && Object.hasOwn(kids, key) ? kids[key] : undefined;
}

export function nodeAt(root: PrefGroup, path: string | null): SchemaNode | undefined {
  if (path === null) return root;
  let cur: SchemaNode | undefined = root;
  for (const k of path.split('.')) cur = cur && ownChild(childrenOf(cur), k);
  return cur;
}

export function uniqueKey(kids: ChildMap, base: string): string {
  if (!Object.hasOwn(kids, base)) return base;
  let n = 2;
  while (Object.hasOwn(kids, `${base}${n}`)) n++;
  return `${base}${n}`;
}

function withChildren(node: SchemaNode, kids: ChildMap): SchemaNode {
  return { ...node, children: kids } as SchemaNode;
}

/** `root` with the children of the node at `parent` replaced by `edit` of them. */
function editChildren(root: PrefGroup, parent: string | null, edit: (kids: ChildMap) => ChildMap): PrefGroup {
  const keys = parent === null ? [] : parent.split('.');
  const go = (node: SchemaNode, depth: number): SchemaNode => {
    const kids = childrenOf(node);
    const here = keys.slice(0, depth).join('.') || '(root)';
    if (!kids) throw new Error(`schemaEdit: ${here} cannot hold children`);
    if (depth === keys.length) return withChildren(node, edit(kids));
    const k = keys[depth]!;
    const child = kids[k];
    if (!child) throw new Error(`schemaEdit: no node at ${keys.slice(0, depth + 1).join('.')}`);
    return withChildren(node, { ...kids, [k]: go(child, depth + 1) });
  };
  return go(root, 0) as PrefGroup;
}

function insertAt(kids: ChildMap, entries: Array<[string, SchemaNode]>, index: number): ChildMap {
  const list = Object.entries(kids);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, ...entries);
  return Object.fromEntries(list);
}

/** Why `key` cannot join `kids`, in words for the person typing it; `null` when it can. */
export function keyProblem(kids: ChildMap, key: string): string | null {
  if (!isValidKey(key)) return `"${key}" is not a valid key: use letters, digits, _ or $, not starting with a digit.`;
  if (key === '__proto__') return `"${key}" is reserved.`;
  if (Object.hasOwn(kids, key)) return `"${key}" is taken here.`;
  return null;
}

function checkKey(kids: ChildMap, key: string): void {
  const problem = keyProblem(kids, key);
  if (problem) throw new Error(`schemaEdit: ${problem}`);
}

export function addNode(root: PrefGroup, parent: string | null, key: string, node: SchemaNode, index?: number): PrefGroup {
  return editChildren(root, parent, (kids) => {
    checkKey(kids, key);
    return insertAt(kids, [[key, node]], index ?? Object.keys(kids).length);
  });
}

export function removeNode(root: PrefGroup, path: string): PrefGroup {
  const key = keyOf(path);
  return editChildren(root, parentPath(path), (kids) => {
    const { [key]: _gone, ...rest } = kids;
    return rest;
  });
}

export function renameKey(root: PrefGroup, path: string, next: string): PrefGroup {
  const key = keyOf(path);
  if (next === key) return root;
  return editChildren(root, parentPath(path), (kids) => {
    checkKey(kids, next);
    return Object.fromEntries(Object.entries(kids).map(([k, v]) => [k === key ? next : k, v]));
  });
}

export function replaceNode(root: PrefGroup, path: string | null, fn: (n: SchemaNode) => SchemaNode): PrefGroup {
  if (path === null) return fn(root) as PrefGroup;
  const key = keyOf(path);
  return editChildren(root, parentPath(path), (kids) => {
    const node = kids[key];
    if (!node) throw new Error(`schemaEdit: no node at ${path}`);
    return { ...kids, [key]: fn(node) };
  });
}

/** Set one attribute; `undefined` removes it. Every other field keeps its value, functions included. */
export function setAttribute(root: PrefGroup, path: string | null, key: string, value: unknown): PrefGroup {
  return replaceNode(root, path, (node) => {
    const next: Record<string, unknown> = { ...node };
    if (value === undefined) delete next[key];
    else next[key] = value;
    return next as unknown as SchemaNode;
  });
}

/**
 * Move the nodes at `paths` to `target`, in the order given. A path beneath another moved path travels with it. A
 * moved key that collides with one already in the target parent is renamed with {@link uniqueKey}. Returns the
 * tree, and each moved node's old path in `from` beside its new one in `paths`.
 */
export function moveNodes(
  root: PrefGroup, paths: readonly string[], target: SchemaTarget,
): { root: PrefGroup; from: string[]; paths: string[] } {
  const tops = paths.filter((p) => !paths.some((q) => q !== p && p.startsWith(`${q}.`)));
  const dest = target.parentPath;
  if (dest !== null && tops.some((p) => dest === p || dest.startsWith(`${p}.`))) {
    throw new Error('schemaEdit: cannot move a node into itself');
  }
  const moving = tops.map((p) => {
    const node = nodeAt(root, p);
    if (!node) throw new Error(`schemaEdit: no node at ${p}`);
    return { path: p, key: keyOf(p), node };
  });
  const destKids = childrenOf(nodeAt(root, dest) ?? root);
  if (!destKids) throw new Error(`schemaEdit: ${dest} cannot hold children`);
  const destKeys = Object.keys(destKids);
  const shift = moving.filter((m) => parentPath(m.path) === dest && destKeys.indexOf(m.key) < target.index).length;

  let next = root;
  for (const m of moving) next = removeNode(next, m.path);
  const out: string[] = [];
  next = editChildren(next, dest, (kids) => {
    const taken: ChildMap = { ...kids };
    const entries: Array<[string, SchemaNode]> = moving.map((m) => {
      const key = uniqueKey(taken, m.key);
      taken[key] = m.node;
      out.push(joinPath(dest, key));
      return [key, m.node];
    });
    return insertAt(kids, entries, target.index - shift);
  });
  return { root: next, from: moving.map((m) => m.path), paths: out };
}

/** Every path whose node can hold children, in tree order. */
export function branchPaths(root: PrefGroup): string[] {
  const out: string[] = [];
  const walk = (node: SchemaNode, path: string | null) => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      if (!childrenOf(child)) continue;
      const p = joinPath(path, key);
      out.push(p);
      walk(child, p);
    }
  };
  walk(root, null);
  return out;
}

/** `paths` with each one at or beneath a `from` re-rooted at its `to`; the moves apply all at once. */
export function rebasePaths(paths: Iterable<string>, moves: ReadonlyArray<readonly [from: string, to: string]>): Set<string> {
  const out = new Set<string>();
  for (const p of paths) {
    const hit = moves.find(([from]) => p === from || p.startsWith(`${from}.`));
    out.add(hit ? hit[1] + p.slice(hit[0].length) : p);
  }
  return out;
}

/** A value stored under a path no leaf of the schema describes. */
export interface UndescribedValue {
  path: string;
  value: unknown;
}

/**
 * Each value in `stored` that no leaf of `root` describes, by its dotted path, in stored order. A leaf's own path
 * and everything under it are described; a plain object anywhere else is walked rather than listed.
 */
export function undescribedValues(root: PrefGroup, stored: unknown): UndescribedValue[] {
  const leaves = new Set(prefFieldChoices(root).map((f) => f.path));
  const described = (path: string): boolean => {
    for (let at = path; at !== ''; at = at.includes('.') ? at.slice(0, at.lastIndexOf('.')) : '') {
      if (leaves.has(at)) return true;
    }
    return false;
  };
  const out: UndescribedValue[] = [];
  const walk = (value: unknown, path: string): void => {
    if (path !== '' && described(path)) return;
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) walk(child, path === '' ? key : `${path}.${key}`);
    } else if (path !== '') {
      out.push({ path, value });
    }
  };
  walk(stored, '');
  return out;
}

/** The built-in kind a stored value most likely has, or `undefined` when its shape says nothing. */
export function kindOfValue(value: unknown): string | undefined {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? 'color' : 'string';
  return undefined;
}
