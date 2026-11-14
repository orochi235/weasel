import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { imeKey } from '@weasel-js/ui-input';
import { decimal, decimalPlaces, endlessTrack, parseAs, qty, spinKey, type Display } from '@weasel-js/quantity';
import { dlog } from '../../dlog';
import { useFieldLocale } from '../../useFieldLocale';
import { inlineDirection } from '../../useRovingTabIndex';
import { UnitField } from '../NumberField';
import shared from '../range.module.css';
import type { PropertyNumberFieldProps } from './fieldTypes';
import { PropertyRow } from './PropertyRow';
import s from './Properties.module.css';
import { useNativeHold } from '../Disabled/nativeHold';
import { trackPlace } from './sliderScale';
import { catchStop, useTrackStops } from './sliderStops';
import { attachesUnit, UnitSuffix } from './unitSuffix';

/**
 * A slider's props with its drag held locally. A caller taking settled values
 * only ignores `onInput`, so `value` stands still through the drag; without the
 * draft the controlled track snaps back on every move and commits from there.
 */
function useSliderDraft(p: PropertyNumberFieldProps): PropertyNumberFieldProps {
  // Held with the value it was dragged from: a drag that ends where it began
  // fires no `change`, and a draft left behind must not mask the next value.
  const [draft, setDraft] = useState<{ from: number | null | undefined; at: number }>();
  const { onInput, onChange } = p;
  if (!onInput) return p;
  return {
    ...p,
    value: draft !== undefined && Object.is(draft.from, p.value) ? draft.at : p.value,
    onInput: (next) => {
      setDraft({ from: p.value, at: next });
      onInput(next);
    },
    onChange: (next) => {
      setDraft(undefined);
      onChange(next);
    },
  };
}

export function SliderRow({ row, readout, control }: {
  row: Omit<ComponentProps<typeof PropertyRow>, 'children'>;
  readout: ReactNode;
  control: PropertyNumberFieldProps;
}) {
  const p = useSliderDraft(control);
  const replaced = boxedReadout(readout);
  return (
    <PropertyRow {...row} readout={replaced ?? <SliderReadout {...p} />}>
      <SliderTrack {...p} keyed={replaced != null} />
    </PropertyRow>
  );
}

export function SliderCell(props: PropertyNumberFieldProps) {
  const p = useSliderDraft(props);
  return (
    <>
      <SliderTrack {...p} />
      <span className={s.cellReadout}>
        <SliderReadout {...p} />
      </span>
    </>
  );
}

/**
 * A ref for an input whose commit half has to come off a real listener.
 *
 * A native `range` input fires `input` through a drag and `change` once at
 * the end, but React's synthetic `onChange` sees only the first: its value
 * tracker drops the unchanged second. So a track offering the live/committed
 * split reads the live half from React and the committed half from here.
 * `commit` is `undefined` when the track has one callback, which then fires
 * continuously.
 */
function useCommitListener(
  commit: ((raw: string) => void) | undefined,
): RefObject<HTMLInputElement | null> {
  const ref = useRef<HTMLInputElement>(null);
  const latest = useRef(commit);
  useEffect(() => {
    latest.current = commit;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCommit = () => latest.current?.(el.value);
    el.addEventListener('change', onCommit);
    return () => el.removeEventListener('change', onCommit);
  }, []);
  return ref;
}

export const ignore = (): void => {};

export function NumberInput(p: PropertyNumberFieldProps) {
  const known = isKnown(p);
  const input = (
    <UnitField
      id={p.id}
      className={p.className ? `${s.numberField} ${p.className}` : s.numberField}
      value={known ? (p.value as number) : NaN}
      placeholder={p.placeholder}
      mixed={p.mixed}
      minValue={p.min}
      maxValue={p.max}
      endless={p.endless}
      step={p.step}
      accepts={p.accepts}
      display={p.display}
      steppers={p.steppers}
      disabled={p.disabled}
      disabledReason={p.disabledReason}
      settleWhenIdle={p.settleWhenIdle}
      aria-label={p.name}
      onInput={p.onInput}
      onChange={p.onChange}
      onCancel={p.onCancel}
      onOffset={p.onOffset}
      onClear={p.onClear}
    />
  );
  if (p.unit == null || (known && !Number.isFinite(p.value))) return input;
  return (
    <span className={attachesUnit(p.unit) ? `${s.fieldUnitGroup} ${s.unitHost}` : s.fieldUnitGroup}>
      {input}
      <UnitSuffix unit={p.unit} className={s.readoutUnit} />
    </span>
  );
}

/** A value the field can show: a number, ±Infinity included, and not mixed. */
function isKnown(p: PropertyNumberFieldProps): p is PropertyNumberFieldProps & { value: number } {
  return !p.mixed && typeof p.value === 'number' && !Number.isNaN(p.value);
}

