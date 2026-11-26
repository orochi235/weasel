import type { ReactElement } from 'react';
import type { HoldProps } from '../Disabled';
import { useNativeHold } from '../Disabled/nativeHold';
import { usePropertyRow } from '../Properties/rowScope';
import {
  EASING_NAMES, easingBezier, easingDataOf, easingLabel, sampleEasing, type EasingName, type EasingSpec,
} from '@weasel-js/geom';
import s from './EasingPicker.module.css';

/** Samples drawn in the inline curve preview. */
const PREVIEW_SAMPLES = 24;

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
  const convertHold = useNativeHold(props, { readonlyRole: false, changes: true });
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
  // A curve blits stores as `linear()` points has no single cubic to convert to.
  const data = named ? easingDataOf(label as EasingName) : undefined;
  const convertible = data && 'bezier' in data ? data.bezier : undefined;

  const points = sampleEasing(value, PREVIEW_SAMPLES)
    .map((v, i) => `${(i / (PREVIEW_SAMPLES - 1)) * 100},${100 - v * 100}`)
    .join(' ');

  const menu = (
    <select
      {...hold.attrs}
      className={s.menu}
      aria-label={shown === false ? name : undefined}
      value={selectValue}
      onChange={(e) => onChange(e.target.value === 'linear' ? undefined : e.target.value as EasingSpec)}
    >
      <option value="linear">linear</option>
      {EASING_NAMES.filter((n) => n !== 'linear').map((n) => <option key={n} value={n}>{n}</option>)}
      {custom ? <option value="custom">custom</option> : null}
    </select>
  );

  return (
    <div className={s.easingPicker}>
      {hold.wrap(shown === false ? menu : (
        <label>
          {shown}
          {menu}
        </label>
      ))}

      {custom ? <span className={s.easingLabel}>{label}</span> : convertible && convertHold.wrap(
        <button
          type="button"
          className={s.convert}
          {...convertHold.attrs}
          onClick={() => onChange({ bezier: convertible })}
        >
          Convert to bezier
        </button>,
      )}

      <svg className={s.easingPreview} data-testid="easing-preview" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={points} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
