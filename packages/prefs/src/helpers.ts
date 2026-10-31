import type { Endless } from '@weasel-js/quantity';
import { matchQuery } from '@weasel-js/registry';
import { prefAliasedLeaf, prefAliasTarget, type PrefAlias } from './alias';
import type { PrefGroup, PrefSection } from './groups';
import type { PrefLeaf, PrefNumber, PrefObject } from './schema';
import { resolvePrefUnit } from './unit';

/**
 * A number leaf's bounds in the unit it is displayed in.
 *
 * Only what the leaf declares converts: an omitted bound has no stored
 * counterpart to put through the conversion, and its fallback — 0..100 for a
 * slider's track, a step of 1 — is a display-space number already. `min` and
 * `max` are points, so they convert the way the value does; `step` is a
 * distance, and a unit with an offset maps zero somewhere else, so converting
 * it as a point would scale it wrong; `stops` are points. A decreasing
 * conversion swaps which end is the lower one, and which end is `endless`.
 */
export function prefDisplayBounds(
  p: PrefNumber,
): { min?: number; max?: number; step: number; endless?: Endless; stops?: readonly number[] } {
  const ends = p.endless === undefined ? {} : { endless: p.endless };
  if (!p.unit) return { min: p.min, max: p.max, step: p.step ?? 1, ...ends, ...(p.stops ? { stops: p.stops } : {}) };
  const { toDisplay } = resolvePrefUnit(p.unit);
  const backward = toDisplay(1) < toDisplay(0);
  const lo = p.min === undefined ? undefined : toDisplay(p.min);
  const hi = p.max === undefined ? undefined : toDisplay(p.max);
  const flipped = lo !== undefined && hi !== undefined && lo > hi;
  const step = p.step === undefined
    ? 1
    : Math.abs(toDisplay(p.step) - toDisplay(0)) || p.step;
  const flip = { min: 'max', max: 'min', both: 'both' } as const;
  const endless = backward && p.endless !== undefined ? flip[p.endless] : p.endless;
  const stops = p.stops?.map(toDisplay);
  return {
    min: flipped ? hi : lo,
    max: flipped ? lo : hi,
    step,
    ...(endless === undefined ? {} : { endless }),
    ...(stops ? { stops } : {}),
  };
}

/** Distinguishes a leaf from a group or a section while walking a schema tree. */
export function isPrefLeaf(node: PrefLeaf | PrefGroup | PrefSection): node is PrefLeaf {
  return 'kind' in node;
}

const VALUELESS: ReadonlySet<string> = new Set(['action', 'actions', 'alias', 'label', 'separator']);

/** Whether a leaf has a value to store: an `action` is a button and holds none, nor does an `actions` run of them, an `alias` shows another leaf's,
 *  and a `label` and a `separator` are text and a rule. */
export function prefHoldsValue(leaf: PrefLeaf): boolean {
  return !VALUELESS.has(leaf.kind);
}

/** Distinguishes a section, whose key adds nothing to a path, from a group, whose key is a segment. */
export function isPrefSection(node: PrefLeaf | PrefGroup | PrefSection): node is PrefSection {
  return !isPrefLeaf(node) && 'members' in node;
}

/**
 * Every leaf under a section's `members` or an object leaf's `children`, in
 * schema order, by its own key: the sections between contribute nothing.
 */
export function prefSectionLeaves(members: PrefSection['members']): [key: string, leaf: PrefLeaf][] {
  return Object.entries(members).flatMap(([key, child]): [string, PrefLeaf][] =>
    isPrefLeaf(child) ? [[key, child]] : prefSectionLeaves(child.members),
  );
}

/**
 * The leaf whose value lives at `path`, as the schema's own shape builds
 * paths: a segment per key under a {@link PrefGroup}, the leaf's own key
 * under a {@link PrefSection}. `undefined` for a path that names a group, a
 * field inside an `object` leaf, or nothing.
 */
export function prefLeafAt(schema: PrefGroup | PrefSection, path: string): PrefLeaf | undefined {
  if (isPrefSection(schema)) return prefSectionLeaves(schema.members).find(([key]) => key === path)?.[1];
  let node: PrefLeaf | PrefGroup = schema;
  for (const seg of path.split('.')) {
    if (isPrefLeaf(node) || !Object.hasOwn(node.children, seg)) return undefined;
    node = node.children[seg]!;
  }
  return isPrefLeaf(node) ? node : undefined;
}

/** Get the value at a dotted path inside a nested value tree. Returns
 *  `undefined` when a segment is missing or hits a non-object. */
