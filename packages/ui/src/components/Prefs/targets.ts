import {
  applyPrefConditions,
  prefJudge,
  prefLeafAt,
  prefReader,
  visiblePrefSubtree,
  type PrefConditionJudge,
  type PrefConditionsApplied,
  type PrefGroup,
  type PrefLeaf,
  type PrefObject,
  type PrefSection,
} from '@weasel-js/prefs';
import { entryApplier, type EntryAt } from './entry';

/** What an alias row reads of the leaf it shows: the schema that leaf is in, as that schema's own conditions leave it. */
export interface AliasTargets {
  /** Says which conditions of that schema hold. */
  holds: PrefConditionJudge;
  /** The leaf at a path of that schema, without the fields the form would leave out of the leaf's own row: one
   *  marked `hidden`, and one a `showIf` hides, unless the form draws those. */
  leafAt: (path: string) => PrefLeaf | undefined;
  /** Whether the field at a path of that schema is one an `enableIf` disables. */
  disabledAt: (path: string) => boolean;
  /** Whether the field at a path of that schema is one a `showIf` hides, in a form that draws those. */
  hiddenAt?: (path: string) => boolean;
  /** An entry of a list or a map of that schema, as the conditions that read the entry leave it. */
  entryAt: EntryAt;
}

/** What a form draws beyond the default, which its alias rows follow. */
export interface AliasTargetsOptions {
  showHidden: boolean;
  markHidden: boolean;
}

/** `leaf` without its fields marked `hidden`. The leaf's own mark is not asked: an alias shows a leaf the form leaves out. */
function visibleFieldsOf(leaf: PrefLeaf): PrefLeaf {
  if (leaf.kind !== 'object') return leaf;
  const shown = visiblePrefSubtree({ ...leaf, hidden: false }, false, true) as PrefObject;
  return { ...leaf, children: shown.children } as PrefLeaf;
}

/**
 * {@link AliasTargets} over `over`, read at `values`. The form's own pass drops a leaf the form leaves out and keeps
 * no path of another schema, so the leaves aliases show are conditioned here, the first time a row asks.
 */
export function aliasTargets(over: PrefGroup | PrefSection, values: unknown, { showHidden, markHidden }: AliasTargetsOptions): AliasTargets {
  const read = prefReader(over, values);
  const holds = prefJudge(over, read);
  let applied: PrefConditionsApplied<PrefGroup | PrefSection> | undefined;
  const get = (): PrefConditionsApplied<PrefGroup | PrefSection> =>
    (applied ??= applyPrefConditions(over, holds, { keepEmpty: true, keepHidden: markHidden }));
  return {
    holds,
    leafAt: (path) => {
      const { shown } = get();
      const leaf = shown === null ? undefined : prefLeafAt(shown, path);
      return leaf === undefined || showHidden ? leaf : visibleFieldsOf(leaf);
    },
    disabledAt: (path) => get().disabled.has(path),
    ...(markHidden ? { hiddenAt: (path: string) => get().hidden.has(path) } : {}),
    entryAt: entryApplier((entry) => prefJudge(over, read, entry), markHidden),
  };
}
