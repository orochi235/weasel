import { useMemo, useRef, type ReactNode } from 'react';
import {
  I18nProvider,
  useLocale,
  Slider as RACSlider,
  SliderOutput,
  SliderTrack,
  SliderThumb,
  Label,
  type SliderProps as RACSliderProps,
} from 'react-aria-components';
import { useInlineDirection } from '../Along/useReadingRun';
import s from './RangeSlider.module.css';

/** `locale` with its script swapped for one written `direction`, its numbering system pinned so digits don't change.
 *  React Aria takes direction from the locale alone. */
function localeWritten(locale: string, direction: 'ltr' | 'rtl'): string {
  const numberingSystem = new Intl.NumberFormat(locale).resolvedOptions().numberingSystem;
  return new Intl.Locale(locale, { script: direction === 'rtl' ? 'Arab' : 'Latn', numberingSystem }).toString();
}

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
 *
 * The root is a column flex container and the track stretches to it, so
 * `align-items` on the root or on a wrapper that replaces it governs the
 * *horizontal* axis here and collapses the track to its content width. Style
 * the wrapper around one, not the root.
 *
 * It follows its computed `direction`, as `Slider` does, rather than the locale's: under `rtl` its values run from
 * the right end and ArrowRight steps down.
 *
 * Straight only; for a control along a curve, use `Slider` inside `Along`.
 */
export function RangeSlider(props: RangeSliderProps) {
  const { label, showOutput, formatOutput, className, ...rest } = props;
  const wantOutput = showOutput ?? label !== undefined;
  const root = useRef<HTMLDivElement | null>(null);
  const direction = useInlineDirection(root);
  const { locale, direction: localeDirection } = useLocale();
  const written = useMemo(
    () => (direction === localeDirection ? locale : localeWritten(locale, direction)),
    [locale, localeDirection, direction],
  );
  return (
    <I18nProvider locale={written}>
      <RACSlider {...rest} ref={root} className={[s.slider, className].filter(Boolean).join(' ')}>
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
          {({ state, orientation }) => {
            // Single-thumb: fill from start to thumb. Multi-thumb: fill
            // between adjacent thumbs (simplest = between first and last).
            const fillStart = state.values.length > 1 ? state.getThumbPercent(0) * 100 : 0;
            const fillEnd = state.getThumbPercent(state.values.length - 1) * 100;
            return (
              <>
                <div
                  data-range-fill
                  className={s.fill}
                  style={
                    orientation === 'vertical'
                      ? { bottom: `${fillStart}%`, top: `${100 - fillEnd}%` }
                      : { insetInlineStart: `${fillStart}%`, insetInlineEnd: `${100 - fillEnd}%` }
                  }
                />
                {state.values.map((_, i) => (
                  <SliderThumb key={i} index={i} className={s.thumb} />
                ))}
              </>
            );
          }}
        </SliderTrack>
      </RACSlider>
    </I18nProvider>
  );
}
