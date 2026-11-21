import type { ReactElement } from 'react';
import type { HoldProps } from '../Disabled';
import { useNativeHold } from '../Disabled/nativeHold';
import { usePropertyRow } from '../Properties/rowScope';
import { getOwn } from '@weasel-js/registry';
import { EASING_NAMES, easingBezier, easingLabel, sampleEasing, type EasingSpec } from '@weasel-js/geom';
import s from './EasingPicker.module.css';

/** Samples drawn in the inline curve preview. */
const PREVIEW_SAMPLES = 24;

/** Control points for the named curves the picker can convert. Elastic and bounce curves have no single cubic, so
 *  the picker offers no conversion of them. */
const BEZIER_OF: Partial<Record<string, readonly [number, number, number, number]>> = {
  linear: [0, 0, 1, 1],
  easeInQuad: [0.11, 0, 0.5, 0],
  easeOutQuad: [0.5, 1, 0.89, 1],
  easeInOutQuad: [0.45, 0, 0.55, 1],
  easeInCubic: [0.32, 0, 0.67, 0],
  easeOutCubic: [0.33, 1, 0.68, 1],
  easeInOutCubic: [0.65, 0, 0.35, 1],
  easeInSine: [0.12, 0, 0.39, 0],
  easeOutSine: [0.61, 1, 0.88, 1],
  easeInOutSine: [0.37, 0, 0.63, 1],
  easeInQuart: [0.5, 0, 0.75, 0],
  easeOutQuart: [0.25, 1, 0.5, 1],
  easeInOutQuart: [0.76, 0, 0.24, 1],
  easeInQuint: [0.64, 0, 0.78, 0],
  easeOutQuint: [0.22, 1, 0.36, 1],
  easeInOutQuint: [0.83, 0, 0.17, 1],
  easeInExpo: [0.7, 0, 0.84, 0],
  easeOutExpo: [0.16, 1, 0.3, 1],
  easeInOutExpo: [0.87, 0, 0.13, 1],
  easeInCirc: [0.55, 0, 1, 0.45],
  easeOutCirc: [0, 0.55, 0.45, 1],
  easeInOutCirc: [0.85, 0, 0.15, 1],
  easeInBack: [0.36, 0, 0.66, -0.56],
  easeOutBack: [0.34, 1.56, 0.64, 1],
  easeInOutBack: [0.68, -0.6, 0.32, 1.6],
};

/** Props for {@link EasingPicker}. `undefined` is linear. Disabled or read-only, by its own props or a scope, it
 *  changes nothing. */
export interface EasingPickerProps extends HoldProps {
  value: EasingSpec | undefined;
  onChange: (next: EasingSpec | undefined) => void;
  /** The menu's label, and its accessible name. `false` draws none, naming the menu `Easing`. Inside a
   *  `PropertyRow` it defaults to `false`, and the menu takes the row's label for its name. Default `Easing`. */
  label?: string | false;
}

/** A key's easing: a menu of the named curves, a button converting a named
 *  curve to its cubic-bezier control points, and a plot of the curve. */
export function EasingPicker(props: EasingPickerProps): ReactElement {
  const { value } = props;
  const hold = useNativeHold(props);
  const onChange = (next: EasingSpec | undefined) => { if (!hold.refuses) props.onChange(next); };
  const row = usePropertyRow();
  const shown = props.label ?? (row ? false : 'Easing');
  const name = shown !== false ? shown : typeof row?.label === 'string' && row.label !== '' ? row.label : 'Easing';
  const bezier = easingBezier(value);
  const label = easingLabel(value);
  const named = bezier === null && (EASING_NAMES as string[]).includes(label);
  // Neither a name nor control points: a function the picker can show but not convert.
  const custom = !named;
  const selectValue = custom ? 'custom' : label;
  const convertible = named ? getOwn(BEZIER_OF, label) : undefined;

  const points = sampleEasing(value, PREVIEW_SAMPLES)
    .map((v, i) => `${(i / (PREVIEW_SAMPLES - 1)) * 100},${100 - v * 100}`)
    .join(' ');

  const menu = (
    <select
      {...hold.attrs}
      aria-label={shown === false ? name : undefined}
      value={selectValue}
      onChange={(e) => onChange(e.target.value === 'linear' ? undefined : e.target.value as EasingSpec)}
    >
      <option value="linear">linear</option>
      {EASING_NAMES.filter((n) => n !== 'linear').map((n) => <option key={n} value={n}>{n}</option>)}
      {custom ? <option value="custom">custom</option> : null}
    </select>
  );

  return hold.wrap(
    <div className={s.easingPicker}>
      {shown === false ? menu : (
        <label>
          {shown}
          {menu}
        </label>
      )}

      {custom ? <span className={s.easingLabel}>{label}</span> : convertible && (
        <button
          type="button"
          className={s.convert}
          {...hold.attrs}
          aria-readonly={undefined}
          onClick={() => onChange({ bezier: convertible })}
        >
          Convert to bezier
        </button>
      )}

      <svg className={s.easingPreview} data-testid="easing-preview" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={points} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>,
  );
}
