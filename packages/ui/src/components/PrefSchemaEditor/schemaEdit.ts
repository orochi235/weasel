import { isPlainObject } from '@weasel-js/core';
import {
  isPrefLeaf,
  isPrefSection,
  type PrefGroup,
  type PrefLeaf,
  type PrefSection,
} from '@weasel-js/prefs';
import { prefFieldChoices } from '../Prefs/schema';

/** A schema the editor opens: a preferences schema, or a node's property schema. */
export type SchemaRoot = PrefGroup | PrefSection;
/** A node of a schema. Under a `PrefGroup` root a section appears only inside an `object` leaf. */
export type SchemaNode = PrefLeaf | PrefGroup | PrefSection;
export type ChildMap = Record<string, SchemaNode>;

/**
 * A node's address in the tree: the keys from the root down, joined by `/`. Not the path its value is stored at —
 * a section's key is no part of that one, and a leaf's key under a section may be a dotted path itself.
 */
const SEP = '/';

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

/** Whether `node`'s key under `parent` may be a dotted path: a leaf where sections nest is keyed by where its value lives. */
export function takesDottedKey(parent: SchemaNode, node: SchemaNode): boolean {
  return isPrefLeaf(node) && branchUnder(parent) === 'section';
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

/** The key a `list` or `map` leaf's one child, its `item`, sits under in the tree. */
export const ITEM = 'item';

/**
 * The attribute a node keeps the nodes under it in, or `undefined` for a node that holds none. A `list` or a `map`
 * holds exactly one, its `item`; the rest hold any number by key.
 */
export function slotOf(node: SchemaNode): 'children' | 'members' | 'variants' | typeof ITEM | undefined {
  if (isPrefSection(node)) return 'members';
  if (!isPrefLeaf(node)) return 'children';
  if (node.kind === 'object') return 'children';
  if (node.kind === 'union') return 'variants';
  return node.kind === 'list' || node.kind === 'map' ? ITEM : undefined;
}

/** The nodes under `node`, by key: a group's or an `object` leaf's children, a section's members, a `union`'s
 *  variants, or a `list`'s or `map`'s item under {@link ITEM}. `undefined` for anything that holds none. */
export function childrenOf(node: SchemaNode): ChildMap | undefined {
  const slot = slotOf(node);
  if (slot === undefined) return undefined;
  const held = (node as unknown as Record<string, unknown>)[slot];
  return slot === ITEM ? { [ITEM]: held as SchemaNode } : (held as ChildMap);
}

/** Whether the nodes under `node` are fixed: none can be added, removed, renamed or moved, only edited in place. */
export function holdsFixed(node: SchemaNode): boolean {
  return slotOf(node) === ITEM;
}

/** Whether the node at `path` is one its parent holds fixed, as a list's item is. */
export function isFixed(root: SchemaRoot, path: string | null): boolean {
  if (path === null) return false;
  const host = nodeAt(root, parentPath(path));
  return !!host && holdsFixed(host);
}

/** Which branch `parent` nests: a group holds groups, and an `object` leaf or a section holds sections. */
export function branchUnder(parent: SchemaNode): 'group' | 'section' {
  return isPrefLeaf(parent) || isPrefSection(parent) ? 'section' : 'group';
}

/** Whether `node` may be put directly under `parent`: any leaf, or the branch `parent` nests. A `union` takes only
 *  `object` leaves, its variants, and a `list` or a `map` takes nothing beside its item. */
export function fitsUnder(parent: SchemaNode, node: SchemaNode): boolean {
  if (holdsFixed(parent)) return false;
  if (isPrefLeaf(parent) && parent.kind === 'union') return isPrefLeaf(node) && node.kind === 'object';
  return isPrefLeaf(node) || (isPrefSection(node) ? 'section' : 'group') === branchUnder(parent);
}

function checkFits(parent: SchemaNode | undefined, node: SchemaNode): void {
  if (!parent || !childrenOf(parent) || fitsUnder(parent, node)) return;
  if (holdsFixed(parent)) throw new Error('schemaEdit: a list or a map holds only its item');
  if (isPrefLeaf(parent) && parent.kind === 'union') throw new Error('schemaEdit: only an object leaf is a variant');
  throw new Error(`schemaEdit: only a ${branchUnder(parent)} nests here`);
}

function checkLoose(root: SchemaRoot, path: string): void {
  if (isFixed(root, path)) throw new Error(`schemaEdit: ${path} is fixed in its parent`);
}

export function parentPath(path: string): string | null {
  const i = path.lastIndexOf(SEP);
  return i === -1 ? null : path.slice(0, i);
}

export function keyOf(path: string): string {
  return path.slice(path.lastIndexOf(SEP) + 1);
}

export function joinPath(parent: string | null, key: string): string {
  return parent === null ? key : `${parent}${SEP}${key}`;
}

/** The keys from the root down to `path`; none for the root. */
export function keysOf(path: string | null): string[] {
  return path === null ? [] : path.split(SEP);
}

/** The path `keys` lead to; `null`, the root, for none. */
export function pathOf(keys: readonly string[]): string | null {
  return keys.length === 0 ? null : keys.join(SEP);
}

/** Whether `path` lies beneath `ancestor`. */
export function isUnder(path: string, ancestor: string): boolean {
  return path.startsWith(`${ancestor}${SEP}`);
}

function ownChild(kids: ChildMap | undefined, key: string): SchemaNode | undefined {
  return kids && Object.hasOwn(kids, key) ? kids[key] : undefined;
}

export function nodeAt(root: SchemaRoot, path: string | null): SchemaNode | undefined {
  let cur: SchemaNode | undefined = root;
  for (const k of keysOf(path)) cur = cur && ownChild(childrenOf(cur), k);
  return cur;
}

export function uniqueKey(kids: ChildMap, base: string): string {
  if (!Object.hasOwn(kids, base)) return base;
  let n = 2;
  while (Object.hasOwn(kids, `${base}${n}`)) n++;
  return `${base}${n}`;
}

function withChildren(node: SchemaNode, kids: ChildMap): SchemaNode {
  const slot = slotOf(node)!;
  return { ...node, [slot]: slot === ITEM ? kids[ITEM] : kids } as SchemaNode;
}

/** `root` with the children of the node at `parent` replaced by `edit` of them. */
function editChildren<R extends SchemaRoot>(root: R, parent: string | null, edit: (kids: ChildMap) => ChildMap): R {
  const keys = keysOf(parent);
  const go = (node: SchemaNode, depth: number): SchemaNode => {
    const kids = childrenOf(node);
    const here = pathOf(keys.slice(0, depth)) ?? '(root)';
    if (!kids) throw new Error(`schemaEdit: ${here} cannot hold children`);
    if (depth === keys.length) return withChildren(node, edit(kids));
    const k = keys[depth]!;
    const child = kids[k];
    if (!child) throw new Error(`schemaEdit: no node at ${pathOf(keys.slice(0, depth + 1))}`);
    return withChildren(node, { ...kids, [k]: go(child, depth + 1) });
  };
  return go(root, 0) as R;
}

function insertAt(kids: ChildMap, entries: Array<[string, SchemaNode]>, index: number): ChildMap {
  const list = Object.entries(kids);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, ...entries);
  return Object.fromEntries(list);
}

