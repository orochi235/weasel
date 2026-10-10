import type { PrefGroup, PrefSection } from './groups';
import type { PrefLeaf, PrefNumber } from './schema';

/**
 * A number leaf's bounds in the unit it is displayed in.
 *
 * Only what the leaf declares converts: an omitted bound has no stored
 * counterpart to put through the conversion, and its fallback — 0..100 for a
 * slider's track, a step of 1 — is a display-space number already. `min` and
 * `max` are points, so they convert the way the value does; `step` is a
 * distance, and a unit with an offset maps zero somewhere else, so converting
 * it as a point would scale it wrong. A decreasing conversion swaps which end
 * is the lower one.
 */
export function prefDisplayBounds(
  p: PrefNumber,
): { min?: number; max?: number; step: number } {
  if (!p.unit) return { min: p.min, max: p.max, step: p.step ?? 1 };
  const { toDisplay } = p.unit;
  const lo = p.min === undefined ? undefined : toDisplay(p.min);
  const hi = p.max === undefined ? undefined : toDisplay(p.max);
  const flipped = lo !== undefined && hi !== undefined && lo > hi;
  const step = p.step === undefined
    ? 1
    : Math.abs(toDisplay(p.step) - toDisplay(0)) || p.step;
  return { min: flipped ? hi : lo, max: flipped ? lo : hi, step };
}

/** Distinguishes a leaf from a group or a section while walking a schema tree. */
export function isPrefLeaf(node: PrefLeaf | PrefGroup | PrefSection): node is PrefLeaf {
  return 'kind' in node;
}

/** Whether a leaf has a value to store: an `action` is a button, and holds none. */
export function prefHoldsValue(leaf: PrefLeaf): boolean {
  return leaf.kind !== 'action';
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

/** Get the value at a dotted path inside a nested value tree. Returns
 *  `undefined` when a segment is missing or hits a non-object. */
export function prefValueAtPath(values: unknown, path: string): unknown {
  let cur: unknown = values;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Recursively drop `hidden` leaves (unless `showHidden`), pruning groups
 * that end up empty (unless `keepEmpty`). Returns null when the entire
 * subtree is pruned.
 */
export function visiblePrefSubtree<T extends PrefLeaf | PrefGroup>(
  node: T,
  showHidden: boolean,
  keepEmpty = false,
): T | null {
  if (isPrefLeaf(node)) return node.hidden && !showHidden ? null : node;
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

/** Set `value` at the dotted `path` in `root` itself, creating missing branches. */
export function assignPrefValueAtPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = (cursor[parts[i]!] ??= {}) as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
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

/** Whether one leaf answers to a filter query, by name, description or path. */
function prefLeafMatches(pref: PrefLeaf, path: string, query: string): boolean {
  if (pref.name.toLowerCase().includes(query)) return true;
  if (pref.description?.toLowerCase().includes(query)) return true;
  return path.toLowerCase().includes(query);
}

/**
 * Drop every leaf that does not answer to `query`, pruning groups left empty.
 * A group whose own name matches keeps all of its leaves — a reader who typed
 * the group's name is asking for the group, not for leaves repeating it.
 *
 * An empty or whitespace query matches everything, so a cleared field restores
 * the tree rather than emptying it.
 */
export function filterPrefSubtree<T extends PrefLeaf | PrefGroup>(
  node: T,
  query: string,
  path = '',
): T | null {
  const q = query.trim().toLowerCase();
  if (q === '') return node;
  if (isPrefLeaf(node)) return prefLeafMatches(node, path, q) ? node : null;
  const group = node as PrefGroup;
  if (group.name.toLowerCase().includes(q)) return node;
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  for (const [key, child] of Object.entries(group.children)) {
    const kept = filterPrefSubtree(child, q, path === '' ? key : `${path}.${key}`);
    if (kept) children[key] = kept;
  }
  if (Object.keys(children).length === 0) return null;
  return { ...node, children };
}
