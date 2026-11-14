import { useEffect, useRef, type ReactNode } from 'react';
import type { SliderProps, SliderStop, Thumb } from './types';

/** What a detent can carry. Narrowed so identity comparison and React keys
 *  both work without a keying callback. */
export type DetentValue = string | number;

/** One detent of {@link useDetents}. */
export type DetentItem<V extends DetentValue = number> = {
  value: V;
  /** Drawn under the detent. Defaults to `formatLabel(value)`, then `value`. */
  label?: ReactNode;
  /** Spoken form, when the drawn label is not the right thing to say. */
  ariaLabel?: string;
};

/**
 * Options for {@link useDetents}. `items` takes bare values or `DetentItem`s
 * interchangeably — a bare value is a detent with no label of its own.
 *
 * `onInput` fires on every detent the control passes through, including
 * mid-drag: each one is a complete, legal choice, so there is no in-flight
 * value to withhold. `onChange` fires once the gesture that changed things
 * ends, and is the one to write to history, as with `Slider`.
 */
export type DetentsOptions<V extends DetentValue = number> = {
  items: readonly (V | DetentItem<V>)[];
  value: V;
  onInput: (value: V, index: number) => void;
  onChange?: (value: V, index: number) => void;
  formatLabel?: (value: V, index: number) => ReactNode;
};

/** The {@link Slider} props {@link useDetents} supplies; spread them onto one. */
export type DetentSliderProps = Required<
  Pick<SliderProps, 'thumbs' | 'min' | 'max' | 'stops' | 'snap' | 'trackClick' | 'onInput' | 'onChange'>
>;

function normalize<V extends DetentValue>(items: readonly (V | DetentItem<V>)[]): DetentItem<V>[] {
  return items.map(it => (typeof it === 'object' && it !== null ? it : ({ value: it } as DetentItem<V>)));
}

/**
 * The detent `value` selects. An exact match wins; a number that matches none
 * lands on the nearest one, so a value arriving from a numeric field or an
 * older save renders where it belongs rather than silently reading as the
 * first detent.
 */
function detentIndex<V extends DetentValue>(items: readonly (V | DetentItem<V>)[], value: V): number {
  const values = normalize(items).map(it => it.value);
  const exact = values.indexOf(value);
  if (exact !== -1) return exact;
  if (typeof value !== 'number') return 0;
  let best = 0;
  let bestGap = Infinity;
  values.forEach((v, i) => {
    if (typeof v !== 'number') return;
    const gap = Math.abs(v - value);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

function plainText(label: ReactNode, fallback: DetentValue): string {
  return typeof label === 'string' || typeof label === 'number' ? String(label) : String(fallback);
}

/**
 * A {@link Slider} over a fixed list of values: one detent per value, evenly
 * spaced, the thumb resting on one of them. The values need only be ordered,
 * not numeric.
 *
 * The slider runs over the *index* of `items`, under `snap: 'strict'`, which
 * keeps the detents evenly spaced however the values are distributed. Since
 * the index is meaningless to a screen reader, the value is published as the
 * thumb's `aria-valuetext`. Everything else — `stopLabels`, `trackHeight`,
 * `aria-label`, an `Along` — is the slider's own:
 *
 * ```tsx
 * <Slider aria-label="Rate" stopLabels="ends" {...useDetents({ items, value, onInput })} />
 * ```
 *
 * For numbers that may also rest between the detents, give `Slider` magnetic
 * stops and `spacing="even"` instead.
 */
export function useDetents<V extends DetentValue = number>(options: DetentsOptions<V>): DetentSliderProps {
  const { value, onInput, onChange, formatLabel } = options;
  const items = normalize(options.items);
  const index = detentIndex(items, value);

  // Deduped separately: `live` suppresses the repeat reports a drag produces
  // while the pointer crosses one detent, `changed` keeps a press that chose
  // nothing from landing a no-op entry in the consumer's history.
  const liveRef = useRef(index);
  const changedRef = useRef(false);
  useEffect(() => {
    liveRef.current = index;
  }, [index]);

  const labelOf = (item: DetentItem<V>, i: number): ReactNode =>
    item.label ?? formatLabel?.(item.value, i) ?? String(item.value);
  const current = items[index];

  return {
    min: 0,
    max: Math.max(0, items.length - 1),
    stops: items.map((item, i): SliderStop => ({ value: i, label: labelOf(item, i) })),
    snap: 'strict',
    trackClick: 'move-nearest',
    thumbs: current
      ? [{ value: index, valueText: current.ariaLabel ?? plainText(labelOf(current, index), current.value) }]
      : [],
    onInput: (next: Thumb[]) => {
      const i = next[0].value;
      if (i === liveRef.current) return;
      liveRef.current = i;
      changedRef.current = true;
      onInput(items[i].value, i);
    },
    onChange: (next: Thumb[]) => {
      // The next gesture starts from where the value is, which a consumer that declined the detent left unchanged.
      liveRef.current = index;
      if (!changedRef.current) return;
      changedRef.current = false;
      const i = next[0].value;
      onChange?.(items[i].value, i);
    },
  };
}
