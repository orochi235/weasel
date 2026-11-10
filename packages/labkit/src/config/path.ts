import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { isPlainObject } from '@weasel-js/registry';

/**
 * Reading and writing a config tree by dotted path. A schema's leaves address
 * their values this way, so a leaf nested under `f.group` and a flat one are
 * reached by exactly the same call.
 */

/** A plain object a config tree can be walked into. An array, a `Date`, a
 *  `Map` or a class instance is a leaf value: a walk that descended into one
 *  would rebuild it as a bare `{}`. */
export const isRecord = isPlainObject;

/** `record`'s own value at `key`: a key every object inherits, `constructor` or `toString`, is absent. */
const ownAt = (record: Record<string, unknown>, key: string): unknown =>
  Object.hasOwn(record, key) ? record[key] : undefined;

/** Assignment would run `__proto__`'s setter and change the prototype instead. */
const setOwn = (record: Record<string, unknown>, key: string, value: unknown): void => {
  Object.defineProperty(record, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
};

/** The value at a dotted path. `undefined` when a segment is missing or the
 *  walk hits something that is not a record. */
export function valueAtPath(config: unknown, path: string): unknown {
  let cur = config;
  for (const segment of path.split('.')) {
    if (!isRecord(cur)) return undefined;
    cur = ownAt(cur, segment);
  }
  return cur;
}

/** Whether a dotted path is actually present, which a `undefined` value is
 *  not enough to tell you. */
export function hasConfigPath(config: unknown, path: string): boolean {
  let cur = config;
  for (const segment of path.split('.')) {
    if (!isRecord(cur) || !Object.hasOwn(cur, segment)) return false;
    cur = cur[segment];
  }
  return true;
}

/** A copy of `value` down through every array and plain record in it; any
 *  other value is shared, as the walks here treat it as a leaf. */
export function copyTree<T>(value: T, copies = new Map<object, unknown>()): T {
  if (!Array.isArray(value) && !isRecord(value)) return value;
  const seen = copies.get(value);
  if (seen !== undefined) return seen as T;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    copies.set(value, out);
    for (const v of value) out.push(copyTree(v, copies));
    return out as T;
  }
  const out: Record<string, unknown> = {};
  copies.set(value, out);
  for (const [key, v] of Object.entries(value)) setOwn(out, key, copyTree(v, copies));
  return out as T;
}

function writeIn(node: unknown, segments: readonly string[], value: unknown): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) return value;
  const base = isRecord(node) ? node : {};
  return { ...base, [head]: rest.length === 0 ? value : writeIn(ownAt(base, head), rest, value) };
}

/** A copy of `config` with `value` written at a dotted path. Every record on
 *  the way down is copied and the input is left alone; a missing — or
 *  non-record — intermediate is replaced with the branch the path implies. */
export function withValueAtPath<T>(config: T, path: string, value: unknown): T {
  return writeIn(config, path.split('.'), value) as T;
}

/**
 * `stored` with every gap filled from `defaults`, down the whole tree.
 *
 * This is how a config written before its schema grew a branch still loads:
 * the branch arrives at its defaults instead of `undefined`, and a key the
 * defaults no longer mention is kept rather than dropped, so nothing is lost
 * to a schema change the author has not finished making.
 */
export function fillConfigDefaults<T>(stored: unknown, defaults: T): T {
  if (!isRecord(defaults)) return (stored === undefined ? defaults : stored) as T;
  const base = isRecord(stored) ? stored : {};
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(defaults)) {
    setOwn(out, key, fillConfigDefaults(ownAt(base, key), value));
  }
  return out as T;
}

/** A node in a resolved schema tree, by dotted path: a group's key and an
 *  object leaf's field key are segments, a section's key is not. Structural
 *  rather than `isPrefLeaf` so this stays free of a runtime import. */
export function schemaNodeAtPath(group: PrefGroup, path: string): PrefLeaf | PrefGroup | undefined {
  let node: PrefLeaf | PrefGroup | undefined = group;
  for (const segment of path.split('.')) {
    if (node === undefined || !('children' in node)) return undefined;
    const next: PrefLeaf | PrefGroup | PrefSection | undefined = Object.hasOwn(
      node.children,
      segment,
    )
      ? node.children[segment]
      : undefined;
    if (next !== undefined && 'members' in next) return undefined;
    node = next;
  }
  return node;
}
