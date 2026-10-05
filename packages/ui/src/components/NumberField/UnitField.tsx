import { useEffect, useRef, useState } from 'react';
import { decimal, parseAs, parseNumber, qty, type Display, type UnitTable } from '@weasel-js/quantity';
import { clampToBounds, spinKey } from '../spin';
import f from '../field.module.css';
import s from './NumberField.module.css';

/** Props for {@link UnitField}. */
export interface UnitFieldProps {
  /** The value in the unit the field shows. NaN shows an empty field. */
  value: number;
  /** The committed value, read and clamped, in the unit the field shows: on
   *  blur or Enter, and on every step. */
  onChange: (value: number) => void;
  /** The live value: every keystroke that reads as a number, and every step. */
  onInput?: (value: number) => void;
  minValue?: number;
  maxValue?: number;
  /** What an arrow key, a stepper or a wheel notch adds or takes away; Page Up
   *  and Page Down move ten. Defaults to 1. */
  step?: number;
  /** Units a person may type, each mapped to the factor that turns a number
   *  in it into the unit the field shows: `{ mm: 0.1, cm: 1 }`. */
  accepts?: Readonly<UnitTable>;
  /** How the value shows, is spoken, and reads back when typed: `fraction()`
   *  shows `1/12` and reads `1/12` typed. `accepts`, when given, does the
   *  reading instead. Default: the number with every decimal it has. */
  display?: Display;
  placeholder?: string;
  /** Up and down buttons beside the value, which repeat while held. */
  steppers?: boolean;
  /** Render with no box until focused, as {@link NumberField}'s `ghost` does. */
  ghost?: boolean;
  /** As {@link NumberField}'s `width`. */
  width?: 'fill' | 'fit';
  className?: string;
  /** Id for the input, for a `<label htmlFor>` outside it. */
  id?: string;
  'aria-label'?: string;
}

const FULL_PRECISION = decimal({ maxPlaces: 20, grouping: false });

const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 60;

/**
 * A number typed as text, so it can carry a unit: `12mm` in a field showing
 * centimeters commits `1.2`. Commits on blur or Enter, reverts on Escape or on
 * text it cannot read, and clamps to its bounds. Steps like a spin button —
 * arrows, Page Up and Down, Home and End to a bound, the wheel while focused,
 * and optional steppers. React Aria's `NumberField` refuses letters as they
 * are typed, which is why this is not that.
 */
export function UnitField({
  value,
  onChange,
  onInput,
  minValue,
  maxValue,
  step = 1,
  accepts,
  display = FULL_PRECISION,
  placeholder,
  steppers,
  ghost,
  width = 'fill',
  className,
  id,
  'aria-label': ariaLabel,
}: UnitFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const canceled = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const known = !Number.isNaN(value);
  const text = known ? qty(value, display).text : '';
  // `accepts` reads units; the display still reads its own words, like infinity's.
  const read = (typed: string) => {
    const n = accepts ? parseNumber(typed, accepts) : Number.NaN;
    return Number.isNaN(n) ? parseAs(typed, display) : n;
  };
  const bounds = { step, min: minValue, max: maxValue };

  // What a step starts from: the text as typed where it reads, else the value.
  const from = (): number => {
    const typed = draft === null ? value : read(draft);
    return Number.isFinite(typed) ? typed : Number.isFinite(value) ? value : 0;
  };
  const stepTo = (next: number) => {
    setDraft(null);
    onInput?.(next);
    if (next !== value) onChange(next);
  };
  const spin = (key: string): boolean => {
    const next = spinKey(key, from(), bounds);
    if (next === null) return false;
    stepTo(next);
    return true;
  };

  // The latest `spin`, for the listeners below, which outlive a render.
  const latestSpin = useRef(spin);
  useEffect(() => {
    latestSpin.current = spin;
  });

  // The wheel steps only a focused field, so scrolling past one changes nothing.
  // Not passive, so it can keep the page from scrolling under it.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el || e.deltaY === 0) return;
      e.preventDefault();
      latestSpin.current(e.deltaY < 0 ? 'ArrowUp' : 'ArrowDown');
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const repeat = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRepeat = () => {
    if (repeat.current !== null) clearTimeout(repeat.current);
    repeat.current = null;
  };
  useEffect(() => stopRepeat, []);
  const startRepeat = (key: 'ArrowUp' | 'ArrowDown') => {
    stopRepeat();
    latestSpin.current(key);
    const tick = (delay: number) => {
      repeat.current = setTimeout(() => {
        latestSpin.current(key);
        tick(REPEAT_EVERY_MS);
      }, delay);
    };
    tick(REPEAT_DELAY_MS);
  };
  const stepper = (key: 'ArrowUp' | 'ArrowDown', label: string, glyph: string, atBound: boolean) => (
    <button
      type="button"
      className={s.stepper}
      aria-label={label}
      tabIndex={-1}
      disabled={atBound}
      // Keeps focus in the input, where a press on the button would take it.
      onPointerDown={(e) => {
        e.preventDefault();
        startRepeat(key);
      }}
      onPointerUp={stopRepeat}
      onPointerLeave={stopRepeat}
      onPointerCancel={stopRepeat}
      // A click with no pointer down before it — assistive tech, or a test.
      onClick={(e) => {
        if (e.detail === 0) latestSpin.current(key);
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div
      className={[f.field, f.control, width === 'fit' && `${f.fit} ${s.fit}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={[f.frame, s.frame, ghost && s.ghost].filter(Boolean).join(' ')}>
        <input
          ref={input}
          id={id}
          type="text"
          role="spinbutton"
          inputMode="decimal"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-valuenow={Number.isFinite(value) ? value : undefined}
          aria-valuetext={known ? qty(value, display).spoken : undefined}
          aria-valuemin={minValue}
          aria-valuemax={maxValue}
          placeholder={placeholder}
          value={draft ?? text}
          onChange={(e) => {
            const typed = e.target.value;
            setDraft(typed);
            const n = read(typed);
            if (onInput && typed.trim() !== '' && !Number.isNaN(n)) onInput(clampToBounds(n, bounds));
          }}
          onFocus={() => {
            canceled.current = false;
          }}
          onBlur={() => {
            if (draft !== null && !canceled.current) {
              const n = read(draft);
              if (!Number.isNaN(n)) {
                const next = clampToBounds(n, bounds);
                if (next !== value) onChange(next);
              }
            }
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              canceled.current = true;
              e.currentTarget.blur();
            } else if (spin(e.key)) {
              e.preventDefault();
            }
          }}
        />
        {steppers && (
          <div className={s.steppers}>
            {stepper('ArrowUp', 'Increment', '▲', known && maxValue !== undefined && value >= maxValue)}
            {stepper('ArrowDown', 'Decrement', '▼', known && minValue !== undefined && value <= minValue)}
          </div>
        )}
      </div>
    </div>
  );
}
