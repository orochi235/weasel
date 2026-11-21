import { amount, presentRange, retag, type Display, type Quantity } from '@weasel-js/quantity';
import type { Band } from './bands';

export function untag<T, F extends Quantity>(band: Band<T, F>): Band<T> {
  return typeof band.from === 'number' ? (band as Band<T>) : { ...band, from: amount(band.from) };
}

/**
 * `next` with each `from` in the shape the consumer gave it, each band taking the tag of the input band it came
 * from: the same band, or for a band a split added, the band it was split from.
 */
export function retagBands<T, F extends Quantity>(input: readonly Band<T, F>[], next: readonly Band<T>[]): Band<T, F>[] {
  const firstTagged = input.find((b) => typeof b.from !== 'number');
  if (!firstTagged) return next as Band<T, F>[];
  const sourceOf = sourceIndex(input, next);
  return next.map((band, i) => ({ ...band, from: retag((input[sourceOf(i)] ?? firstTagged).from, band.from) }));
}

/**
 * Which input band each of `next`'s came from, where `next` is `input` edited in place or with one band split off
 * or merged away. The first band is skipped when looking for the edit, since `next` has its `from` pinned to `min`.
 */
function sourceIndex<T, F extends Quantity>(input: readonly Band<T, F>[], next: readonly Band<T>[]): (i: number) => number {
  const delta = next.length - input.length;
  if (delta === 0) return (i) => i;
  const same = (i: number): boolean =>
    i < input.length && next[i]!.data === input[i]!.data && next[i]!.from === amount(input[i]!.from);
  let edit = 1;
  while (edit < next.length && same(edit)) edit++;
  return (i) => (i < edit ? i : i - delta);
}

/** A band's accessible name: its number, its range as spoken, and whether it is locked. */
export function bandName<T, F extends Quantity>(
  bands: readonly Band<T, F>[],
  index: number,
  from: number,
  to: number,
  display: Display,
  locale: string,
  label = `Band ${index + 1}`,
): string {
  const band = bands[index]!;
  const next = bands[index + 1];
  const range = presentRange(retag(band.from, from), next ? retag(next.from, to) : to, display, { locale }).spoken;
  return `${label}, ${range}${band.locked ? ', locked' : ''}`;
}
