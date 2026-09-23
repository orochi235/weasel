// Preference-schema vocabulary for PrefsForm / PrefsDialog / SelectionPanel:
// core's `ToolPref*` family under this package's names. Never re-declare them
// here — this was a hand-kept structural copy until it drifted, and the
// independence from `@weasel-js/core` it bought is long gone anyway.

export type {
  ToolPref as BuiltinPref,
  ToolPrefBoolean as PrefBoolean,
  ToolPrefBooleanControl as PrefBooleanControl,
  ToolPrefColor as PrefColor,
  ToolPrefCustom as PrefCustom,
  ToolPrefEnum as PrefEnum,
  ToolPrefEnumControl as PrefEnumControl,
  ToolPrefEnumEncoding as PrefEnumEncoding,
  ToolPrefGroup as PrefGroup,
  ToolPrefKind as PrefKind,
  ToolPrefLeaf as PrefLeaf,
  ToolPrefNumber as PrefNumber,
  ToolPrefNumberControl as PrefNumberControl,
  ToolPrefNumberFormat as PrefNumberFormat,
  ToolPrefNumberUnit as PrefNumberUnit,
  ToolPrefObject as PrefObject,
  ToolPrefPaint as PrefPaint,
  ToolPrefString as PrefString,
  ToolPrefStringControl as PrefStringControl,
} from '@weasel-js/core';

import type { UnitTable } from '../../format/number';
import type { ToolPrefGroup, ToolPrefLeaf, ToolPrefNumber, ToolPrefNumberUnit as PrefNumberUnitType } from '@weasel-js/core';

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
  p: ToolPrefNumber,
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

/** What a unit leaf's field reads as typed text: its `accepts` table, and its
 *  `suffix` as the display unit itself. */
export function prefUnitAccepts(unit: PrefNumberUnitType): Readonly<UnitTable> {
  return unit.suffix === undefined ? { ...unit.accepts } : { [unit.suffix]: 1, ...unit.accepts };
}

/** Distinguishes a leaf from a group while walking a schema tree. */
export function isPrefLeaf(node: ToolPrefLeaf | ToolPrefGroup): node is ToolPrefLeaf {
  return 'kind' in node;
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
 * that end up empty. Returns null when the entire subtree is hidden.
 */
export function visiblePrefSubtree<T extends ToolPrefLeaf | ToolPrefGroup>(
  node: T,
  showHidden: boolean,
): T | null {
  if (isPrefLeaf(node)) return node.hidden && !showHidden ? null : node;
  const group = node as ToolPrefGroup;
  const children: Record<string, ToolPrefLeaf | ToolPrefGroup> = {};
  for (const [key, child] of Object.entries(group.children)) {
    const kept = visiblePrefSubtree(child, showHidden);
    if (kept) children[key] = kept;
  }
  if (Object.keys(children).length === 0) return null;
  return { ...node, children };
}

/** One entry in a {@link PrefsForm} rail: a group the reader can navigate to. */
export interface PrefRailItem {
  /** Dotted path of the group. Empty for the entry holding loose root leaves. */
  path: string;
  name: string;
  /** 0 opens a pane; 1 scrolls within the open one. The rail goes no deeper. */
  depth: 0 | 1;
  /** Path of the depth-0 ancestor — its own path when `depth` is 0. */
  section: string;
  /** Leaves surviving the active filter, counted over the whole subtree. */
  matches: number;
}

/** Leaves anywhere under `node`, counted. */
function countPrefLeaves(node: ToolPrefLeaf | ToolPrefGroup): number {
  if (isPrefLeaf(node)) return 1;
  let n = 0;
  for (const child of Object.values(node.children)) n += countPrefLeaves(child);
  return n;
}

/**
 * The rail's model for a schema: depth-0 groups, each followed by its depth-1
 * children. Deeper groups render inside a pane and get no entry — a schema
 * that nests ten deep still navigates two levels.
 *
 * Loose leaves directly under the root lead the list under an entry named for
 * the root itself, since they belong to no group that could name them.
 */
export function prefRailItems(root: ToolPrefGroup): PrefRailItem[] {
  const items: PrefRailItem[] = [];
  const loose = Object.values(root.children).filter(isPrefLeaf).length;
  if (loose > 0) {
    items.push({ path: '', name: root.name, depth: 0, section: '', matches: loose });
  }
  for (const [key, child] of Object.entries(root.children)) {
    if (isPrefLeaf(child)) continue;
    items.push({
      path: key,
      name: child.name,
      depth: 0,
      section: key,
      matches: countPrefLeaves(child),
    });
    for (const [subKey, sub] of Object.entries(child.children)) {
      if (isPrefLeaf(sub)) continue;
      items.push({
        path: `${key}.${subKey}`,
        name: sub.name,
        depth: 1,
        section: key,
        matches: countPrefLeaves(sub),
      });
    }
  }
  return items;
}

/** Whether one leaf answers to a filter query, by name, description or path. */
function prefLeafMatches(pref: ToolPrefLeaf, path: string, query: string): boolean {
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
export function filterPrefSubtree<T extends ToolPrefLeaf | ToolPrefGroup>(
  node: T,
  query: string,
  path = '',
): T | null {
  const q = query.trim().toLowerCase();
  if (q === '') return node;
  if (isPrefLeaf(node)) return prefLeafMatches(node, path, q) ? node : null;
  const group = node as ToolPrefGroup;
  if (group.name.toLowerCase().includes(q)) return node;
  const children: Record<string, ToolPrefLeaf | ToolPrefGroup> = {};
  for (const [key, child] of Object.entries(group.children)) {
    const kept = filterPrefSubtree(child, q, path === '' ? key : `${path}.${key}`);
    if (kept) children[key] = kept;
  }
  if (Object.keys(children).length === 0) return null;
  return { ...node, children };
}
