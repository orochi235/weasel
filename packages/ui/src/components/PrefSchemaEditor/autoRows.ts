import type { PrefAuto, PrefLeaf } from '@weasel-js/prefs';

/** The Auto panel's rows, which a leaf keeps in its one `auto` field: never auto, starts auto, and what it reads while auto. */
export type AutoRow = 'never' | 'on' | 'value';
/** What a leaf's `auto` holds. */
export type LeafAuto = false | PrefAuto | undefined;

/** A leaf's `auto` as the Auto panel's rows, each set one present. */
export function autoRowsOf(leaf: PrefLeaf): Partial<Record<AutoRow, unknown>> {
  const { auto } = leaf;
  if (auto === false) return { never: true };
  if (auto === undefined) return {};
  return { ...(auto.on ? { on: true } : {}), ...(auto.value === undefined ? {} : { value: auto.value }) };
}

/** `auto` with the Auto panel's `row` set to `value`; `undefined` where nothing is left to say. Never auto clears the rest,
 *  and either of the others clears never auto. */
export function withAutoRow(auto: LeafAuto, row: AutoRow, value: unknown): LeafAuto {
  if (row === 'never') return value ? false : auto === false ? undefined : auto;
  const set = row === 'on' ? value === true : value !== undefined;
  if (auto === false && !set) return false;
  const next: PrefAuto = auto === false || auto === undefined ? {} : { ...auto };
  delete next[row];
  if (set && row === 'on') next.on = true;
  else if (set) next.value = value;
  return Object.keys(next).length === 0 ? undefined : next;
}
