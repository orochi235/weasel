import { type FocusEventHandler, type KeyboardEvent, type ReactNode, type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { useObjectRef } from 'react-aria';
import { imeKey } from '@weasel-js/ui-input';
import {
  canSpin, clampToBounds, decimal, endlessAllows, parseAs, parseNumber, qty, spinKey, type Display, type Endless, type UnitTable,
} from '@weasel-js/quantity';
import f from '../Field/Field.module.css';
import { fieldRootClass, NativeFieldFoot, type FieldSlotProps } from '../Field/fieldSlots';
import { shows, useFieldControl, useFieldIds, type FieldControlAttrs } from '../Field/fieldSemantics';
import { describedBy } from '../Disabled/HoldReason';
import { MIXED_HINT } from '../Field/mixedHint';
import s from './NumberField.module.css';
import type { HoldProps } from '../Disabled';
import { useNativeHold, type NativeHold } from '../Disabled/nativeHold';
import type { ControlSizeProps } from '../ControlSize';
import { useFieldSizeClass } from '../Field/fieldSize';
import { Steppers } from './Steppers';
import { useIdleSettle } from '../../useIdleSettle';
import { useFieldLocale } from '../../useFieldLocale';

/** Props for {@link UnitField}. */
export interface UnitFieldProps extends HoldProps, ControlSizeProps, Omit<FieldSlotProps, 'errorMessage'> {
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
  /** BCP 47 locale the field shows and reads its number in: `2,5` and `1.500` in `de-DE`. Defaults to React Aria's
   *  locale — an `<I18nProvider>` above, else the browser's — and falls back as `fieldLocale` does where a locale's
   *  numbers would not read back as shown. */
  locale?: string;
  placeholder?: string;
  /** The field stands for several values that differ: it shows empty, reading
   *  `Mixed` in place of `placeholder`, whatever `value` is. */
  mixed?: boolean;
  /** Up and down buttons beside the value, which repeat while held. */
  steppers?: boolean;
  /** Commit typed text once typing rests, as well as on blur or Enter: text that reads as a value inside the
   *  bounds, while the field keeps the text as typed. Defaults to the `typing.settleWhenIdle` kit setting. */
  settleWhenIdle?: boolean;
  /** Which end of the field the steppers sit at. Defaults to `'start'`. */
  stepperSide?: StepperSide;
  /** Render with no box until focused, as {@link NumberField}'s `ghost` does. */
  ghost?: boolean;
  /** As {@link NumberField}'s `width`. */
  width?: 'fill' | 'fit';
  className?: string;
  /** Shown under the field while `isInvalid`, and its accessible description then. */
  errorMessage?: ReactNode;
  /** The value is wrong: the field is drawn and announced as invalid, and shows `errorMessage`. */
  isInvalid?: boolean;
  isRequired?: boolean;
  /** Submits the value, as a plain number in the unit the field shows, with a form under this name. */
  name?: string;
  autoFocus?: boolean;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  /** Called after the field has committed what was typed. */
  onBlur?: FocusEventHandler<HTMLInputElement>;
  /** Id for the input, for a `<label htmlFor>` outside it. */
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  /** Receives the `<input>`, to move focus to it. */
  ref?: Ref<HTMLInputElement>;
}

/** Which end of a `UnitField` its steppers sit at. */
export type StepperSide = 'start' | 'end';

const FULL_PRECISION = decimal({ maxPlaces: 20, grouping: false });

type Bounds = Parameters<typeof clampToBounds>[1];

/** How typed text reads in `locale`: `accepts` reads units, and the display still reads its own words, like infinity's. */
function reader(accepts: Readonly<UnitTable> | undefined, display: Display, locale: string): (typed: string) => number {
  return (typed) => {
    const n = accepts ? parseNumber(typed, accepts, locale) : Number.NaN;
    return Number.isNaN(n) ? parseAs(typed, display, { locale }) : n;
  };
}

/** Whether the field can hold `n`: a finite number, or an infinity an endless end stands for. */
const holds = (n: number, endless: Endless | undefined): boolean => Number.isFinite(n) || endlessAllows(endless, n);

/** A typed `n` held to `bounds`, or NaN where even that is no value the field can hold: an infinity no bound clamps. */
function settled(n: number, bounds: Bounds): number {
  const next = clampToBounds(n, bounds);
  return holds(next, bounds.endless) ? next : Number.NaN;
}

/** What a step starts from: the text as typed where it reads as a value the field can hold, else the value. */
function stepStart(typed: number, value: number, endless: Endless | undefined): number {
  return holds(typed, endless) ? typed : holds(value, endless) ? value : 0;
}

/**
 * A number typed as text, so it can carry a unit: `12mm` in a field showing
 * centimeters commits `1.2`. Commits on blur or Enter, reverts on Escape or on
 * text it cannot read, and clamps to its bounds. Steps like a spin button —
 * arrows, Page Up and Down, Home and End to a bound, the wheel while focused,
 * and optional steppers. React Aria's `NumberField` refuses letters as they
 * are typed, which is why this is not that.
 *
 * It takes the same `label`, `description` and `errorMessage` slots as
 * `NumberField`; with no label or `aria-label` of its own, it takes the name,
 * description and error of a `Field` around it. `ref` reaches the `<input>`.
 */
export function UnitField(props: UnitFieldProps) {
  const { disabled, disabledReason, readOnly, readOnlyReason, label, orientation, description, errorMessage, isInvalid, isRequired, name, width = 'fill', className, size, ...body } = props;
  const sized = useFieldSizeClass(size, className);
  const own = useFieldIds({ id: props.id, label: label !== undefined, description: description !== undefined, error: !!isInvalid && shows(errorMessage) });
  const field = useFieldControl({
    id: label === undefined ? props.id : own.id,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'] ?? own.labelId,
    'aria-describedby': describedBy(own.describedBy, props['aria-describedby']),
  });
  const hold = useNativeHold({ disabled, disabledReason, readOnly, readOnlyReason, 'aria-describedby': field['aria-describedby'] });
  const invalid = isInvalid || field['aria-invalid'];
  const shown = props.mixed ? Number.NaN : props.value;
  return hold.wrap(
    <div className={fieldRootClass({ orientation, width, fit: s.fit, className: sized })} {...(invalid ? { 'data-invalid': '' } : {})}>
      {label !== undefined && <label id={own.labelId} htmlFor={field.id} className={f.label}>{label}</label>}
      <UnitFieldBody {...body} field={{ ...field, 'aria-invalid': invalid || undefined }} required={isRequired} hold={hold} />
      {name !== undefined && <input type="hidden" name={name} value={Number.isNaN(shown) ? '' : String(shown)} />}
      <NativeFieldFoot ids={own} description={description} error={errorMessage} />
    </div>,
  );
}

function UnitFieldBody({
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
  locale: localeProp,
  placeholder,
  mixed = false,
  steppers,
  hold: { attrs: held, refuses: disabled, access },
  settleWhenIdle,
  stepperSide = 'start',
  ghost,
  autoFocus,
  onFocus,
  onBlur,
  ref,
  field,
  required,
}: Omit<UnitFieldProps, keyof HoldProps | 'id' | 'aria-label' | 'aria-labelledby' | 'aria-describedby'> & { hold: NativeHold; field: FieldControlAttrs; required?: boolean }) {
  const value = mixed ? Number.NaN : valueProp;
  const [draft, setDraft] = useState<string | null>(null);
  const canceled = useRef(false);
  // The value typing began from, and whether any keystroke reached `onInput`.
  const typing = useRef<{ from: number; sent: boolean } | null>(null);
  const input = useObjectRef(ref);
  const locale = { locale: useFieldLocale(localeProp) };
  const known = !Number.isNaN(value);
  const shown = known ? qty(value, display, locale) : null;
  const read = reader(accepts, display, locale.locale);
  const bounds = { step, min: minValue, max: maxValue, endless };
  const idle = useIdleSettle(() => {
    const n = idleValue(draft, read, bounds);
    if (n !== null) typing.current = { from: n, sent: false };
    if (n !== null && n !== value) onChange(n);
  }, settleWhenIdle);

  const from = (): number => stepStart(draft === null ? value : read(draft), value, endless);
  const stepTo = (next: number) => {
    idle.stop();
    setDraft(null);
    typing.current = null;
    onInput?.(next);
    if (next !== value) onChange(next);
  };
  const spin = (key: string): boolean => {
    const next = disabled ? null : spinKey(key, from(), bounds);
    if (next === null) return false;
    stepTo(next);
    return true;
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

  return (
    <div
      className={[f.frame, s.frame, ghost && s.ghost].filter(Boolean).join(' ')}
      data-stepper-side={stepperSide}
      {...(access.state === 'disabled' ? { 'data-disabled': '' } : {})}
    >
      <input
        ref={input}
        {...field}
        type="text"
        role="spinbutton"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-required={required || undefined}
        aria-valuenow={Number.isFinite(value) ? value : undefined}
        aria-valuetext={shown?.spoken}
        aria-valuemin={minValue}
        aria-valuemax={maxValue}
        placeholder={mixed ? MIXED_HINT : placeholder}
        {...held} readOnly={disabled}
        value={draft ?? shown?.text ?? ''}
        onChange={(e) => {
          const typed = e.target.value;
          setDraft(typed);
          idle.typed();
          typing.current ??= { from: value, sent: false };
          const n = settled(read(typed), bounds);
          if (onInput && typed.trim() !== '' && !Number.isNaN(n)) {
            typing.current.sent = true;
            onInput(n);
          }
        }}
        onFocus={(e) => {
          canceled.current = false;
          onFocus?.(e);
        }}
        onBlur={(e) => {
          idle.stop();
          const typedText = canceled.current ? null : draft;
          const by = typedText === null ? null : offsetIn(typedText, read);
          if (typedText?.trim() === '' && known && onClear) onClear();
          else if (by !== null && Number.isFinite(by) && onOffset) onOffset(by);
          else commitTyped(typedText === null ? Number.NaN : by !== null ? value + by : read(typedText), { bounds, value, typing: typing.current, onChange, onInput, onCancel });
          typing.current = null;
          setDraft(null);
          onBlur?.(e);
        }}
        onKeyDown={(e) => fieldKey(e, canceled, spin)}
      />
      {steppers && (
        <Steppers
          spin={latestSpin}
          spent={latestSpent}
          disabled={disabled}
          atMax={spent('ArrowUp')}
          atMin={spent('ArrowDown')}
        />
      )}
    </div>
  );
}

/** Commit a typed `n`, or give back the value typing began from when `n` is no number. */
function commitTyped(
  n: number,
  { bounds, value, typing, onChange, onInput, onCancel }: {
    bounds: Bounds;
    value: number;
    typing: { from: number; sent: boolean } | null;
  } & Pick<UnitFieldProps, 'onChange' | 'onInput' | 'onCancel'>,
): void {
  const next = settled(n, bounds);
  if (!Number.isNaN(next)) {
    if (next !== value) onChange(next);
  } else if (typing?.sent) {
    if (!Number.isNaN(typing.from)) onInput?.(typing.from);
    onCancel?.();
  }
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

/** What a pause in typing commits: a value `typed` reads as inside `bounds`, and never an offset, so a pause
 *  neither applies one twice nor clamps or reformats the text under the caret. */
function idleValue(typed: string | null, read: (text: string) => number, bounds: Bounds): number | null {
  if (typed === null || typed.trim() === '' || offsetIn(typed, read) !== null) return null;
  const n = read(typed);
  return Number.isNaN(n) || settled(n, bounds) !== n ? null : n;
}

/** What `typed` offsets by when it reads as `+=` or `-=` and a number: NaN
 *  when the number does not read, and null for text that is no offset. */
function offsetIn(typed: string, read: (text: string) => number): number | null {
  const m = /^\s*([+-])=\s*(.*)$/.exec(typed);
  if (!m) return null;
  const n = read(m[2]);
  return m[1] === '-' ? -n : n;
}
