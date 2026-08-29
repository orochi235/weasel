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

import type { ToolPrefGroup, ToolPrefLeaf } from '@weasel-js/core';

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