/** Why `key` cannot join `kids`, in words for the person typing it; `null` when it can. `dotted`: see {@link takesDottedKey}. */
export function keyProblem(kids: ChildMap, key: string, dotted = false): string | null {
  const parts = dotted ? key.split('.') : [key];
  if (!parts.every(isValidKey)) {
    return `"${key}" is not a valid key: use letters, digits, _ or $, not starting with a digit${dotted ? ', with . between the steps of a path' : ''}.`;
  }
  if (parts.includes('__proto__')) return `"${key}" is reserved.`;
  if (Object.hasOwn(kids, key)) return `"${key}" is taken here.`;
  return null;
}

function checkKey(kids: ChildMap, key: string, dotted: boolean): void {
  const problem = keyProblem(kids, key, dotted);
  if (problem) throw new Error(`schemaEdit: ${problem}`);
}

export function addNode<R extends SchemaRoot>(root: R, parent: string | null, key: string, node: SchemaNode, index?: number): R {
  const host = nodeAt(root, parent);
  checkFits(host, node);
  return editChildren(root, parent, (kids) => {
    checkKey(kids, key, !!host && takesDottedKey(host, node));
    return insertAt(kids, [[key, node]], index ?? Object.keys(kids).length);
  });
}

export function removeNode<R extends SchemaRoot>(root: R, path: string): R {
  checkLoose(root, path);
  const key = keyOf(path);
  return editChildren(root, parentPath(path), (kids) => {
    const { [key]: _gone, ...rest } = kids;
    return rest;
  });
}

export function renameKey<R extends SchemaRoot>(root: R, path: string, next: string): R {
  const key = keyOf(path);
  if (next === key) return root;
  checkLoose(root, path);
  const host = nodeAt(root, parentPath(path));
  const node = nodeAt(root, path);
  const renamed = editChildren(root, parentPath(path), (kids) => {
    checkKey(kids, next, !!host && !!node && takesDottedKey(host, node));
    return Object.fromEntries(Object.entries(kids).map(([k, v]) => [k === key ? next : k, v]));
  });
  if (!host || !isPrefLeaf(host) || host.kind !== 'union') return renamed;
  // A variant's key is the tag its values carry, the union's own default among them.
  const { tag } = host as unknown as { tag: string };
  return replaceNode(renamed, parentPath(path), (union) => {
    const held = (union as PrefLeaf).default;
    if (held === null || typeof held !== 'object' || (held as Record<string, unknown>)[tag] !== key) return union;
    return { ...union, default: { ...held, [tag]: next } } as SchemaNode;
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

/** Set one attribute; `undefined` removes it. Every other field keeps its value, functions included. */
export function setAttribute<R extends SchemaRoot>(root: R, path: string | null, key: string, value: unknown): R {
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
 * tree, `root` itself when nothing ends up anywhere new, and each moved node's old path in `from` beside its new
 * one in `paths`.
 */
export function moveNodes<R extends SchemaRoot>(
  root: R, paths: readonly string[], target: SchemaTarget,
): { root: R; from: string[]; paths: string[] } {
  const tops = paths.filter((p) => !paths.some((q) => isUnder(p, q)));
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
  const from = moving.map((m) => m.path);
  const settled = Object.keys(childrenOf(nodeAt(next, dest) ?? next) ?? {});
  if (out.every((p, i) => p === from[i]) && settled.every((k, i) => k === destKeys[i])) return { root, from, paths: from };
  return { root: next, from, paths: out };
}

/** Every path whose node can hold children, in tree order. */
export function branchPaths(root: SchemaRoot): string[] {
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
    const hit = moves.find(([from]) => p === from || isUnder(p, from));
    out.add(hit ? hit[1] + p.slice(hit[0].length) : p);
  }
  return out;
}

/** A value stored under a dotted value path no leaf of the schema describes. */
export interface UndescribedValue {
  path: string;
  value: unknown;
}

/**
 * Each value in `stored` that no leaf of `root` describes, by its dotted path, in stored order. A leaf's own path
 * and everything under it are described; a plain object anywhere else is walked rather than listed.
 */
export function undescribedValues(root: SchemaRoot, stored: unknown): UndescribedValue[] {
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
