import type { PrefGroup, PrefLeaf } from '@weasel-js/ui';

/**
 * Reading and writing a config tree by dotted path. A schema's leaves address
 * their values this way, so a leaf nested under `f.group` and a flat one are
 * reached by exactly the same call.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value at a dotted path. `undefined` when a segment is missing or the
 *  walk hits something that is not a record. */
export function valueAtPath(config: unknown, path: string): unknown {
  let cur = config;
  for (const segment of path.split('.')) {
    if (!isRecord(cur)) return undefined;
    cur = cur[segment];
  }
  return cur;
}

/** Whether a dotted path is actually present, which a `undefined` value is
 *  not enough to tell you. */
export function hasConfigPath(config: unknown, path: string): boolean {
  let cur = config;
  for (const segment of path.split('.')) {
    if (!isRecord(cur) || !(segment in cur)) return false;
    cur = cur[segment];
  }
  return true;
}

function writeIn(node: unknown, segments: readonly string[], value: unknown): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) return value;
  const base = isRecord(node) ? node : {};
  return { ...base, [head]: rest.length === 0 ? value : writeIn(base[head], rest, value) };
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
    out[key] = fillConfigDefaults(base[key], value);
  }
  return out as T;
}

/** A node in a resolved schema tree, by dotted path. Structural rather than
 *  `isPrefLeaf` so this stays free of a runtime import. */
export function schemaNodeAtPath(group: PrefGroup, path: string): PrefLeaf | PrefGroup | undefined {
  let node: PrefLeaf | PrefGroup | undefined = group;
  for (const segment of path.split('.')) {
    if (node === undefined || !('children' in node)) return undefined;
    node = node.children[segment];
  }
  return node;
}
