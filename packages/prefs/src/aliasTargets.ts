// The leaves a surface's aliases show: the schema they point into, as that
// schema's own conditions leave it. Every surface that draws an alias asks
// here, whether the schema is its own or another's.

import { prefAliasedLeaf, prefAliasTarget, type PrefAlias } from './alias';
import type { PrefGroup, PrefSection } from './groups';
import { prefLeafAt, visiblePrefSubtree } from './helpers';
import type { PrefConditionJudge, PrefEntry } from './judge';
import type { PrefLeaf, PrefObject } from './schema';
import { applyPrefConditions, applyPrefEntryConditions, type PrefConditionsApplied, type PrefEntryApplied } from './scope';

/** What an alias row reads of the leaf it shows: the schema that leaf is in, as that schema's own conditions leave it. */
export interface PrefAliasTargets {
  /** Says which conditions of that schema hold. */
  holds: PrefConditionJudge;
  /** The leaf at a path of that schema, without the fields the surface would leave out of the leaf's own row: one
   *  marked `hidden`, and one a `showIf` hides, unless the surface draws those. */
  leafAt: (path: string) => PrefLeaf | undefined;
  /** The leaf `alias` is drawn as, under the alias's own name and description where it gives them, and the path
   *  its value is read and written at. `undefined` for an alias of nothing. */
  shown: (alias: PrefAlias) => { path: string; leaf: PrefLeaf } | undefined;
  /** Whether the field at a path of that schema is one an `enableIf` disables. */
  disabledAt: (path: string) => boolean;
  /** Whether the field at a path of that schema is one a `showIf` hides, on a surface that draws those. */
  hiddenAt?: (path: string) => boolean;
  /** An entry of a list or a map of that schema, as the conditions that read the entry leave it. */
  entryAt: (item: PrefLeaf, path: string, value: unknown) => PrefEntryApplied;
}

/** What a surface draws beyond the default, which its alias rows follow. */
export interface PrefAliasTargetsOptions {
  /** The surface draws fields marked `hidden`. */
  showHidden?: boolean;
  /** The surface draws what a `showIf` hides, marked. */
  markHidden?: boolean;
}

/** `leaf` without its fields marked `hidden`. The leaf's own mark is not asked: an alias shows a leaf the surface leaves out. */
function visibleFieldsOf(leaf: PrefLeaf): PrefLeaf {
  if (leaf.kind !== 'object') return leaf;
  const shown = visiblePrefSubtree({ ...leaf, hidden: false }, false, true) as PrefObject;
  return { ...leaf, children: shown.children } as PrefLeaf;
}

/**
 * {@link PrefAliasTargets} over `over`, the schema a surface's aliases point
 * into: the surface's own, or another's. `judge` answers `over`'s conditions
 * as the surface reads values, for one entry of a list or a map where it is
 * given one: `prefJudge` over `over`. A surface's own pass drops a leaf it
 * leaves out and keeps no path of another schema, so the leaves aliases show
 * are conditioned here, the first time one is asked for.
 */
export function prefAliasTargets(
  over: PrefGroup | PrefSection,
  judge: (entry?: PrefEntry) => PrefConditionJudge,
  { showHidden = false, markHidden = false }: PrefAliasTargetsOptions = {},
): PrefAliasTargets {
  const holds = judge();
  let applied: PrefConditionsApplied<PrefGroup | PrefSection> | undefined;
  const get = (): PrefConditionsApplied<PrefGroup | PrefSection> =>
    (applied ??= applyPrefConditions(over, holds, { keepEmpty: true, keepHidden: markHidden }));
  const leafAt = (path: string): PrefLeaf | undefined => {
    const { shown } = get();
    const leaf = shown === null ? undefined : prefLeafAt(shown, path);
    return leaf === undefined || showHidden ? leaf : visibleFieldsOf(leaf);
  };
  return {
    holds,
    leafAt,
    shown: (alias) => {
      const target = prefAliasTarget(alias, leafAt);
      return target && { path: target.path, leaf: prefAliasedLeaf(alias, target.leaf) };
    },
    disabledAt: (path) => get().disabled.has(path),
    ...(markHidden ? { hiddenAt: (path: string) => get().hidden.has(path) } : {}),
    entryAt: (item, path, value) => applyPrefEntryConditions(item, path, judge({ item, value }), { keepHidden: markHidden }),
  };
}
