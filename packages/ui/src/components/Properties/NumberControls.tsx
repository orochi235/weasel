import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { decimal, parseAs, qty, type Display } from '@weasel-js/quantity';
import { dlog } from '../../dlog';
import { endlessAt } from '../../endless';
import { UnitField } from '../NumberField';
import { spinKey } from '../spin';
import shared from '../range.module.css';
import type { PropertyNumberFieldProps } from './PropertyField';
import { PropertyRow } from './PropertyPanel';
import s from './Properties.module.css';

/**
 * A slider's props with its drag held locally. A caller taking settled values
 * only ignores `onInput`, so `value` stands still through the drag; without the
 * draft the controlled track snaps back on every move and commits from there.
 */
function useSliderDraft(p: PropertyNumberFieldProps): PropertyNumberFieldProps {
  const [draft, setDraft] = useState<number>();
  const { onInput, onChange } = p;
  if (!onInput) return p;
  return {
    ...p,
    value: draft ?? p.value,
    onInput: (next) => {
      setDraft(next);
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
  return (
    <PropertyRow {...row} readout={boxedReadout(readout) ?? <SliderReadout {...p} />}>
      <SliderTrack {...p} />
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

function unitSuffix(unit: ReactNode, className: string): ReactNode {
  if (unit == null) return null;
  return typeof unit === 'string' ? <span className={className}>{unit}</span> : unit;
}

export const ignore = (): void => {};

export function NumberInput(p: PropertyNumberFieldProps) {
  const known = isKnown(p);
  const input = (
    <UnitField
      id={p.id}
      className={p.className ? `${s.numberField} ${p.className}` : s.numberField}
      value={known ? (p.value as number) : NaN}
      placeholder={p.mixed ? 'Mixed' : p.placeholder}
      minValue={p.min}
      maxValue={p.max}
      step={p.step}
      accepts={p.accepts}
      display={p.display}
      steppers={p.steppers}
      aria-label={p.name}
      // With one callback it is the live one: every keystroke and step reaches
      // it, and the commit on blur would only repeat the last of them.
      onInput={p.onInput ?? p.onChange}
      onChange={p.onInput ? p.onChange : ignore}
    />
  );
  if (p.unit == null || (known && !Number.isFinite(p.value))) return input;
  return (
    <span className={s.fieldUnitGroup}>
      {input}
      {unitSuffix(p.unit, s.readoutUnit)}
    </span>
  );
}

/** A value the field can show: a number, ±Infinity included, and not mixed. */
function isKnown(p: PropertyNumberFieldProps): p is PropertyNumberFieldProps & { value: number } {
  return !p.mixed && typeof p.value === 'number' && !Number.isNaN(p.value);
}

/** The readout a slider shows when given no display: precision tracks `step`,
 *  so integer steps show none, 0.1 one, 0.05 two. */
export function stepDisplay(step = 1): Display {
  return decimal({ places: step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step)))), grouping: false });
}

/** A slider's bounds, with the 0..100 fallback for an unbounded track, and
 *  `settle`, which clamps a value onto the track and turns an endless end's
 *  stop into ±Infinity. */
function sliderBounds(p: PropertyNumberFieldProps): { min: number; max: number; step: number; settle: (v: number) => number } {
  const min = p.min ?? 0;
  const max = p.max ?? 100;
  const settle = (v: number) =>
    endlessAt(p.endless, 1) && v >= max ? Infinity
    : endlessAt(p.endless, -1) && v <= min ? -Infinity
    : Math.min(max, Math.max(min, v));
  return { min, max, step: p.step ?? 1, settle };
}

function SliderTrack(p: PropertyNumberFieldProps) {
  const { min, max, step, settle } = sliderBounds(p);
  const live = p.onInput ?? p.onChange;
  const commit = p.onInput ? p.onChange : undefined;
  const range = useCommitListener(commit && ((raw) => commit(settle(Number(raw)))));
  const known = isKnown(p);
  // The thumb clamps to the track; the readout beside it does not, so a value
  // past `max` is still reported as what it is.
  const value = known ? Math.min(Math.max(p.value as number, min), max) : min;
  return (
    // The shared skin with no fill: `InlineRange`'s filled-to-value track is its
    // own, and the property rows' 18% track is the one the kit converges on.
    <input
      ref={range}
      type="range"
      id={p.id}
      className={p.className ? `${shared.range} ${p.className}` : shared.range}
      aria-label={p.name}
      // The readout is the keyboard's way in, and steps as the track would; a
      // tab stop here too would be two stops for one value.
      tabIndex={-1}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={p.mixed}
      onChange={(e) => {
        const v = settle(Number(e.target.value));
        dlog('property-panel', 'slider', { name: p.name, value: v });
        live(v);
      }}
    />
  );
}

function SliderReadout(p: PropertyNumberFieldProps) {
  const { min, max, step, settle } = sliderBounds(p);
  if (!isKnown(p)) return <>{boxedReadout('—')}</>;
  return (
    <EditableReadout
      name={p.name}
      value={p.value}
      min={min}
      max={max}
      step={step}
      settle={settle}
      display={p.display ?? stepDisplay(step)}
      format={p.format}
      unit={p.unit}
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
  /** Clamps onto the track, turning an endless end's stop into ±Infinity. */
  settle: (v: number) => number;
  display: Display;
  format?: (value: number) => ReactNode;
  unit?: ReactNode;
  onCommit: (next: number) => void;
}

/**
 * Readout that swaps to a number input on click, commits on Enter/blur,
 * cancels on Escape, and steps like the track beside it. Clicks are stopped so
 * a wrapping <label> doesn't forward focus to the slider thumb.
 */
function EditableReadout({ name, value, min, max, step, settle, display, format, unit, onCommit }: EditableReadoutProps) {
  // Draft is non-null only while the input is focused; the live value mirrors
  // into the input otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  const text = (n: number) => (format ? String(format(n)) : qty(n, display).text);
  const read = (typed: string) => parseAs(typed, display);
  const displayValue = draft !== null ? draft : text(value);
  // The widest value the range can show, which the stylesheet widens the box to fit.
  const fit = { '--wzl-property-readout-fit': `${Math.max(text(settle(min)).length, text(settle(max)).length)}ch` };
  // Where the value sits on the track: an endless end's ±Infinity at its stop.
  const onTrack = (v: number) => Math.min(max, Math.max(min, v));

  const commit = () => {
    if (draft !== null) {
      const n = read(draft);
      if (!Number.isNaN(n)) onCommit(settle(n));
    }
    setDraft(null);
  };

  return (
    <span className={s.readoutGroup}>
      <input
        type="text"
        role="spinbutton"
        aria-label={name}
        aria-valuenow={onTrack(value)}
        aria-valuetext={format ? text(value) : qty(value, display).spoken}
        aria-valuemin={min}
        aria-valuemax={max}
        inputMode="decimal"
        className={s.readoutInput}
        style={fit as CSSProperties}
        value={displayValue}
        onFocus={(e) => {
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
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          } else {
            const typed = draft === null ? value : read(draft);
            const next = spinKey(e.key, onTrack(Number.isNaN(typed) ? value : typed), { step, min, max });
            if (next === null) return;
            e.preventDefault();
            onCommit(settle(next));
            // A step is committed already; the box shows the value it comes back as.
            setDraft(null);
          }
        }}
      />
      {/* A word for infinity stands alone: `never`, not `never ms`. */}
      {Number.isFinite(value) && unitSuffix(unit, s.readoutUnit)}
    </span>
  );
}
