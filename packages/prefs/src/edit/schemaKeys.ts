import { setOwn } from '@weasel-js/registry';
import { isPrefLeaf, isPrefSection, prefHoldsValue } from '../index';
import { branchUnder, childrenOf, joinPath, nodeAt, parentPath, type ChildMap, type SchemaNode, type SchemaRoot } from './schemaTree';

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
  return undigit(key);
}

/** `key` with `_` before a leading digit, which no key may start with. */
export function undigit(key: string): string {
  return /^\d/.test(key) ? `_${key}` : key;
}

/** `base`, or `base` with the first number from 2 that no key of `kids` holds. */
export function uniqueKey(kids: Readonly<Record<string, unknown>>, base: string): string {
  if (!Object.hasOwn(kids, base)) return base;
  let n = 2;
  while (Object.hasOwn(kids, `${base}${n}`)) n++;
  return `${base}${n}`;
}

const taken = (key: string): string => `"${key}" is taken here.`;
const nested = (inner: string, outer: string): string => `"${inner}" would hold its value inside "${outer}"'s.`;

const holdsValue = (node: SchemaNode): boolean => isPrefLeaf(node) && prefHoldsValue(node);

/** The leaf key of `a` and `b` that names a path inside the other's value; `undefined` for neither. */
const insideOf = (a: string, b: string): [inner: string, outer: string] | undefined =>
  (a.startsWith(`${b}.`) ? [a, b] : b.startsWith(`${a}.`) ? [b, a] : undefined);

/** `key`, or `key` with the first number from 2 after its first step, so that no key of `kids` holds it and no leaf
 *  of `kids` holds a value inside it or around it: a free key for a leaf, as {@link uniqueKey} is for any node. */
export function uniqueLeafKey(kids: ChildMap, key: string): string {
  const free = (k: string): boolean => !Object.hasOwn(kids, k) && Object.entries(kids).every(([at, kid]) => !holdsValue(kid) || !insideOf(k, at));
  if (free(key)) return key;
  const [head, ...rest] = key.split('.');
  let n = 2;
  while (!free([`${head}${n}`, ...rest].join('.'))) n++;
  return [`${head}${n}`, ...rest].join('.');
}

/** Why `key` cannot join `kids`, in words for the person typing it; `null` when it can. `kids` is what
 *  {@link keysTakenAt} gives for where the node goes, and `self` the node being re-keyed, if one is. `dotted`: see
 *  {@link takesDottedKey}; such a key may not name a path inside the value of a leaf holding one, nor around it. */
export function keyProblem(kids: ChildMap, key: string, dotted = false, self?: SchemaNode): string | null {
  const parts = dotted ? key.split('.') : [key];
  if (!parts.every(isValidKey)) {
    return `"${key}" is not a valid key: use letters, digits, _ or $, not starting with a digit${dotted ? ', with . between the steps of a path' : ''}.`;
  }
  if (parts.includes('__proto__')) return `"${key}" is reserved.`;
  if (Object.hasOwn(kids, key)) return taken(key);
  if (!dotted) return null;
  for (const [k, kid] of Object.entries(kids)) {
    const pair = kid !== self && holdsValue(kid) ? insideOf(key, k) : undefined;
    if (pair) return nested(...pair);
  }
  return null;
}

/** `visit` for every leaf and section under `host`, through the sections it nests and no further. */
function eachScoped(host: SchemaNode, path: string | null, visit: (key: string, node: SchemaNode, path: string) => void): void {
  for (const [key, kid] of Object.entries(childrenOf(host) ?? {})) {
    const at = joinPath(path, key);
    if (!isPrefLeaf(kid) && !isPrefSection(kid)) continue;
    visit(key, kid, at);
    if (isPrefSection(kid)) eachScoped(kid, at, visit);
  }
}

/**
 * The keys a node joining the children of `parent` may not take, as the nodes that hold them: its siblings', and
 * for a leaf where sections nest, every leaf's in whichever section. A section's key is no part of a value path,
 * so two leaves keyed alike under one section root, or inside one `object` leaf, would hold one value.
 *
 * Under a section root a leaf may not take a section's key either, nor a section a leaf's: a properties panel is
 * told what to mark in one list, a leaf by its key and a section by its own.
 */
export function keysTakenAt(root: SchemaRoot, parent: string | null, leaf: boolean): ChildMap {
  const host = nodeAt(root, parent) ?? root;
  const kids = childrenOf(host) ?? {};
  if (branchUnder(host) !== 'section') return kids;
  let top = parent;
  while (top !== null && isPrefSection(nodeAt(root, top)!)) top = parentPath(top);
  // Climbing out of every section without meeting an `object` leaf leaves the root, which is then a section.
  const panelNames = top === null;
  if (!leaf && !panelNames) return kids;
  const out: ChildMap = { ...kids };
  eachScoped(nodeAt(root, top) ?? root, top, (key, held) => {
    if (isPrefLeaf(held) || (leaf && panelNames)) setOwn(out, key, held);
  });
  return out;
}

/**
 * The nodes {@link keysTakenAt} would refuse each other's key, by tree path, each with what {@link keyProblem}
 * says of its key: leaves that share a value path, and under a section root a leaf and a section named alike. No
 * edit here makes one, but a schema made elsewhere can hold them.
 */
export function keyClashes(root: SchemaRoot): Map<string, string> {
  const out = new Map<string, string>();
  const scope = (host: SchemaNode, path: string | null): void => {
    const [leaves, sections] = [new Map<string, string[]>(), new Map<string, string[]>()];
    const valued = new Set<string>();
    eachScoped(host, path, (key, node, at) => {
      const held = isPrefLeaf(node) ? leaves : sections;
      held.set(key, [...(held.get(key) ?? []), at]);
      if (holdsValue(node)) valued.add(key);
    });
    for (const [key, paths] of leaves) {
      const named = path === null && isPrefSection(host) ? sections.get(key) ?? [] : [];
      if (paths.length + named.length > 1) for (const at of [...paths, ...named]) out.set(at, taken(key));
      for (const other of valued) {
        const pair = valued.has(key) ? insideOf(key, other) : undefined;
        if (pair && pair[0] === key) for (const at of [...paths, ...leaves.get(other)!]) if (!out.has(at)) out.set(at, nested(...pair));
      }
    }
  };
  const walk = (node: SchemaNode, path: string | null): void => {
    if (path === null || !isPrefSection(node)) scope(node, path);
    for (const [key, kid] of Object.entries(childrenOf(node) ?? {})) walk(kid, joinPath(path, key));
  };
  walk(root, null);
  return out;
}

export function checkKey(kids: ChildMap, key: string, dotted: boolean, self?: SchemaNode): void {
  const problem = keyProblem(kids, key, dotted, self);
  if (problem) throw new Error(`schemaEdit: ${problem}`);
}
