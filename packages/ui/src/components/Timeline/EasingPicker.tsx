import type { ReactElement } from 'react';
import type { EasingSpec } from '@weasel-js/core';
import s from './Timeline.module.css';
import { EASING_NAMES, easingBezier, easingLabel, sampleEasing } from './easingSpec';

/** Samples drawn in the inline curve preview. */
const PREVIEW_SAMPLES = 24;

/** Control points for the named curves the picker can convert. A name the table
 *  does not cover converts to the CSS default rather than refusing. */
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
};

const DEFAULT_BEZIER: readonly [number, number, number, number] = [0.25, 0.1, 0.25, 1];

export interface EasingPickerProps {
  value: EasingSpec | undefined;
  onChange: (next: EasingSpec | undefined) => void;
}

export function EasingPicker(props: EasingPickerProps): ReactElement {
  const { value, onChange } = props;
  const bezier = easingBezier(value);
  const label = easingLabel(value);
  const named = bezier === null && (EASING_NAMES as string[]).includes(label);
  const selectValue = bezier !== null ? 'custom' : named ? label : 'linear';

  const points = sampleEasing(value, PREVIEW_SAMPLES)
    .map((v, i) => `${(i / (PREVIEW_SAMPLES - 1)) * 100},${100 - v * 100}`)
    .join(' ');

  return (
    <div className={s.easingPicker}>
      <label>
        Easing
        <select
          value={selectValue}
          onChange={(e) => onChange(e.target.value === 'linear' ? undefined : e.target.value as EasingSpec)}
        >
          <option value="linear">linear</option>
          {EASING_NAMES.filter((n) => n !== 'linear').map((n) => <option key={n} value={n}>{n}</option>)}
          {bezier !== null ? <option value="custom">custom</option> : null}
        </select>
      </label>

      {bezier !== null ? <span className={s.easingLabel}>{label}</span> : (
        <button
          type="button"
          className={s.transportButton}
          onClick={() => onChange({ bezier: BEZIER_OF[selectValue] ?? DEFAULT_BEZIER })}
        >
          Convert to bezier
        </button>
      )}

      <svg className={s.easingPreview} data-testid="easing-preview" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={points} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
