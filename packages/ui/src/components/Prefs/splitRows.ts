import { useCallback, useId, useMemo, useState } from 'react';
import {
  prefLeafAt,
  prefScopeValue,
  prefScopeSelectors,
  prefValueAtPath,
  prefOverrideOptions,
  prefOverridesOf,
  prefScopesOf,
  type PrefEnum,
  type PrefGroup,
  type PrefLeaf,
  type PrefScope,
  type PrefSection,
  type PrefSelection,
  type PrefOverrides,
} from '@weasel-js/prefs';

/** What a form is given to draw and edit the values its leaves hold split. */
export interface PrefSplitProps {
  /** What each split leaf holds, by the path its value is stored at: `store.scopes()`. A pref with `scopes`
   *  and is named here draws a marker for the option each of its selectors is set to, and opens to a control
   *  for every option. `values` still holds the one value such a pref reads as. */
  scopes?: ReadonlyMap<string, PrefScope>;
  /** The reader asked for the pref's value to be held once per option of the selector at `by`, one of its
   *  `scopes` selectors. Given, a pref offers it for each selector its value is not split by. */
  onSplit?: (path: string, by: string) => void;
  /** The reader asked for the pref's value to be one again across the selector at `by`. Given, a pref offers it
   *  for each selector its value is split by. */
  onJoin?: (path: string, by: string) => void;
  /** An edit of one value of a scoped pref: the one `at` names, an option for each selector the value is
   *  split by. Without it a split row does not open. An edit of the row itself goes to `onChange`. */
  onChangeAt?: (path: string, value: unknown, at: PrefSelection) => void;
  /** What the one row standing for every option a pref's overrides leave out is called. Default `Others`. */
  othersLabel?: string;
  /** Paths of the split rows open to their values before the reader opens or shuts one. Which are open is the
   *  form's own state from then on. Default: none. */
  defaultSplitOpen?: readonly string[];
}

/** What a form's rows read to draw split values: the form's props, its schema's selectors, and which rows are open. */
export interface SplitCtx extends Omit<PrefSplitProps, 'defaultSplitOpen'> {
  /** The leaf a `scopes` entry names. `aliased` asks the schema the form's aliases point into. */
  selectorAt: (path: string, aliased: boolean) => PrefLeaf | undefined;
  /** The paths of the rows open to their values. */
  opened: ReadonlySet<string>;
  setOpen: (path: string, open: boolean) => void;
  /** The `id` of the element the row at `path` opens to, unique to this form. */
  bodyId: (path: string) => string;
}

/** One selector a pref's value is split by. */
export interface SplitLevel {
  /** The selector's path. */
  by: string;
  /** The selector pref's name. */
  name: string;
  /** A row each: the options with a value of their own, then, where the pref's overrides leave some out, one
   *  labeled `othersLabel` standing for all of those, which share one value. */
  options: ReadonlyArray<{ value: string; label: string }>;
  /** The label of the option the selector is set to. */
  current: string;
}

/** How one pref's value is split, and how it may yet be. */
export interface SplitShape {
  /** The selectors the value is split by, outermost first. */
  levels: SplitLevel[];
  /** The selectors it is not split by and may be. */
  free: Array<{ by: string; name: string }>;
  scope: PrefScope | undefined;
}

/** One value of a split value: the option chosen at each level, and what the scope holds there. */
export interface SplitMember {
  at: PrefSelection;
  /** The label of the option at each level, outermost first. */
  labels: string[];
  value: unknown;
}

/**
 * The form's split state, for its rows. Undefined for a form given nothing to split with, whose rows then draw
 * as they always did.
 */
export function useSplitRows(
  props: PrefSplitProps, schema: PrefGroup, over: PrefGroup | PrefSection | undefined,
): SplitCtx | undefined {
  const { scopes, onSplit, onJoin, onChangeAt, othersLabel } = props;
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(props.defaultSplitOpen));
  const formId = useId();
  const setOpen = useCallback((path: string, open: boolean) => {
    setOpened((was) => {
      if (was.has(path) === open) return was;
      const next = new Set(was);
      if (open) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);
  return useMemo(() => {
    if (scopes === undefined && onSplit === undefined && onJoin === undefined) return undefined;
    const selectorAt = (path: string, aliased: boolean): PrefLeaf | undefined => prefLeafAt(aliased ? (over ?? schema) : schema, path);
    const bodyId = (path: string): string => `${formId}split-${path}`;
    return { scopes, onSplit, onJoin, onChangeAt, othersLabel, selectorAt, opened, setOpen, bodyId };
  }, [scopes, onSplit, onJoin, onChangeAt, othersLabel, schema, over, opened, setOpen, formId]);
}

/**
 * How `pref`'s value is split, read from the scope it holds and the selectors its `scopes` names. `selectorAt`
 * finds a selector's leaf, and `values` says what each is set to. Null for a pref that names no usable selector.
 */
export function splitShape(
  pref: PrefLeaf,
  scope: PrefScope | undefined,
  selectorAt: (path: string) => PrefLeaf | undefined,
  values: unknown,
  othersLabel = 'Others',
): SplitShape | null {
  const axes = prefScopesOf(pref).map((scope) => scope.selector);
  if (!axes.length) return null;
  const by = prefScopeSelectors(scope);
  const levels: SplitLevel[] = [];
  const free: SplitShape['free'] = [];
  for (const path of axes) {
    const leaf = selectorAt(path);
    if (leaf?.kind !== 'enum') continue;
    const selector = leaf as PrefEnum;
    if (!by.has(path)) {
      free.push({ by: path, name: selector.name });
      continue;
    }
    const set = prefValueAtPath(values, path);
    const value = typeof set === 'string' ? set : selector.default;
    const all = selector.options.map((option) => ({ value: option.value, label: option.label }));
    const overrides = prefOverridesOf(pref, path);
    const list = overrides && prefOverrideOptions(overrides);
    const owning = list ? all.filter((option) => list.includes(option.value)) : all;
    const shared = all.find((option) => !owning.includes(option));
    const options = shared ? [...owning, { value: shared.value, label: othersLabel }] : owning;
    levels.push({ by: path, name: selector.name, options, current: all.find((o) => o.value === value)?.label ?? String(value) });
  }
  return levels.length + free.length === 0 ? null : { levels, free, scope };
}

/** What a split row is called: the pref's name and the selectors its value is split by. */
export function splitName(name: string, levels: readonly SplitLevel[]): string {
  return `${name} by ${levels.map((level) => level.name).join(' and ')}`;
}

/**
 * The value under one option of `level`, further in from `outer`; an option the scope holds nothing for reads as
 * `absent`. `overridesOf` gives the pref's override lists, by which an option one leaves out reads the shared value.
 */
export function splitMember(
  scope: PrefScope, outer: SplitMember | undefined, level: SplitLevel, option: { value: string; label: string }, absent: unknown,
  overridesOf?: (selector: string) => PrefOverrides | undefined,
): SplitMember {
  const at = { ...outer?.at, [level.by]: option.value };
  return { at, labels: [...(outer?.labels ?? []), option.label], value: prefScopeValue(scope, at, absent, overridesOf) };
}
