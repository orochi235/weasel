import {
  applyPrefEntryConditions,
  PREF_ENTRY,
  type PrefConditionJudge,
  type PrefEntry,
  type PrefEntryApplied,
  type PrefLeaf,
} from '@weasel-js/prefs';

/**
 * One entry of a list or a map as the conditions that read it (`from: 'item'`) leave it: `item` without the
 * fields they hide, and the paths under `path`, the entry's own, that they disable. A surface makes one with
 * {@link entryApplier} and hands it down with `disabledAt`.
 */
export type EntryAt = (item: PrefLeaf, path: string, value: unknown) => PrefEntryApplied;

/** An {@link EntryAt} over a surface's values: `judge` answers for one entry, as `prefJudge` given it does. */
export function entryApplier(judge: (entry: PrefEntry) => PrefConditionJudge, keepHidden = false): EntryAt {
  return (item, path, value) => applyPrefEntryConditions(item, path, judge({ item, value }), { keepHidden });
}

/** What a leaf's control is told about the conditions over it. */
interface Conditions {
  disabled?: boolean;
  disabledAt?: (path: string) => boolean;
  hidden?: boolean;
  hiddenAt?: (path: string) => boolean;
  entryAt?: EntryAt;
}

/**
 * What the entry of the list or map at `ctx.path` holding `value` is told, drawn at `entryPath`, and the `item`
 * it is drawn as. A condition that comes to the same for every entry is kept once, with `*` for the entry's
 * step, so a question about this entry is asked there; one that reads the entry is answered for it here.
 */
export function entryConditions(
  ctx: Conditions & { path: string }, entryPath: string, item: PrefLeaf, value: unknown,
): Conditions & { item: PrefLeaf } {
  const { disabledAt, hiddenAt, entryAt } = ctx;
  const every = `${ctx.path}.${PREF_ENTRY}`;
  const asked = (at: string): string => (at === entryPath || at.startsWith(`${entryPath}.`) ? every + at.slice(entryPath.length) : at);
  const own = entryAt?.(item, entryPath, value);
  return {
    item: own ? own.item : item,
    disabled: ctx.disabled === true || disabledAt?.(every) === true || own?.disabled.has(entryPath) === true,
    ...(disabledAt || own ? { disabledAt: (at: string) => own?.disabled.has(at) === true || disabledAt?.(asked(at)) === true } : {}),
    hidden: ctx.hidden,
    ...(hiddenAt || own ? { hiddenAt: (at: string) => own?.hidden.has(at) === true || hiddenAt?.(asked(at)) === true } : {}),
    ...(entryAt ? { entryAt } : {}),
  };
}

/** Whether every entry of the list or map at `ctx.path` is disabled: the leaf is, or its item. */
export function entriesDisabled(ctx: Conditions & { path: string }): boolean {
  return ctx.disabled === true || ctx.disabledAt?.(`${ctx.path}.${PREF_ENTRY}`) === true;
}

/** Whether the entry at `index` of the list at `ctx.path` is disabled: the list is, or the item's conditions over that entry. */
export function entryDisabledAt(
  ctx: Conditions & { path: string }, item: PrefLeaf, entries: readonly unknown[],
): (index: number) => boolean {
  return (index) => entryConditions(ctx, `${ctx.path}.${index}`, item, entries[index]).disabled === true;
}
