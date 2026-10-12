import { PREF_ENTRY } from '@weasel-js/prefs';

/** What a leaf's control is told about the conditions over it. */
interface Conditions {
  disabled?: boolean;
  disabledAt?: (path: string) => boolean;
  hidden?: boolean;
  hiddenAt?: (path: string) => boolean;
}

/**
 * What an entry of the list or map at `ctx.path` is told, drawn at
 * `entryPath`. An item's conditions are kept once for every entry, with `*`
 * for the entry's step, so a question about this entry is asked there.
 */
export function entryConditions(ctx: Conditions & { path: string }, entryPath: string): Conditions {
  const { disabledAt, hiddenAt } = ctx;
  const item = `${ctx.path}.${PREF_ENTRY}`;
  const asked = (at: string): string => (at === entryPath || at.startsWith(`${entryPath}.`) ? item + at.slice(entryPath.length) : at);
  return {
    disabled: ctx.disabled === true || disabledAt?.(item) === true,
    ...(disabledAt ? { disabledAt: (at: string) => disabledAt(asked(at)) } : {}),
    hidden: ctx.hidden,
    ...(hiddenAt ? { hiddenAt: (at: string) => hiddenAt(asked(at)) } : {}),
  };
}

/** Whether every entry of the list or map at `ctx.path` is disabled: the leaf is, or its item. */
export function entriesDisabled(ctx: Conditions & { path: string }): boolean {
  return ctx.disabled === true || ctx.disabledAt?.(`${ctx.path}.${PREF_ENTRY}`) === true;
}
