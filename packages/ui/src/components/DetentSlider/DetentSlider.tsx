import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { Slider, type Thumb } from '../Slider/Slider';
import s from './DetentSlider.module.css';

/** What a detent can carry. Narrowed so identity comparison and React keys
 *  both work without a keying callback. */
export type DetentValue = string | number;

/** One detent on a {@link DetentSlider}. */
export type DetentItem<V extends DetentValue = number> = {
  value: V;
  /** Drawn under the detent. Defaults to `formatLabel(value)`, then `value`. */
  label?: ReactNode;
  /** Spoken form, when the drawn label is not the right thing to say. */
  ariaLabel?: string;
};

/**
 * Props for {@link DetentSlider}.
 *
 * `items` takes bare values or `DetentItem`s interchangeably — a bare value is
 * a detent with no label of its own.
 *
 * `onChange` fires on every detent the control passes through, including
 * mid-drag: each one is a complete, legal choice, so there is no in-flight
 * value to withhold. `onCommit` fires once the gesture that changed things
 * ends, and is the one to write to history.
 */
export type DetentSliderProps<V extends DetentValue = number> = {
  items: readonly (V | DetentItem<V>)[];
  value: V;
  onChange: (value: V, index: number) => void;
  onCommit?: (value: V, index: number) => void;
  formatLabel?: (value: V, index: number) => ReactNode;
  labels?: 'all' | 'ends' | 'none';
  trackHeight?: number;
  ariaLabel?: string;
  className?: string;
};

function normalize<V extends DetentValue>(items: readonly (V | DetentItem<V>)[]): DetentItem<V>[] {
  return items.map(it => (typeof it === 'object' && it !== null ? it : ({ value: it } as DetentItem<V>)));
}

/**
 * The detent `value` selects. An exact match wins; a number that matches none
 * lands on the nearest one, so a value arriving from a numeric field or an
 * older save renders where it belongs rather than silently reading as the
 * first detent.
 */
function resolveIndex<V extends DetentValue>(items: readonly DetentItem<V>[], value: V): number {
  const exact = items.findIndex(it => it.value === value);
  if (exact !== -1) return exact;
  if (typeof value !== 'number') return 0;
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < items.length; i++) {
    const v = items[i].value;
    if (typeof v !== 'number') continue;
    const gap = Math.abs(v - value);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}

function plainText(label: ReactNode, fallback: DetentValue): string {
  return typeof label === 'string' || typeof label === 'number' ? String(label) : String(fallback);
}

/**
 * Slider over a fixed list of values: one detent per value, evenly spaced, the
 * thumb resting on one of them.
 *
 * This is the shape to reach for when a numeric option has a small set of
 * allowed values along a line — playback rate, zoom step, stroke weight — in
 * place of a dropdown, which hides the ordering and the extent of the range
 * behind a click.
 *
 * The track addresses the *index* of `items`, not the value, which is what
 * makes the detents evenly spaced no matter how the values are distributed:
 * a geometric rate list (0.25/0.5/1/2/4) laid out linearly would crowd four
 * of its five detents into the first fifth of the track and leave the most
 * used one nearly unhittable. Since the index is meaningless to a screen
 * reader, the value is published as `aria-valuetext`.
 */
export function DetentSlider<V extends DetentValue = number>(props: DetentSliderProps<V>): ReactElement {
  const { value, onChange, onCommit, formatLabel, ariaLabel, className } = props;
  const items = normalize(props.items);
  const labelMode = props.labels ?? 'all';
  const index = resolveIndex(items, value);
  const lastIndex = Math.max(0, items.length - 1);

  const labelOf = (item: DetentItem<V>, i: number): ReactNode =>
    item.label ?? formatLabel?.(item.value, i) ?? String(item.value);

  // Deduped separately: `live` suppresses the repeat reports a drag produces
  // while the pointer crosses one detent, `changed` keeps a press that chose
  // nothing from landing a no-op entry in the consumer's history.
  const liveRef = useRef(index);
  const changedRef = useRef(false);
  useEffect(() => {
    liveRef.current = index;
  }, [index]);

  const at = (raw: number): number => Math.max(0, Math.min(lastIndex, Math.round(raw)));

  const handleInput = (next: Thumb[]) => {
    const i = at(next[0].value);
    if (i === liveRef.current) return;
    liveRef.current = i;
    changedRef.current = true;
    onChange(items[i].value, i);
  };

  const handleCommit = (next: Thumb[]) => {
    if (!changedRef.current) return;
    changedRef.current = false;
    const i = at(next[0].value);
    onCommit?.(items[i].value, i);
  };

  const current = items[index];
  if (!current) return <div className={className ? `${s.root} ${className}` : s.root} />;

  const thumbs: Thumb[] = [
    { value: index, valueText: current.ariaLabel ?? plainText(labelOf(current, index), current.value) },
  ];

  const shown =
    labelMode === 'ends'
      ? [...new Set([0, lastIndex])]
      : items.map((_, i) => i);

  return (
    <div className={className ? `${s.root} ${className}` : s.root}>
      <Slider
        className={s.slider}
        min={0}
        max={lastIndex}
        step={1}
        stops={items.map((_, i) => i)}
        trackClick="move-nearest"
        trackHeight={props.trackHeight ?? 8}
        ariaLabel={ariaLabel}
        thumbs={thumbs}
        onInput={handleInput}
        onChange={handleCommit}
      />
      {labelMode !== 'none' && (
        <div className={s.labels} data-detent-labels aria-hidden="true">
          {shown.map(i => (
            <span
              key={items[i].value}
              className={s.label}
              data-detent-label
              data-index={i}
              data-selected={i === index ? 'true' : undefined}
              data-edge={i === 0 ? 'start' : i === lastIndex ? 'end' : undefined}
              style={{ left: `${(lastIndex === 0 ? 0 : i / lastIndex) * 100}%` }}
            >
              {labelOf(items[i], i)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