/** The readout a number shows when given no display: as many places as its
 *  `step` is written with, so integer steps show none, 0.1 one, 0.25 two. */
export function stepDisplay(step = 1): Display {
  return decimal({ places: step > 0 ? decimalPlaces(step) : 0, grouping: false });
}

/** How far a slider's track runs from the one end it has, or from 0 with neither. */
const OPEN_SPAN = 100;

/** A slider's track: `min` and `max` are the track's ends, one stop beyond the
 *  range at an endless end, and `OPEN_SPAN` from the other where an end is
 *  missing. `settle` turns a track position or a typed number into a value,
 *  ±Infinity at that stop, and `onTrack` puts a value back on the track.
 *  `reach` is how far a typed or stepped value goes: an open end, one missing
 *  with no stop for infinity, holds none back, and `held` keeps a value in it. */
function sliderBounds(p: PropertyNumberFieldProps): {
  min: number;
  max: number;
  step: number;
  settle: (v: number) => number;
  onTrack: (v: number) => number;
  held: (v: number) => number;
  reach: { min?: number; max?: number };
} {
  const step = p.step ?? 1;
  const lo = p.min ?? (p.max === undefined ? 0 : p.max - OPEN_SPAN);
  const hi = p.max ?? lo + OPEN_SPAN;
  const track = endlessTrack(lo, hi, step, p.endless);
  const openMin = p.min === undefined && track.min === lo;
  const openMax = p.max === undefined && track.max === hi;
  const within = (a: number, b: number) => (v: number) => Math.min(b, Math.max(a, track.toTrack(v)));
  const settle = (v: number) => ((openMax && v > hi) || (openMin && v < lo) ? v : track.fromTrack(v));
  return {
    min: track.min,
    max: track.max,
    step,
    settle,
    onTrack: within(track.min, track.max),
    held: within(openMin ? -Infinity : track.min, openMax ? Infinity : track.max),
    reach: { min: openMin ? undefined : track.min, max: openMax ? undefined : track.max },
  };
}

/** `keyed`: the track is the keyboard's way in, where the row's readout is not an editable one. */
function SliderTrack({ keyed: tabbable = false, ...p }: PropertyNumberFieldProps & { keyed?: boolean }) {
  const { min, max, step, settle, onTrack } = sliderBounds(p);
  const live = p.onInput ?? p.onChange;
  const commit = p.onInput ? p.onChange : undefined;
  const place = trackPlace(p.scale, min, max, step, p.stops);
  const range = useCommitListener(commit && ((raw) => commit(settle(place.fromInput(Number(raw))))));
  const stops = useTrackStops(p.stops, min, max, place.fraction);
  const known = isKnown(p);
  // The thumb clamps to the track; the readout beside it does not, so a value
  // past `max` is still reported as what it is.
  const value = known ? onTrack(p.value as number) : min;
  const hold = useNativeHold({ disabled: p.mixed || p.disabled, disabledReason: p.disabledReason });
  const keyed = (next: number) => {
    if (hold.refuses) return;
    live(settle(next));
    commit?.(settle(next));
  };
  return hold.wrap(
    // The shared skin with no fill: `InlineRange`'s filled-to-value track is its
    // own, and the property rows' 18% track is the one the kit converges on.
    <input
      ref={range}
      type="range"
      id={p.id}
      className={[shared.range, stops.className, p.className].filter(Boolean).join(' ')}
      style={stops.style}
      aria-label={p.name}
      // The readout is the keyboard's way in, and steps as the track would; a
      // tab stop here too would be two stops for one value. With no value it
      // shows a dash that takes no focus, so the track is the way in.
      tabIndex={tabbable || (!known && !p.mixed) ? undefined : -1}
      min={place.min}
      max={place.max}
      step={place.step}
      value={place.toInput(value)}
      {...hold.attrs}
      onPointerDown={hold.refuses ? undefined : stops.onPointerDown}
      onKeyDown={(e) => {
        const next = place.keyStep(e.key, value, inlineDirection(e.currentTarget));
        if (next === null) return;
        e.preventDefault();
        keyed(next);
      }}
      onChange={(e) => {
        if (hold.refuses) return;
        const v = settle(stops.settle(e.currentTarget, value, place.fromInput(Number(e.target.value))));
        dlog('property-panel', 'slider', { name: p.name, value: v });
        live(v);
      }}
    />,
  );
}

function SliderReadout(p: PropertyNumberFieldProps) {
  const { min, max, step, settle, held, reach } = sliderBounds(p);
  if (!isKnown(p)) return <>{boxedReadout('—')}</>;
  return (
    <EditableReadout
      name={p.name}
      value={p.value}
      min={min}
      max={max}
      step={step}
      reach={reach}
      settle={settle}
      onTrack={held}
      stops={p.stops}
      display={p.display ?? stepDisplay(step)}
      format={p.format}
      unit={p.unit}
      disabled={p.disabled}
      onCommit={(next) => {
        p.onInput?.(next);
        p.onChange(next);
      }}
    />
  );
}

