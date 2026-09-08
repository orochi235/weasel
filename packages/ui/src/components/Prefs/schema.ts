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
  ToolPrefNumberUnit as PrefNumberUnit,
  ToolPrefObject as PrefObject,
  ToolPrefPaint as PrefPaint,
  ToolPrefString as PrefString,
  ToolPrefStringControl as PrefStringControl,
} from '@weasel-js/core';

import type { ToolPrefGroup, ToolPrefLeaf, ToolPrefNumber } from '@weasel-js/core';

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
