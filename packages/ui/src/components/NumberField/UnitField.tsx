import { type KeyboardEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { imeKey } from '@weasel-js/headless';
import {
  canSpin, clampToBounds, decimal, endlessAllows, parseAs, parseNumber, qty, spinKey, type Display, type Endless, type UnitTable,
} from '@weasel-js/quantity';
import f from '../field.module.css';
import { fieldRootClass } from '../Field/fieldSlots';
import { MIXED_HINT } from '../mixedHint';
import s from './NumberField.module.css';
import { useStepRepeat } from './useStepRepeat';

/** Props for {@link UnitField}. */
export interface UnitFieldProps {
  /** The value in the unit the field shows. NaN shows an empty field. */
  value: number;
  /** The committed value, read and clamped, in the unit the field shows: on
   *  blur or Enter, and on every step. */
  onChange: (value: number) => void;
  /** The live value: every keystroke that reads as a number, and every step.
   *  Typing that ends in Escape, or in text the field cannot read, sends the
   *  value it began from, so a caller holding the live value gets it back. */
  onInput?: (value: number) => void;
  /**
   * An amount typed as `+=` or `-=` and a number — `+=5`, `-=2mm` — committed
   * as an offset rather than a value: for a field standing for several values
   * at once, each moved by its own amount. Without it the offset applies to
   * `value` and commits through `onChange`.
   */
  onOffset?: (delta: number) => void;
  /** Typing that reached `onInput` was abandoned: it ended in Escape, or in
   *  text the field cannot read. Comes after the `onInput` that gives the
   *  starting value back, and alone when the field began at NaN, which is no
   *  value to send. */
  onCancel?: () => void;
  /** The field was emptied and left, by blur or Enter: the value is to be unset. Without it an emptied field
   *  puts its value back, as it does for any text it cannot read. Not called on Escape, nor for a field that
   *  showed no value to begin with. */
  onClear?: () => void;
  minValue?: number;
  maxValue?: number;
  /** The ends that stand for infinity: typed, or stepped to one step past the bound, the field holds it. */
  endless?: Endless;
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
  /** The field stands for several values that differ: it shows empty, reading
   *  `Mixed` in place of `placeholder`, whatever `value` is. */
  mixed?: boolean;
  /** Up and down buttons beside the value, which repeat while held. */
  steppers?: boolean;
  /** The field and its steppers take no input. */
  disabled?: boolean;
  /** Which end of the field the steppers sit at. Defaults to `'start'`. */
  stepperSide?: StepperSide;
  /** Render with no box until focused, as {@link NumberField}'s `ghost` does. */
  ghost?: boolean;
  /** As {@link NumberField}'s `width`. */
  width?: 'fill' | 'fit';
  className?: string;
  /** Id for the input, for a `<label htmlFor>` outside it. */
  id?: string;
  'aria-label'?: string;
}

/** Which end of a `UnitField` its steppers sit at. */
export type StepperSide = 'start' | 'end';

const FULL_PRECISION = decimal({ maxPlaces: 20, grouping: false });

/** What a step starts from: the text as typed where it reads as a value the field can hold, else the value. */
function stepStart(typed: number, value: number, endless: Endless | undefined): number {
  const holds = (n: number) => Number.isFinite(n) || endlessAllows(endless, n);
  return holds(typed) ? typed : holds(value) ? value : 0;
}

/**
 * A number typed as text, so it can carry a unit: `12mm` in a field showing
 * centimeters commits `1.2`. Commits on blur or Enter, reverts on Escape or on
 * text it cannot read, and clamps to its bounds. Steps like a spin button —
 * arrows, Page Up and Down, Home and End to a bound, the wheel while focused,
 * and optional steppers. React Aria's `NumberField` refuses letters as they
 * are typed, which is why this is not that.
 */
export function UnitField({
  value: valueProp,
  onChange,
  onInput,
  onCancel,
  onOffset,
  onClear,
  minValue,
  maxValue,
  endless,
  step = 1,
  accepts,
  display = FULL_PRECISION,
  placeholder,
  mixed = false,
  steppers,
  disabled = false,
  stepperSide = 'start',
  ghost,
  width = 'fill',
  className,
  id,
  'aria-label': ariaLabel,
}: UnitFieldProps) {
  const value = mixed ? Number.NaN : valueProp;
  const [draft, setDraft] = useState<string | null>(null);
  const canceled = useRef(false);
  // The value typing began from, and whether any keystroke reached `onInput`.
  const typing = useRef<{ from: number; sent: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const known = !Number.isNaN(value);
  const text = known ? qty(value, display).text : '';
  // `accepts` reads units; the display still reads its own words, like infinity's.
  const read = (typed: string) => {
    const n = accepts ? parseNumber(typed, accepts) : Number.NaN;
    return Number.isNaN(n) ? parseAs(typed, display) : n;
  };
  const bounds = { step, min: minValue, max: maxValue, endless };

  const from = (): number => stepStart(draft === null ? value : read(draft), value, endless);
  const stepTo = (next: number) => {
    setDraft(null);
    typing.current = null;
    onInput?.(next);
    if (next !== value) onChange(next);
  };
  const spin = (key: string): boolean => {
    const next = spinKey(key, from(), bounds);
    if (next === null) return false;
    stepTo(next);
    return true;
  };

  /** Commit a typed `n`, or give back the value typing began from when `n` is no number. */
  const commit = (n: number) => {
    if (!Number.isNaN(n)) {
      const next = clampToBounds(n, bounds);
      if (next !== value) onChange(next);
    } else if (typing.current?.sent) {
      if (!Number.isNaN(typing.current.from)) onInput?.(typing.current.from);
      onCancel?.();
    }
  };

  /** Whether `key` has nowhere left to step to. */
  const spent = (key: string): boolean => !canSpin(key, from(), bounds);

  // The latest `spin` and `spent`, for the listeners below, which outlive a render.
  const latestSpin = useRef(spin);
  const latestSpent = useRef(spent);
  useEffect(() => {
    latestSpin.current = spin;
    latestSpent.current = spent;
  });

  useWheelSteps(input, latestSpin);

  const repeat = useStepRepeat(latestSpin, latestSpent);
  const stepper = (key: 'ArrowUp' | 'ArrowDown', label: string, glyph: string, atBound: boolean) => (
    <Stepper
      label={label}
      glyph={glyph}
      disabled={atBound || disabled}
      onHold={() => repeat.start(key)}
      onRelease={repeat.stop}
      onTap={() => latestSpin.current(key)}
    />
  );

  return (
    <div
      className={fieldRootClass({ width, fit: s.fit, className })}
    >
      <div
        className={[f.frame, s.frame, ghost && s.ghost].filter(Boolean).join(' ')}
        data-stepper-side={stepperSide}
        {...(disabled ? { 'data-disabled': '' } : {})}
      >
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
          placeholder={mixed ? MIXED_HINT : placeholder}
          disabled={disabled}
          value={draft ?? text}
          onChange={(e) => {
            const typed = e.target.value;
            setDraft(typed);
            typing.current ??= { from: value, sent: false };
            const n = read(typed);
            if (onInput && typed.trim() !== '' && !Number.isNaN(n)) {
              typing.current.sent = true;
              onInput(clampToBounds(n, bounds));
            }
          }}
          onFocus={() => {
            canceled.current = false;
          }}
          onBlur={() => {
            const typedText = canceled.current ? null : draft;
            const by = typedText === null ? null : offsetIn(typedText, read);
            if (typedText?.trim() === '' && known && onClear) onClear();
            else if (by !== null && Number.isFinite(by) && onOffset) onOffset(by);
            else commit(typedText === null ? Number.NaN : by !== null ? value + by : read(typedText));
            typing.current = null;
            setDraft(null);
          }}
          onKeyDown={(e) => fieldKey(e, canceled, spin)}
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

/** Enter commits, Escape cancels, and an arrow steps; an input method's keys are its own. */
function fieldKey(e: KeyboardEvent<HTMLInputElement>, canceled: RefObject<boolean>, spin: (key: string) => boolean): void {
  if (imeKey(e.nativeEvent)) return;
  if (e.key === 'Enter') {
    e.currentTarget.blur();
  } else if (e.key === 'Escape') {
    canceled.current = true;
    e.currentTarget.blur();
  } else if (spin(e.key)) {
    e.preventDefault();
  }
}

/** The wheel steps only a focused field, so scrolling past one changes nothing.
 *  Not passive, so it can keep the page from scrolling under it. */
function useWheelSteps(
  input: RefObject<HTMLInputElement | null>,
  spin: RefObject<(key: string) => boolean>,
): void {
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el || e.deltaY === 0) return;
      e.preventDefault();
      spin.current(e.deltaY < 0 ? 'ArrowUp' : 'ArrowDown');
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [input, spin]);
}

/** What `typed` offsets by when it reads as `+=` or `-=` and a number: NaN
 *  when the number does not read, and null for text that is no offset. */
function offsetIn(typed: string, read: (text: string) => number): number | null {
  const m = /^\s*([+-])=\s*(.*)$/.exec(typed);
  if (!m) return null;
  const n = read(m[2]);
  return m[1] === '-' ? -n : n;
}

interface StepperProps {
  label: string;
  glyph: string;
  disabled: boolean;
  onHold: () => void;
  onRelease: () => void;
  onTap: () => void;
}

function Stepper({ label, glyph, disabled, onHold, onRelease, onTap }: StepperProps) {
  return (
    <button
      type="button"
      className={s.stepper}
      data-wzl-subordinate=""
      aria-label={label}
      tabIndex={-1}
      disabled={disabled}
      // Keeps focus in the input, where a press on the button would take it.
      onPointerDown={(e) => {
        e.preventDefault();
        onHold();
      }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      // A click with no pointer down before it — assistive tech, or a test.
      onClick={(e) => {
        if (e.detail === 0) onTap();
      }}
    >
      {glyph}
    </button>
  );
}