/**
 * A replacement readout in the box `EditableReadout` would have occupied.
 *
 * A row that can go auto swaps its editable readout for a word, and the label
 * is a flex line: an input is taller than bare text — a text input's inner
 * editor will not shrink to a line-height below the font's own content area —
 * so the swap moved the label's baseline, and the whole row with it. Only the
 * slider owns an `EditableReadout`, so only it needs this; giving every text
 * readout the box moves the rows that never had an input.
 */
function boxedReadout(readout: ReactNode): ReactNode {
  if (typeof readout !== 'string' && typeof readout !== 'number') return readout;
  return (
    <span className={s.readoutGroup}>
      <span className={s.readoutText}>{readout}</span>
    </span>
  );
}

interface EditableReadoutProps {
  name: string | undefined;
  value: number;
  min: number;
  max: number;
  step: number;
  /** The bounds a typed or stepped value is held within; one absent holds none back. */
  reach: { min?: number; max?: number };
  /** The value a track position or a typed number stands for: ±Infinity at an
   *  endless end's stop. */
  settle: (v: number) => number;
  /** Where a value sits on the track. */
  onTrack: (v: number) => number;
  /** Where a key step crossing one stops, as the track's keys do. */
  stops?: readonly number[];
  display: Display;
  format?: (value: number) => ReactNode;
  unit?: ReactNode;
  disabled?: boolean;
  onCommit: (next: number) => void;
}

/**
 * Readout that swaps to a number input on click, commits on Enter/blur,
 * cancels on Escape, and steps like the track beside it. Clicks are stopped so
 * a wrapping <label> doesn't forward focus to the slider thumb.
 */
function EditableReadout({ name, value, min, max, step, reach, settle, onTrack, stops = [], display, format, unit, disabled, onCommit }: EditableReadoutProps) {
  // Draft is non-null only while the input is focused; the live value mirrors
  // into the input otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  const hold = useNativeHold({ disabled });
  const locale = { locale: useFieldLocale() };
  const text = (n: number) => (format ? String(format(n)) : qty(n, display, locale).text);
  const read = (typed: string) => parseAs(typed, display, locale);
  const displayValue = draft !== null ? draft : text(value);
  // The widest value the range can show, which the stylesheet widens the box to
  // fit: each end of the track, and the stop inside it where the end is infinity's.
  const widest = Math.max(...[min, min + step, max - step, max].map((at) => text(settle(at)).length));
  const fit = { '--wzl-property-readout-fit': `${widest}ch` };

  // Escape and Enter both leave by blurring, and that blur runs the handler of
  // the last render: a draft cleared in the same keydown is still set there.
  const canceled = useRef(false);
  const commit = () => {
    // A draft still reading as the value shown writes nothing: the readout rounds, and that text is not an edit.
    if (draft !== null && !canceled.current && !hold.refuses && draft !== text(value)) {
      const n = read(draft);
      if (!Number.isNaN(n)) onCommit(settle(n));
    }
    setDraft(null);
  };

  return (
    <span className={attachesUnit(unit) ? `${s.readoutGroup} ${s.unitHost}` : s.readoutGroup}>
      <input
        type="text"
        role="spinbutton"
        aria-label={name}
        aria-valuenow={onTrack(value)}
        aria-valuetext={format ? text(value) : qty(value, display, locale).spoken}
        aria-valuemin={reach.min}
        aria-valuemax={reach.max}
        inputMode="decimal"
        className={s.readoutInput}
        style={fit as CSSProperties}
        value={displayValue}
        {...hold.attrs}
        readOnly={hold.refuses}
        onFocus={(e) => {
          canceled.current = false;
          setDraft(text(value));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value.replace(/-/g, '−'))}
        onBlur={commit}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.focus();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (imeKey(e.nativeEvent)) return;
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            canceled.current = true;
            e.currentTarget.blur();
          } else {
            if (hold.refuses) return;
            const typed = draft === null ? value : read(draft);
            const from = onTrack(Number.isNaN(typed) ? value : typed);
            const spun = spinKey(e.key, from, { step, ...reach });
            if (spun === null) return;
            const next = catchStop(from, spun, stops);
            e.preventDefault();
            onCommit(settle(next));
            // A step is committed already; the box shows the value it comes back as.
            setDraft(null);
          }
        }}
      />
      {/* A word for infinity stands alone: `never`, not `never ms`. */}
      {Number.isFinite(value) && <UnitSuffix unit={unit} className={s.readoutUnit} />}
    </span>
  );
}
