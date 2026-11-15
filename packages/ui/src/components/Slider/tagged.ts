import { amount, displayOf, retag, type Display, type Quantity } from '@weasel-js/quantity';
import type { Thumb } from './types';

const GIVEN = Symbol('given');

/** A thumb as the slider moves it: its value a bare number, with the tagged quantity it was given kept beside it. */
export type PlainThumb = Thumb & { [GIVEN]?: Quantity };

export function untagThumb(thumb: Thumb<Quantity>): PlainThumb {
  return typeof thumb.value === 'number' ? (thumb as Thumb) : { ...thumb, value: amount(thumb.value), [GIVEN]: thumb.value };
}

/** `thumb` in the shape it was given: a tagged value keeps its unit and display around the number it now holds. */
export function retagThumb<T extends Thumb<Quantity>>(thumb: PlainThumb): T {
  const { [GIVEN]: given, ...rest } = thumb;
  return (given === undefined ? thumb : { ...rest, value: retag(given, thumb.value) }) as unknown as T;
}

/** The display a thumb's own value carries, which wins over the slider's. */
export function thumbDisplay(thumb: PlainThumb): Display | undefined {
  const given = thumb[GIVEN];
  return given === undefined ? undefined : displayOf(given);
}

/** Whether two thumb lists hold the same values, a tagged one by its amount: a consumer rebuilding its tagged values
 *  each render still holds what it held. */
export function sameThumbValues(a: readonly Thumb<Quantity>[], b: readonly Thumb<Quantity>[]): boolean {
  return a.length === b.length && a.every((t, i) => Object.is(amount(t.value), amount(b[i]!.value)));
}
