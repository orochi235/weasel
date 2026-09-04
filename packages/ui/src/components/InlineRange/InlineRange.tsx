import { type CSSProperties, type InputHTMLAttributes, type ReactElement } from 'react';
import shared from '../range.module.css';
import s from './InlineRange.module.css';

/** Props for {@link InlineRange} — a range input's, with `value` required. */
export type InlineRangeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'min' | 'max'
> & {
  value: number;
  min?: number;
  max?: number;
};

/**
 * Compact range input for a property row: one track, no label, no output.
 *
 * Distinct from the kit's other two — `Slider` is shaped for canvas scrubbing,
 * and `RangeSlider` is a full-width labelled form control on React Aria. This
 * one exists to sit inline beside a swatch or a readout, and to own the track
 * painting both of those surfaces need.
 */
export function InlineRange(props: InlineRangeProps): ReactElement {
  const { value, min = 0, max = 100, className, style, ...rest } = props;
  const span = max - min;
  const filled = span > 0 ? ((Math.min(Math.max(value, min), max) - min) / span) * 100 : 0;
  return (
    <input
      {...rest}
      type="range"
      value={value}
      min={min}
      max={max}
      className={[shared.range, s.range, className].filter(Boolean).join(' ')}
      style={{ ['--slider-fill' as string]: `${filled}%`, ...style } as CSSProperties}
    />
  );
}
