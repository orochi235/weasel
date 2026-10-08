import { amount, retag, type Quantity } from '@weasel-js/quantity';
import type { Band } from './bands';

export function untag<T, F extends Quantity>(band: Band<T, F>): Band<T> {
  return typeof band.from === 'number' ? (band as Band<T>) : { ...band, from: amount(band.from) };
}

/**
 * `next` with each `from` in the shape the consumer gave it. A band keeps the
 * tag of the band at its index when the count is unchanged; after a split or
 * a merge it takes the tag of the input band carrying the same payload, else
 * the first tagged one — a split band inherits its parent's presentation.
 */
export function retagBands<T, F extends Quantity>(input: readonly Band<T, F>[], next: readonly Band<T>[]): Band<T, F>[] {
  const firstTagged = input.find((b) => typeof b.from !== 'number');
  if (!firstTagged) return next as Band<T, F>[];
  return next.map((band, i) => {
    const source =
      (next.length === input.length ? input[i] : input.find((b) => b.data === band.data)) ?? firstTagged;
    return { ...band, from: retag(source.from, band.from) };
  });
}
