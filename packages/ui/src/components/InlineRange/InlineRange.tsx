import { type CSSProperties, forwardRef, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent, type Ref, useMemo } from 'react';
import { mergeRefs } from 'react-aria';
import { snapToStep } from '@weasel-js/quantity';
import s from './InlineRange.module.css';
import { useRangeEdit, type RangeEditProps } from './useRangeEdit';
import type { HoldProps } from '../Disabled';
import { useNativeHold } from '../Disabled/nativeHold';
import { useFieldControl } from '../Field/fieldSemantics';

/** Props for {@link InlineRange} — a range input's, with `value` required. */
export type InlineRangeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max' | 'disabled' | 'readOnly'
> & HoldProps & RangeEditProps & {
  value: number;
  min?: number;
  max?: number;
  /** Paint the track up to the thumb in the accent. Default true; `false` leaves the plain track. */
  fill?: boolean;
  /** Where to draw a 1px mark on the track, each a 0..1 fraction of it, under the thumb's center at that fraction. */
  marks?: readonly number[];
};

const MARK = 'linear-gradient(var(--wzl-border-strong), var(--wzl-border-strong))';

/** Each mark centered where the thumb's center sits at it: `t/2 + f·(W − t)` of the content box. */
function marksStyle(marks: readonly number[]): Record<string, string> {
  // A background position's percentage runs over (W − 1px), the mark's own width taken off.
  const place = (f: number) => `calc(${f * 100}% + ${0.5 - f} * (var(--wzl-slider-thumb-size) - 1px)) 50%`;
  return {
    '--wzl-range-stop-marks': marks.map(() => MARK).join(', '),
    '--wzl-range-stop-at': marks.map(place).join(', '),
    // Per layer, since a shorter list repeats over the fill layer `.filled.marks` adds after them.
    '--wzl-range-stop-size': marks.map(() => '1px 75%').join(', '),
    '--wzl-range-stop-origin': marks.map(() => 'content-box').join(', '),
  };
}

/** The fill's edge, under the thumb's center as {@link marksStyle} places a mark: `t/2 + f·(W − t)` of the content box. */
const fillAt = (f: number) => `calc(${f * 100}% + ${0.5 - f} * var(--wzl-slider-thumb-size))`;

/** Where the native thumb draws `value`: clamped, then on the step grid counted from `min`, as a range input
 *  sanitizes it. A `step` that is not a positive number means 1, and `any` means no grid. */
function thumbValue(value: number, min: number, max: number, stepAttr: number | string | undefined): number {
  const hi = Math.max(min, max);
  const step = stepAttr === 'any' ? undefined : Number(stepAttr) > 0 ? Number(stepAttr) : 1;
  const q = snapToStep(Math.min(Math.max(value, min), hi), step, min);
  return step !== undefined && q > hi ? snapToStep(q - step, step, min) : q;
}

const VALUE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

const NOOP = () => {};

/** A held range's handlers: none of the caller's, and the native thumb kept from moving under a key or a press. */
const REFUSED = {
  onInput: undefined,
  // A handler still, or React warns of a controlled value with none; `useRangeEdit` refuses the edit itself.
  onChange: NOOP,
  onPointerDown: undefined,
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
    if (VALUE_KEYS.has(e.key)) e.preventDefault();
  },
  onMouseDown: (e: MouseEvent<HTMLInputElement>) => e.preventDefault(),
};

/**
 * Compact range input for a property row: one track, no label, no output.
 * It sits inline beside a swatch or a readout, and owns the native range skin
 * every such surface wears. With no `aria-label` of its own it takes the name, description and error of a `Field`
 * around it, so `<Field label output>` draws its label and readout.
 *
 * Straight only; for a control along a curve, or with several thumbs, use `Slider`. Held disabled for a reason, or
 * read-only, it stays focusable and drops every input, since its `value` is controlled.
 *
 * It takes the native element's handlers, and reports an edit through `onValueInput`, `onValueChange` and
 * `onValueCancel` as the kit's edit protocol defines them: a drag or a key step is one edit, and Escape cancels a
 * drag ({@link RangeEditProps}).
 */
export const InlineRange = forwardRef(function InlineRange(
  props: InlineRangeProps,
  ref: Ref<HTMLInputElement>,
) {
  const {
    value: given, min = 0, max = 100, fill = true, marks, className, style, disabled, disabledReason, readOnly, readOnlyReason,
    onValueInput, onValueChange, onValueCancel, ...own
  } = props;
  const field = useFieldControl({ id: own.id, 'aria-label': own['aria-label'], 'aria-labelledby': own['aria-labelledby'], 'aria-describedby': own['aria-describedby'] });
  const hold = useNativeHold({ disabled, disabledReason, readOnly, readOnlyReason, 'aria-describedby': field['aria-describedby'] });
  const edit = useRangeEdit(given, { onValueInput, onValueChange, onValueCancel }, hold.refuses);
  const merged = useMemo(() => mergeRefs(edit.ref, ref), [edit.ref, ref]);
  const value = edit.shown;
  const named = { ...own, onChange: own.onChange ?? NOOP, ...field };
  const rest = hold.refuses ? { ...named, ...REFUSED } : named;
  const span = max - min;
  const filled = span > 0 ? ((thumbValue(value, min, max, own.step) - min) / span) * 100 : 0;
  const marked = marks !== undefined && marks.length > 0;
  const vars = {
    ...(fill ? { '--slider-fill': `${filled}%`, '--slider-fill-at': fillAt(filled / 100) } : {}),
    ...(marked ? marksStyle(marks) : {}),
  };
  return hold.wrap(
    <input
      {...rest}
      {...hold.attrs}
      ref={merged}
      type="range"
      value={value}
      min={min}
      max={max}
      className={[s.range, fill && s.filled, marked && s.marks, className].filter(Boolean).join(' ')}
      style={{ ...vars, ...style } as CSSProperties}
    />,
  );
});
