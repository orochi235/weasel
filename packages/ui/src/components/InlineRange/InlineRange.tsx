import { type CSSProperties, forwardRef, type InputHTMLAttributes, type Ref } from 'react';
import shared from '../range.module.css';
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
};

/**
 * Compact range input for a property row: one track, no label, no output.
 *
 * Distinct from the kit's other two — `Slider` is shaped for canvas scrubbing,
 * and `RangeSlider` is a full-width labelled form control on React Aria. This
 * one exists to sit inline beside a swatch or a readout, and to own the track
 * painting both of those surfaces need.
 *
 * Straight only; for a control along a curve, use `Slider` inside `Along`. Held disabled for a reason, or read-only,
 * it stays focusable and drops every input, since its `value` is controlled.
 */
export const InlineRange = forwardRef(function InlineRange(
  props: InlineRangeProps,
  ref: Ref<HTMLInputElement>,
) {
  const { value, min = 0, max = 100, className, style, disabled, disabledReason, readOnly, readOnlyReason, ...own } = props;
  const hold = useNativeHold({ disabled, disabledReason, readOnly, readOnlyReason, 'aria-describedby': own['aria-describedby'] });
  const rest = hold.refuses ? { ...own, onInput: undefined, onChange: undefined } : own;
  const span = max - min;
  const filled = span > 0 ? ((Math.min(Math.max(value, min), max) - min) / span) * 100 : 0;
  return hold.wrap(
    <input
      {...rest}
      {...hold.attrs}
      ref={ref}
      type="range"
      value={value}
      min={min}
      max={max}
      className={[shared.range, s.range, className].filter(Boolean).join(' ')}
      style={{ ['--slider-fill' as string]: `${filled}%`, ...style } as CSSProperties}
    />,
  );
});
