import type { PrefAuto, PrefLeaf } from '../index';

/** The Auto panel's rows, which a leaf keeps in its one `auto` field: can be auto, starts auto, and what it reads while auto. */
export type AutoRow = 'can' | 'on' | 'value';
/** What a leaf's `auto` holds. */
export type LeafAuto = PrefAuto | undefined;

/** A leaf's `auto` as the Auto panel's rows, each set one present. */
export function autoRowsOf(leaf: PrefLeaf): Partial<Record<AutoRow, unknown>> {
  const { auto } = leaf;
  if (auto === undefined) return {};
  return { can: true, ...(auto.on ? { on: true } : {}), ...(auto.value === undefined ? {} : { value: auto.value }) };
}

/** `auto` with the Auto panel's `row` set to `value`. Clearing can be auto clears the rest, to `undefined`; setting
 *  either of the others opts the leaf in, and clearing one leaves it opted in. */
export function withAutoRow(auto: LeafAuto, row: AutoRow, value: unknown): LeafAuto {
  if (row === 'can') return value ? (auto ?? {}) : undefined;
  const set = row === 'on' ? value === true : value !== undefined;
  if (auto === undefined && !set) return undefined;
  const next: PrefAuto = { ...auto };
  delete next[row];
  if (set && row === 'on') next.on = true;
  else if (set) next.value = value;
  return next;
}
