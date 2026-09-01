import type { ReactNode } from 'react';
import {
  Slider as RACSlider,
  SliderOutput,
  SliderTrack,
  SliderThumb,
  Label,
  type SliderProps as RACSliderProps,
} from 'react-aria-components';
import s from './RangeSlider.module.css';

/** Props for {@link RangeSlider}, on top of React Aria's `Slider` props. */
export type RangeSliderProps = Omit<RACSliderProps, 'children' | 'className'> & {
  label?: ReactNode;
  /** Show the current value next to the label. Defaults to true when a
   *  label is supplied. */
  showOutput?: boolean;
  /** Format the rendered value(s). Useful for units (`v => `${v}%``). */
  formatOutput?: (v: number | number[]) => ReactNode;
  className?: string;
};

/**
 * Linear range slider on React Aria. Single-value by default; pass an array
 * to `value` / `defaultValue` for multi-thumb. Distinct from `Slider`, which
 * is fully controlled and gives each thumb its own bounds and readout.
 */
export function RangeSlider(props: RangeSliderProps) {
  const { label, showOutput, formatOutput, className, ...rest } = props;
  const wantOutput = showOutput ?? label !== undefined;
  return (
    <RACSlider {...rest} className={[s.slider, className].filter(Boolean).join(' ')}>
      {(label !== undefined || wantOutput) && (
        <div className={s.head}>
          {label !== undefined && <Label className={s.label}>{label}</Label>}
          {wantOutput && (
            <SliderOutput className={s.output}>
              {({ state }) => {
                const v = state.values.length === 1 ? state.values[0] : state.values;
                return formatOutput ? formatOutput(v) : Array.isArray(v) ? v.join(' – ') : String(v);
              }}
            </SliderOutput>
          )}
        </div>
      )}
      <SliderTrack className={s.track}>
        {({ state }) => {
          // Single-thumb: fill from start to thumb. Multi-thumb: fill
          // between adjacent thumbs (simplest = between first and last).
          const fillStart = state.values.length > 1 ? state.getThumbPercent(0) * 100 : 0;
          const fillEnd = state.getThumbPercent(state.values.length - 1) * 100;
          return (
            <>
              <div
                className={s.fill}
                style={{ left: `${fillStart}%`, right: `${100 - fillEnd}%` }}
              />
              {state.values.map((_, i) => (
                <SliderThumb key={i} index={i} className={s.thumb} />
              ))}
            </>
          );
        }}
      </SliderTrack>
    </RACSlider>
  );
}
