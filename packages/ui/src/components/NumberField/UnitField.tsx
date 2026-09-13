import { useRef, useState } from 'react';
import { formatNumber, parseNumber } from '../../format/number';
import { fieldClasses } from '../Field/Field';
import s from './NumberField.module.css';

/** Props for {@link UnitField}. */
export interface UnitFieldProps {
  /** The value in the unit the field shows. NaN shows an empty field. */
  value: number;
  /** Fired with a value the field read and clamped, in the unit it shows. */
  onChange: (value: number) => void;
  minValue?: number;
  maxValue?: number;
  /** What an arrow key adds or takes away. Defaults to 1. */
  step?: number;
  /** Units a person may type, each mapped to the factor that turns a number
   *  in it into the unit the field shows: `{ mm: 0.1, cm: 1 }`. */
  accepts?: Readonly<Record<string, number>>;
  placeholder?: string;
  /** Render with no box until focused, as {@link NumberField}'s `ghost` does. */
  ghost?: boolean;
  /** As {@link NumberField}'s `width`. */
  width?: 'fill' | 'fit';
  className?: string;
  'aria-label'?: string;
}

/**
 * A number typed as text, so it can carry a unit: `12mm` in a field showing
 * centimeters commits `1.2`. Commits on blur or Enter, reverts on Escape or on
 * text it cannot read, clamps to its bounds, and steps with the arrow keys.
 * React Aria's `NumberField` refuses letters as they are typed, which is why
 * this is not that.
 */
export function UnitField({
  value,
  onChange,
  minValue,
  maxValue,
  step = 1,
  accepts,
  placeholder,
  ghost,
  width = 'fill',
  className,
  'aria-label': ariaLabel,
}: UnitFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const canceled = useRef(false);
  const text = Number.isFinite(value)
    ? formatNumber(value, { useGrouping: false, maximumFractionDigits: 20 })
    : '';
  const clamp = (n: number) =>
    Math.min(maxValue ?? Infinity, Math.max(minValue ?? -Infinity, n));
  const commit = (n: number) => {
    const next = clamp(n);
    if (next !== value) onChange(next);
  };

  return (
    <div
      className={[s.field, width === 'fit' && s.fit, fieldClasses.root, className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={ghost ? `${s.frame} ${s.ghost}` : s.frame}>
        <input
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={draft ?? text}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => {
            canceled.current = false;
          }}
          onBlur={() => {
            if (draft !== null && !canceled.current) {
              const n = parseNumber(draft, accepts);
              if (Number.isFinite(n)) commit(n);
            }
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              canceled.current = true;
              e.currentTarget.blur();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const typed = draft === null ? value : parseNumber(draft, accepts);
              const from = Number.isFinite(typed) ? typed : 0;
              const next = clamp(from + (e.key === 'ArrowUp' ? step : -step));
              setDraft(null);
              if (next !== value) onChange(next);
            }
          }}
        />
      </div>
    </div>
  );
}
