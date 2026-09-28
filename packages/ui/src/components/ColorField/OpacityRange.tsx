import { useState, type ReactElement } from 'react';
import { InlineRange } from '../InlineRange';
import shared from '../range.module.css';
import s from './OpacityRange.module.css';

/** Props for {@link OpacityRange}. Alphas are 0..1 at 1% resolution. */
export interface OpacityRangeProps {
  value: number;
  disabled?: boolean;
  /** Names what the opacity belongs to; the slider is `<label> opacity`. */
  'aria-label'?: string;
  onInput?: (alpha01: number) => void;
  /** One call per gesture, and none for a gesture that moved nothing. */
  onChange: (alpha01: number) => void;
}

/**
 * The opacity slider and its percent readout, as two inline items for the
 * caller's own row. `ColorField` puts it beside a swatch; `PaintInput` puts it
 * under a paint with no single color to carry an alpha.
 */
export function OpacityRange(props: OpacityRangeProps): ReactElement {
  const { value, disabled = false, onInput, onChange } = props;
  const label = props['aria-label'];
  // Tracks the thumb during a gesture — the committed prop only updates after
  // onChange — then resets to follow the prop again.
  const [draft, setDraft] = useState<number | null>(null);
  const pct = draft ?? Math.round(value * 100);

  const commit = (): void => {
    if (draft === null) return;
    onChange(draft / 100);
    setDraft(null);
  };

  return (
    <>
      <InlineRange
        className={`${s.range} ${shared.alpha}`}
        min={0}
        max={100}
        step={1}
        value={pct}
        disabled={disabled}
        aria-label={label ? `${label} opacity` : 'Opacity'}
        onInput={(e) => {
          const next = Number((e.target as HTMLInputElement).value);
          setDraft(next);
          onInput?.(next / 100);
        }}
        onPointerUp={commit}
        onPointerCancel={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span className={s.readout} aria-hidden="true">{pct}%</span>
    </>
  );
}
