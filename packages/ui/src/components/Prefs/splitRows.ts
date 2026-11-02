import { useCallback, useId, useMemo, useState } from 'react';
import {
  prefLeafAt,
  prefLocusMember,
  prefLocusSelectors,
  prefValueAtPath,
  tbdPerAxes,
  tbdPerClosed,
  type PrefEnum,
  type PrefGroup,
  type PrefLeaf,
  type PrefLocus,
  type PrefSection,
  type PrefSelection,
  type TbdClosedLists,
} from '@weasel-js/prefs';

/** What a form is given to draw and edit the values its leaves hold split. */
export interface PrefSplitProps {
  /** What each split leaf holds, by the path its value is stored at: `store.loci()`. A pref with `per`
   *  and is named here draws a marker for the option each of its selectors is set to, and opens to a control
   *  for every option. `values` still holds the one value such a leaf reads as. */
  loci?: ReadonlyMap<string, PrefLocus>;
  /** The reader asked for the leaf's value to be held once per option of the selector at `by`, one of its
   *  `per` selectors. Given, a leaf offers it for each selector its value is not split by. */
  onSplit?: (path: string, by: string) => void;
  /** The reader asked for the leaf's value to be one again across the selector at `by`. Given, a leaf offers it
   *  for each selector its value is split by. */
  onJoin?: (path: string, by: string) => void;
  /** An edit of one member of a split leaf's value: the one `at` names, an option for each selector the value is
   *  split by. Without it a split row does not open. An edit of the row itself goes to `onChange`. */
  onChangeAt?: (path: string, value: unknown, at: PrefSelection) => void;
  /** What the one row standing for every option a pref's overrides leave out is called. Default `Others`. */
  othersLabel?: string;
  /** Paths of the split rows open to their members before the reader opens or shuts one. Which are open is the
   *  form's own state from then on. Default: none. */
  defaultSplitOpen?: readonly string[];
}

/** What a form's rows read to draw split values: the form's props, its schema's selectors, and which rows are open. */
export interface SplitCtx extends Omit<PrefSplitProps, 'defaultSplitOpen'> {
  /** The leaf a `per` entry names. `aliased` asks the schema the form's aliases point into. */
  selectorAt: (path: string, aliased: boolean) => PrefLeaf | undefined;
  /** The paths of the rows open to their members. */
  opened: ReadonlySet<string>;
  setOpen: (path: string, open: boolean) => void;
  /** The `id` of the element the row at `path` opens to, unique to this form. */
  bodyId: (path: string) => string;
}

/** One selector a leaf's value is split by. */
export interface SplitLevel {
  /** The selector's path. */
  by: string;
  /** The selector leaf's name. */
  name: string;
  /** A row each: the options with a value of their own, then, where the pref's overrides leave some out, one
   *  labeled `othersLabel` standing for all of those, which share one value. */
  options: ReadonlyArray<{ value: string; label: string }>;
  /** The label of the option the selector is set to. */
  current: string;
}

/** How one leaf's value is split, and how it may yet be. */
export interface SplitShape {
  /** The selectors the value is split by, outermost first. */
  levels: SplitLevel[];
  /** The selectors it is not split by and may be. */
  free: Array<{ by: string; name: string }>;
  locus: PrefLocus | undefined;
}

/** One member of a split value: the option chosen at each level, and what the locus holds there. */
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
  const { loci, onSplit, onJoin, onChangeAt, othersLabel } = props;
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
    if (loci === undefined && onSplit === undefined && onJoin === undefined) return undefined;
    const selectorAt = (path: string, aliased: boolean): PrefLeaf | undefined => prefLeafAt(aliased ? (over ?? schema) : schema, path);
    const bodyId = (path: string): string => `${formId}split-${path}`;
    return { loci, onSplit, onJoin, onChangeAt, othersLabel, selectorAt, opened, setOpen, bodyId };
  }, [loci, onSplit, onJoin, onChangeAt, othersLabel, schema, over, opened, setOpen, formId]);
}

/**
 * How `pref`'s value is split, read from the locus it holds and the selectors its `per` names. `selectorAt`
 * finds a selector's leaf, and `values` says what each is set to. Null for a leaf that names no usable selector.
 */
export function splitShape(
  pref: PrefLeaf,
  locus: PrefLocus | undefined,
  selectorAt: (path: string) => PrefLeaf | undefined,
  values: unknown,
  othersLabel = 'Others',
): SplitShape | null {
  const axes = tbdPerAxes(pref);
  if (!axes?.length) return null;
  const by = prefLocusSelectors(locus);
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
    const list = tbdPerClosed(pref)?.[path]?.options;
    const owning = list ? all.filter((option) => list.includes(option.value)) : all;
    const shared = all.find((option) => !owning.includes(option));
    const options = shared ? [...owning, { value: shared.value, label: othersLabel }] : owning;
    levels.push({ by: path, name: selector.name, options, current: all.find((o) => o.value === value)?.label ?? String(value) });
  }
  return levels.length + free.length === 0 ? null : { levels, free, locus };
}

/** What a split row is called: the leaf's name and the selectors its value is split by. */
export function splitName(name: string, levels: readonly SplitLevel[]): string {
  return `${name} by ${levels.map((level) => level.name).join(' and ')}`;
}

/**
 * The member under one option of `level`, further in from `outer`; an option the locus holds nothing for reads as
 * `absent`. `closed` is the leaf's `tbdPerClosed`, by which an option a closed list leaves out reads the shared member.
 */
export function splitMember(
  locus: PrefLocus, outer: SplitMember | undefined, level: SplitLevel, option: { value: string; label: string }, absent: unknown,
  closed?: TbdClosedLists,
): SplitMember {
  const at = { ...outer?.at, [level.by]: option.value };
  return { at, labels: [...(outer?.labels ?? []), option.label], value: prefLocusMember(locus, at, absent, closed) };
}
