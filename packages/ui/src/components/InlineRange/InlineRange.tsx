import { type CSSProperties, forwardRef, type InputHTMLAttributes, type Ref } from 'react';
import s from './InlineRange.module.css';

/** Props for {@link InlineRange} — a range input's, with `value` required. */
export type InlineRangeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max'
> & {
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

/**
 * Compact range input for a property row: one track, no label, no output.
 * It sits inline beside a swatch or a readout, and owns the native range skin
 * every such surface wears.
 *
 * Straight only; for a control along a curve, or with several thumbs, use `Slider`.
 */
export const InlineRange = forwardRef(function InlineRange(
  props: InlineRangeProps,
  ref: Ref<HTMLInputElement>,
) {
  const { value, min = 0, max = 100, fill = true, marks, className, style, ...rest } = props;
  const span = max - min;
  const filled = span > 0 ? ((Math.min(Math.max(value, min), max) - min) / span) * 100 : 0;
  const marked = marks !== undefined && marks.length > 0;
  const vars = {
    ...(fill ? { '--slider-fill': `${filled}%` } : {}),
    ...(marked ? marksStyle(marks) : {}),
  };
  return (
    <input
      {...rest}
      ref={ref}
      type="range"
      value={value}
      min={min}
      max={max}
      className={[s.range, fill && s.filled, marked && s.marks, className].filter(Boolean).join(' ')}
      style={{ ...vars, ...style } as CSSProperties}
    />
  );
});
