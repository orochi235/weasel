import { isPrefLeaf } from '@weasel-js/prefs';
import { branchUnder, type ChildMap, type SchemaNode } from './schemaTree';

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

export function uniqueKey(kids: ChildMap, base: string): string {
  if (!Object.hasOwn(kids, base)) return base;
  let n = 2;
  while (Object.hasOwn(kids, `${base}${n}`)) n++;
  return `${base}${n}`;
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

export function checkKey(kids: ChildMap, key: string, dotted: boolean): void {
  const problem = keyProblem(kids, key, dotted);
  if (problem) throw new Error(`schemaEdit: ${problem}`);
}
