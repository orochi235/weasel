import { type CSSProperties, forwardRef, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent, type Ref } from 'react';
import s from './InlineRange.module.css';
import type { HoldProps } from '../Disabled';
import { useNativeHold } from '../Disabled/nativeHold';

/** Props for {@link InlineRange} — a range input's, with `value` required. */
export type InlineRangeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max' | 'disabled' | 'readOnly'
> & HoldProps & {
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
  };
}

const VALUE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/** A held range's handlers: none of the caller's, and the native thumb kept from moving under a key or a press. */
const REFUSED = {
  onInput: undefined,
  onChange: undefined,
  onPointerDown: undefined,
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
    if (VALUE_KEYS.has(e.key)) e.preventDefault();
  },
  onMouseDown: (e: MouseEvent<HTMLInputElement>) => e.preventDefault(),
};

/**
 * Compact range input for a property row: one track, no label, no output.
 * It sits inline beside a swatch or a readout, and owns the native range skin
 * every such surface wears.
 *
 * Straight only; for a control along a curve, or with several thumbs, use `Slider`. Held disabled for a reason, or
 * read-only, it stays focusable and drops every input, since its `value` is controlled.
 */
export const InlineRange = forwardRef(function InlineRange(
  props: InlineRangeProps,
  ref: Ref<HTMLInputElement>,
) {
  const { value, min = 0, max = 100, fill = true, marks, className, style, disabled, disabledReason, readOnly, readOnlyReason, ...own } = props;
  const hold = useNativeHold({ disabled, disabledReason, readOnly, readOnlyReason, 'aria-describedby': own['aria-describedby'] });
  const rest = hold.refuses ? { ...own, ...REFUSED } : own;
  const span = max - min;
  const filled = span > 0 ? ((Math.min(Math.max(value, min), max) - min) / span) * 100 : 0;
  const marked = marks !== undefined && marks.length > 0;
  const vars = {
    ...(fill ? { '--slider-fill': `${filled}%` } : {}),
    ...(marked ? marksStyle(marks) : {}),
  };
  return hold.wrap(
    <input
      {...rest}
      {...hold.attrs}
      ref={ref}
      type="range"
      value={value}
      min={min}
      max={max}
      className={[s.range, fill && s.filled, marked && s.marks, className].filter(Boolean).join(' ')}
      style={{ ...vars, ...style } as CSSProperties}
    />,
  );
});