export function prefValueAtPath(values: unknown, path: string): unknown {
  let cur: unknown = values;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object' || !Object.hasOwn(cur, seg)) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** An object leaf's fields without the `hidden` ones, and without the sections that leaves empty (unless `keepEmpty`). */
function visibleFields(fields: PrefObject['children'], keepEmpty: boolean): PrefObject['children'] {
  const out: PrefObject['children'] = {};
  for (const [key, child] of Object.entries(fields)) {
    if (isPrefLeaf(child)) {
      const kept = visiblePrefSubtree(child, false, keepEmpty);
      if (kept) out[key] = kept;
      continue;
    }
    const members = visibleFields(child.members, keepEmpty);
    if (Object.keys(members).length > 0 || keepEmpty) out[key] = { ...child, members };
  }
  return out;
}

/**
 * Recursively drop `hidden` leaves (unless `showHidden`), an object leaf's
 * hidden fields among them, pruning groups
 * that end up empty (unless `keepEmpty`). Returns null when the entire
 * subtree is pruned.
 */
export function visiblePrefSubtree<T extends PrefLeaf | PrefGroup>(
  node: T,
  showHidden: boolean,
  keepEmpty = false,
): T | null {
  if (isPrefLeaf(node)) {
    if (node.hidden && !showHidden) return null;
    if (showHidden || node.kind !== 'object') return node;
    return { ...node, children: visibleFields((node as PrefObject).children, keepEmpty) };
  }
  const group = node as PrefGroup;
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  for (const [key, child] of Object.entries(group.children)) {
    const kept = visiblePrefSubtree(child, showHidden, keepEmpty);
    if (kept) children[key] = kept;
  }
  if (Object.keys(children).length === 0 && !keepEmpty) return null;
  return { ...node, children };
}

/** The record holding the schema version the stored values were written at.
 *  Reserved: no top-level schema key may take its name. */
export const VERSION_RECORD = '$version';

/** Every leaf under `schema`, by dotted path, in schema order. A group's key
 *  is a segment; {@link prefSectionLeaves} is the walk for a section. */
export function prefLeaves(schema: PrefGroup): Map<string, PrefLeaf> {
  const out = new Map<string, PrefLeaf>();
  const walk = (group: PrefGroup, prefix: string): void => {
    for (const [key, child] of Object.entries(group.children)) {
      if (key.includes('.')) {
        throw new Error(`[prefs] schema key "${key}" contains "."; group keys are path segments`);
      }
      if (prefix === '' && key === VERSION_RECORD) {
        throw new Error(`[prefs] schema key "${VERSION_RECORD}" is reserved`);
      }
      const path = prefix === '' ? key : `${prefix}.${key}`;
      if (isPrefLeaf(child)) out.set(path, child);
      else walk(child, path);
    }
  };
  walk(schema, '');
  return out;
}

/** Set `key` on `tree` itself. Plain assignment to `__proto__` replaces the
 *  tree's prototype instead, and a schema key or a record name may be one. */
export function setOwnPrefValue(tree: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(tree, key, { value, writable: true, enumerable: true, configurable: true });
}

/** Set `value` at the dotted `path` in `root` itself, creating missing branches. */
export function assignPrefValueAtPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor = root;
  for (const part of parts.slice(0, -1)) {
    if (!Object.hasOwn(cursor, part) || cursor[part] == null) setOwnPrefValue(cursor, part, {});
    cursor = cursor[part] as Record<string, unknown>;
  }
  setOwnPrefValue(cursor, parts[parts.length - 1]!, value);
}

/** Each of `schema`'s leaves that `tree` holds a value for, as a path and
 *  that value — the inverse of building a tree from per-leaf records. */
export function flattenPrefValues(schema: PrefGroup, tree: unknown): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const path of prefLeaves(schema).keys()) {
    const value = prefValueAtPath(tree, path);
    if (value !== undefined) out.push([path, value]);
  }
  return out;
}

/** Whether one leaf answers to a filter query, by name, description, path or tag. */
function prefLeafMatches(pref: PrefLeaf, path: string, query: string): boolean {
  return matchQuery(query, { text: [pref.name, pref.description, path], tags: pref.tags }) !== null;
}

/**
 * Drop every leaf that does not answer to `query`, pruning groups left empty.
 * A group whose own name or tag matches keeps all of its leaves. An empty or
 * whitespace query matches everything.
 *
 * An alias answers as the row it draws: its target's name and description
 * where it gives none. That target is looked for in `over`, and in `node`
 * without it; pass the whole schema when `node` is a part of it.
 */
export function filterPrefSubtree<T extends PrefLeaf | PrefGroup>(
  node: T,
  query: string,
  path = '',
  over?: PrefGroup | PrefSection,
): T | null {
  const q = query.trim().toLowerCase();
  if (q === '') return node;
  const within = over ?? (isPrefLeaf(node) ? undefined : (node as PrefGroup));
  const find = (p: string): PrefLeaf | undefined => within && prefLeafAt(within, p);
  if (isPrefLeaf(node)) {
    const target = node.kind === 'alias' ? prefAliasTarget(node as PrefAlias, find) : undefined;
    const drawn = target ? prefAliasedLeaf(node as PrefAlias, target.leaf) : node;
    return prefLeafMatches(drawn, path, q) ? node : null;
  }
  const group = node as PrefGroup;
  if (matchQuery(q, { text: [group.name], tags: group.tags }) !== null) return node;
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  for (const [key, child] of Object.entries(group.children)) {
    const kept = filterPrefSubtree(child, q, path === '' ? key : `${path}.${key}`, within);
    if (kept) children[key] = kept;
  }
  if (Object.keys(children).length === 0) return null;
  return { ...node, children };
}
