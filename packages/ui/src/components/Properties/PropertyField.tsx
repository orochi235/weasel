import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { getAlpha01, toHex8, withAlpha01, type FillStyle, type PaintKind } from '@weasel-js/core';
import { dlog } from '../../dlog';
import { formatCompact, formatNumber, parseNumber, type UnitTable } from '../../format/number';
import { Checkbox } from '../Checkbox';
import { ColorField } from '../ColorField';
import { FontFamilySelect } from '../FontFamilySelect';
import { InlineRange } from '../InlineRange';
import { Input } from '../Input';
import { NumberField, UnitField } from '../NumberField';
import { PaintField } from '../PaintField';
import { PaintInput } from '../PaintInput';
import type { PrefNumberFormat } from '../Prefs/schema';
import { Radio, RadioGroup } from '../RadioGroup';
import { Select } from '../Select';
import { Switch } from '../Switch';
import { ToggleBar } from '../ToggleBar';
import shared from '../range.module.css';
import {
  type PropertyMetricProps,
  PropertyRow,
  type PropertyRowLayout,
  type PropertyRowVariant,
} from './PropertyPanel';
import s from './Properties.module.css';

/**
 * Which controls a field is drawn with.
 *
 *   - `'bare'` (the default): native inputs the property row's own stylesheet
 *     draws — the compact controls of an inspector sidebar or a lab panel.
 *   - `'framed'`: the kit's field components, each bringing its own frame —
 *     for a surface whose row does not style its controls (`SelectionPanel`,
 *     `ToolOptionsBar`), or that needs what only they do, such as reading a
 *     unit typed into a number (`accepts`).
 *
 * The two differ only where the kit still has two widgets for one job; a
 * slider, a switch, a font picker and a paint are the same in both.
 */
export type PropertyFieldChrome = 'bare' | 'framed';

/** One choice of an enum field. */
export interface PropertyOption<T extends string> {
  value: T;
  /** The option's name. A string also names its segment for a screen reader. */
  label: ReactNode;
  /** What a segment shows in place of `label` when the full one would not fit
   *  — a glyph or a letter. `label` stays the accessible name. */
  glyph?: ReactNode;
  /** Shown but not choosable: a value the control reports and cannot author. */
  disabled?: boolean;
}

/** Props every kind of field shares. */
interface FieldBase {
  /** The control's accessible name. A `<PropertyField>` takes it from a string
   *  `label` when this is omitted. */
  name?: string;
  /** The sources the field reads disagree — a multi-selection whose nodes
   *  differ. The control shows no value, in whatever form it has for that. */
  mixed?: boolean;
  /**
   * The sources agree on holding nothing: whatever is in effect comes from a
   * fallback further down. The control shows no chosen value rather than
   * inventing one, since the next edit would write the invention back.
   */
  unset?: boolean;
  chrome?: PropertyFieldChrome;
  /** Class on the control element itself. */
  className?: string;
  /** Id for the control element, for a `<label htmlFor>` outside it. */
  id?: string;
}

/** A boolean field. */
export interface PropertyBooleanFieldProps extends FieldBase {
  kind: 'boolean';
  /** `checkbox` (default), `switch`, or `toggle` — a one-segment pressable bar. */
  control?: 'checkbox' | 'switch' | 'toggle';
  /** Absent reads as off. */
  value: boolean | undefined;
  onChange: (next: boolean) => void;
  /** A `toggle`'s segment content. Defaults to the first letter of `name`. */
  glyph?: ReactNode;
}

/** A number field. */
export interface PropertyNumberFieldProps extends FieldBase {
  kind: 'number';
  /** `input` (default) for a typed number; `slider` for a track with an
   *  editable readout, where the range matters more than the exact value. */
  control?: 'input' | 'slider';
  /** Absent reads as an empty field. */
  value: number | null | undefined;
  /**
   * The committed value. Given `onInput` as well, it fires once a drag ends,
   * or on blur or Enter in a typed field; on its own it fires on every move
   * and keystroke. A `framed` typed field commits only on blur or Enter,
   * whichever callbacks it has.
   */
  onChange: (next: number) => void;
  /** The live value, fired continuously. Pass it alongside `onChange` when the
   *  write is expensive — cheap state here, the costly work there. */
  onInput?: (next: number) => void;
  /** A slider's track runs 0..100 where these are omitted. */
  min?: number;
  max?: number;
  step?: number;
  /**
   * Suffix after the value. A string becomes a dim word unit (`px`); pass JSX
   * like `<sup>°</sup>` for a symbol. Display only — the value stays a number.
   */
  unit?: ReactNode;
  /** Units a person may type into a `framed` field, each mapped to the factor
   *  that turns it into the unit shown: `{ mm: 0.1, cm: 1 }`. */
  accepts?: Readonly<UnitTable>;
  /** A slider readout's display. Defaults to the value at `step`'s precision. */
  format?: (value: number) => ReactNode;
  /** A named display for the value: `compact` reads `2.00M`. `format` wins. */
  notation?: PrefNumberFormat;
  placeholder?: string;
  /** A `framed` unitless field's stepper buttons. Default `true`. */
  steppers?: boolean;
}

/** A text field. */
export interface PropertyStringFieldProps extends FieldBase {
  kind: 'string';
  control?: 'input' | 'textarea';
  /** Absent reads as an empty field. */
  value: string | null | undefined;
  /**
   * The committed text. On its own it fires on every keystroke. Given
   * `onInput` as well, the field drafts: `onInput` gets each keystroke and
   * this fires once, on blur or Enter, and only if the text changed.
   */
  onChange: (next: string) => void;
  onInput?: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
}

/** A choice among fixed options. */
export interface PropertyEnumFieldProps<T extends string = string> extends FieldBase {
  kind: 'enum';
  /**
   * `select` (default) is a dropdown. `radio` and `toggle` show every option
   * at once — a radio group chooses, and a toggle is a row of pressable
   * segments. Drawn `bare`, both are segments.
   */
  control?: 'select' | 'radio' | 'toggle';
  /** Absent, or not one of `options`, chooses nothing. */
  value: T | undefined;
  options: ReadonlyArray<PropertyOption<T>>;
  onChange: (next: T) => void;
  /** Shown while no option is chosen. Defaults to "Choose option…". */
  placeholder?: string;
}

/** A single color. */
export interface PropertyColorFieldProps extends FieldBase {
  kind: 'color';
  /** `#rrggbb`, or `#rrggbbaa` when `alpha` is `true`. */
  value: string | undefined;
  /**
   * The committed color. `bare`: given `onInput` as well, it fires once the
   * picker closes; on its own it fires on every move. `framed`: it fires once
   * per gesture, whichever callbacks it has.
   */
  onChange: (next: string) => void;
  onInput?: (next: string) => void;
  /**
   * Offer an opacity track. `true` keeps the alpha in `value` as `#rrggbbaa`;
   * a number is the 0..1 alpha held apart from it, reported through
   * `onAlphaChange` / `onAlphaInput`.
   */
  alpha?: boolean | number;
  onAlphaChange?: (next: number) => void;
  onAlphaInput?: (next: number) => void;
  /** Draw the opacity track inert, for a consumer that drops alpha. */
  alphaDisabled?: boolean;
}

/** A whole paint: a solid, a gradient, a pattern, or none. */
export interface PropertyPaintFieldProps extends FieldBase {
  kind: 'paint';
  /** `swatch` (default) opens the editor in a popover, for a narrow slot;
   *  `inline` draws the kind bar and its editor in place. */
  control?: 'swatch' | 'inline';
  /** `null` is an explicit "no paint"; `undefined` is nothing to show. */
  value: FillStyle | null | undefined;
  onChange: (next: FillStyle | null) => void;
  onInput?: (next: FillStyle | null) => void;
  /** Offer "None". Default `true`. */
  allowNone?: boolean;
  /** Restrict the kinds offered. Default: every registered kind. */
  kinds?: readonly PaintKind[];
}

/** A font family, picked from the live font registry. */
export interface PropertyFontFamilyFieldProps extends FieldBase {
  kind: 'font-family';
  value: string | undefined;
  onChange: (next: string) => void;
  /** The weight and slant the family is drawn at, so the picker names the
   *  variant that will actually paint. */
  weight?: number;
  fontStyle?: 'normal' | 'italic';
}

/**
 * One field for {@link PropertyControl} and {@link PropertyField}, keyed by
 * `kind`.
 */
export type PropertyControlProps<T extends string = string> =
  | PropertyBooleanFieldProps
  | PropertyNumberFieldProps
  | PropertyStringFieldProps
  | PropertyEnumFieldProps<T>
  | PropertyColorFieldProps
  | PropertyPaintFieldProps
  | PropertyFontFamilyFieldProps;

/** The kinds a {@link PropertyControl} draws. */
export type PropertyFieldKind = PropertyControlProps['kind'];

/** Row props {@link PropertyField} adds to the field it draws. */
export interface PropertyFieldRowProps extends PropertyMetricProps {
  label: ReactNode;
  /**
   * Text beside the label. On a slider it replaces the editable readout —
   * use it when the row is not showing a number a caller could type back,
   * such as an auto row's `auto`.
   */
  readout?: ReactNode;
  description?: string;
  layout?: PropertyRowLayout;
  /** Take the full width of the enclosing grid — see `<PropertyRow span>`. */
  span?: boolean;
  /** The row is auto — see `<PropertyRow auto>`. */
  auto?: boolean;
  /** Toggles `auto` from the row's label — see `<PropertyRow onAutoChange>`. */
  onAutoChange?: (next: boolean) => void;
  /** Class on the row. `controlClassName` reaches the control. */
  rowClassName?: string;
  controlClassName?: string;
}

/** Props for {@link PropertyField}: one field, and the row around it. */
export type PropertyFieldProps<T extends string = string> = PropertyFieldRowProps &
  DistributiveOmit<PropertyControlProps<T>, 'className' | 'id'>;

type DistributiveOmit<U, K extends PropertyKey> = U extends unknown ? Omit<U, K> : never;

/**
 * A labeled settings row for one field, its control chosen by `kind` (and
 * `control`): `<PropertyField kind="number" control="slider" label="Blur" …>`.
 *
 * The row is a {@link PropertyRow}; the control is the one
 * {@link PropertyControl} draws for the same props. Every schema-driven
 * settings surface in the kit — `ControlPanel`, `PrefsForm`, `SelectionPanel`
 * — draws its built-in kinds through that one mapping, so a kind's control
 * is decided once.
 *
 * Callbacks follow the field's shape: a discrete control (a box, a choice)
 * reports each pick; a continuous or typed one reports every change through
 * `onChange` alone, or splits them into live `onInput` and settled
 * `onChange` when given both. `mixed` and `unset` show a field whose sources
 * disagree, or agree on holding nothing.
 */
export function PropertyField<T extends string = string>(props: PropertyFieldProps<T>) {
  const {
    label,
    readout,
    description,
    layout,
    span,
    density,
    align,
    auto,
    onAutoChange,
    rowClassName,
    controlClassName,
    ...field
  } = props;
  const id = useId();
  // Internally a field's option type is erased to `string`: nothing below
  // reads it, and the caller's `onChange` still receives its own `T`.
  const control = {
    ...field,
    name: field.name ?? nameOf(label),
    className: controlClassName,
    id,
  } as unknown as PropertyControlProps;
  const framed = control.chrome === 'framed';
  const shape = rowShape(control);

  const row = {
    label,
    description,
    layout,
    span,
    density,
    align,
    auto,
    onAutoChange,
    className: rowClassName,
    chrome: control.chrome,
    variant: shape.variant,
    group: shape.group,
    // A framed field brings its own label wiring, and the font picker takes no
    // id; any other bare one is named by the row's `<label>` through this one.
    htmlFor: shape.group || framed || control.kind === 'font-family' ? undefined : id,
  };

  if (control.kind === 'number' && control.control === 'slider') {
    return (
      <PropertyRow {...row} readout={boxedReadout(readout) ?? <SliderReadout {...control} />}>
        <SliderTrack {...control} />
      </PropertyRow>
    );
  }
  return (
    <PropertyRow {...row} readout={readout}>
      <ControlBody {...control} />
    </PropertyRow>
  );
}

/**
 * The control for one field, with no row around it — for a cell that shares
 * a row with others, or a surface that draws its own row. Keyed by `kind`
 * (and `control`), the same mapping {@link PropertyField} draws.
 *
 * A slider brings its readout beside the track. Several elements come back
 * as siblings rather than wrapped, so the surrounding row lays them out.
 */
export function PropertyControl<T extends string = string>(typed: PropertyControlProps<T>) {
  const props = typed as unknown as PropertyControlProps;
  if (props.kind === 'number' && props.control === 'slider') {
    return (
      <>
        <SliderTrack {...props} />
        <span className={s.cellReadout}>
          <SliderReadout {...props} />
        </span>
      </>
    );
  }
  return <ControlBody {...props} />;
}

/** How a row holds a field's control. */
function rowShape(p: PropertyControlProps<string>): { variant: PropertyRowVariant; group: boolean } {
  switch (p.kind) {
    case 'boolean':
      // A switch renders its own <label>, and a segment is a button: neither
      // may sit inside the row's.
      return { variant: 'checkbox', group: p.control === 'switch' || p.control === 'toggle' };
    case 'enum':
      // A <label> hands a click on its text to its first control, which in a
      // group of options means choosing the first one.
      return { variant: 'default', group: p.control === 'radio' || p.control === 'toggle' };
    case 'color':
      return { variant: 'color', group: false };
    case 'paint':
      return { variant: 'default', group: true };
    default:
      return { variant: 'default', group: false };
  }
}

function ControlBody(props: PropertyControlProps) {
  switch (props.kind) {
    case 'boolean':
      return <BooleanControl {...props} />;
    case 'number':
      return <NumberInput {...props} />;
    case 'string':
      return <StringControl {...props} />;
    case 'enum':
      return <EnumControl {...props} />;
    case 'color':
      return <ColorControl {...props} />;
    case 'paint':
      return <PaintControl {...props} />;
    case 'font-family':
      return (
        <FontFamilySelect
          className={props.className}
          value={props.mixed ? undefined : props.value}
          mixed={props.mixed}
          onChange={props.onChange}
          weight={props.weight}
          fontStyle={props.fontStyle}
          aria-label={props.name}
        />
      );
    default: {
      // Unreachable while every kind has an arm; a new kind without one is a
      // compile error here rather than an empty cell.
      const _exhaustive: never = props;
      throw new Error(`PropertyControl: no control for kind "${(_exhaustive as { kind: string }).kind}"`);
    }
  }
}

// ── Kinds ────────────────────────────────────────────────────────────────

/** A cue for a state the control itself cannot draw: a switch has no
 *  indeterminate form, and nothing has an "unset" one. */
function Dimmed({ mixed, unset, children }: { mixed?: boolean; unset?: boolean; children: ReactNode }) {
  if (!mixed && !unset) return <>{children}</>;
  return (
    <span className={s.dimmed} title={mixed ? 'Mixed' : 'Not set'}>
      {children}
    </span>
  );
}

function BooleanControl(p: PropertyBooleanFieldProps) {
  const on = !p.mixed && p.value === true;
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = p.mixed === true;
  });
  if (p.control === 'toggle') {
    // Unselected already is how a toggle button says "not set", and dimming it
    // would read as disabled; mixed has a real ARIA form on one.
    const key = 'on';
    return (
      <ToggleBar<string>
        mode="multiple"
        size="sm"
        variant="flat"
        className={p.className}
        ariaLabel={p.name}
        items={[{ value: key, label: p.glyph ?? p.name?.slice(0, 1), ariaLabel: p.name }]}
        value={on ? [key] : []}
        mixedValues={p.mixed ? [key] : []}
        onChange={(next) => p.onChange(next.includes(key))}
      />
    );
  }
  if (p.control === 'switch') {
    return (
      <Dimmed mixed={p.mixed} unset={p.unset}>
        <Switch className={p.className} isSelected={on} onChange={p.onChange} aria-label={p.name} />
      </Dimmed>
    );
  }
  const control =
    p.chrome === 'framed' ? (
      <Checkbox
        className={p.className}
        isSelected={on}
        isIndeterminate={p.mixed}
        onChange={p.onChange}
        aria-label={p.name}
      />
    ) : (
      <input
        ref={box}
        id={p.id}
        type="checkbox"
        className={p.className}
        aria-label={p.name}
        checked={on}
        onChange={(e) => p.onChange(e.target.checked)}
      />
    );
  return <Dimmed unset={p.unset}>{control}</Dimmed>;
}

/**
 * A ref for an input whose commit half has to come off a real listener.
 *
 * A native `range`, `color` or `number` input fires `input` through the
 * interaction and `change` once at the end, but React's synthetic `onChange`
 * sees only the first: its value tracker drops the unchanged second. So a
 * control offering the live/committed split reads the live half from React
 * and the committed half from here. `commit` is `undefined` when a control has
 * one callback, which then fires continuously.
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

function NumberInput(p: PropertyNumberFieldProps) {
  const live = p.onInput ?? p.onChange;
  const field = useCommitListener(
    p.onInput &&
      ((raw) => {
        if (raw === '') return;
        const n = Number(raw);
        if (Number.isFinite(n)) p.onChange(n);
      }),
  );
  const known = !p.mixed && typeof p.value === 'number' && Number.isFinite(p.value);
  const placeholder = p.mixed ? 'Mixed' : p.placeholder;

  if (p.chrome === 'framed') {
    const commit = (n: number) => {
      // A cleared field reads as NaN, which is no value to write.
      if (!Number.isNaN(n)) p.onChange(n);
    };
    const value = known ? (p.value as number) : NaN;
    const input = p.accepts ? (
      <UnitField
        className={p.className}
        value={value}
        placeholder={placeholder}
        minValue={p.min}
        maxValue={p.max}
        step={p.step}
        accepts={p.accepts}
        aria-label={p.name}
        onChange={commit}
      />
    ) : (
      <NumberField
        className={p.className}
        value={value}
        placeholder={placeholder}
        minValue={p.min}
        maxValue={p.max}
        step={p.step}
        hideSteppers={p.steppers === false}
        aria-label={p.name}
        onChange={commit}
      />
    );
    if (p.unit == null) return input;
    return (
      <>
        {input}
        <span className={s.unitSuffix} aria-hidden="true">
          {p.unit}
        </span>
      </>
    );
  }

  const input = (
    <input
      ref={field}
      id={p.id}
      type="number"
      className={p.className}
      aria-label={p.name}
      value={known ? (p.value as number) : ''}
      min={p.min}
      max={p.max}
      step={p.step}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') return;
        const n = Number(raw);
        if (Number.isFinite(n)) live(n);
      }}
    />
  );
  if (p.unit == null) return input;
  return (
    <span className={s.fieldUnitGroup}>
      {input}
      {unitSuffix(p.unit, s.readoutUnit)}
    </span>
  );
}

/** A slider's bounds, with the 0..100 fallback for an unbounded track. */
function sliderBounds(p: PropertyNumberFieldProps): { min: number; max: number; step: number } {
  return { min: p.min ?? 0, max: p.max ?? 100, step: p.step ?? 1 };
}

function SliderTrack(p: PropertyNumberFieldProps) {
  const { min, max, step } = sliderBounds(p);
  const live = p.onInput ?? p.onChange;
  const commit = p.onInput ? p.onChange : undefined;
  const range = useCommitListener(commit && ((raw) => commit(Number(raw))));
  const known = !p.mixed && typeof p.value === 'number' && Number.isFinite(p.value);
  // The thumb clamps to the track; the readout beside it does not, so a value
  // past `max` is still reported as what it is.
  const value = known ? Math.min(Math.max(p.value as number, min), max) : min;
  const onChange = (raw: string) => {
    const v = Number(raw);
    dlog('property-panel', 'slider', { name: p.name, value: v });
    live(v);
  };
  if (p.chrome === 'framed') {
    return (
      <InlineRange
        ref={range}
        className={p.className}
        aria-label={p.name}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={p.mixed}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      ref={range}
      id={p.id}
      type="range"
      aria-label={p.name}
      className={p.className ? `${shared.range} ${p.className}` : shared.range}
      // The readout is the keyboard's way in; a tab stop on the track too
      // would be two stops for one value.
      tabIndex={-1}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={p.mixed}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SliderReadout(p: PropertyNumberFieldProps) {
  const { min, max, step } = sliderBounds(p);
  const known = !p.mixed && typeof p.value === 'number' && Number.isFinite(p.value);
  if (!known) return <>{boxedReadout('—')}</>;
  // Precision tracks `step`: integer steps show none, 0.1 one, 0.05 two.
  const decimals = step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step))));
  const format =
    p.format ??
    (p.notation === 'compact'
      ? (n: number) => formatCompact(n, decimals)
      : (n: number) =>
          formatNumber(n, {
            useGrouping: false,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }));
  return (
    <EditableReadout
      name={p.name}
      value={p.value as number}
      min={min}
      max={max}
      format={format}
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
  format: (value: number) => ReactNode;
  unit?: ReactNode;
  onCommit: (next: number) => void;
}

/**
 * Readout that swaps to a number input on click, commits on Enter/blur,
 * cancels on Escape. Clicks are stopped so a wrapping <label> doesn't forward
 * focus to the slider thumb.
 */
function EditableReadout({ name, value, min, max, format, unit, onCommit }: EditableReadoutProps) {
  // Draft is non-null only while the input is focused; the live value mirrors
  // into the input otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  const text = (n: number) => {
    const formatted = format(n);
    return typeof formatted === 'string' ? formatted : String(formatted);
  };
  const displayValue = draft !== null ? draft : text(value);
  // The widest value the range can show, which the stylesheet widens the box to fit.
  const fit = { '--wzl-property-readout-fit': `${Math.max(text(min).length, text(max).length)}ch` };

  const commit = () => {
    if (draft !== null) {
      const n = parseNumber(draft);
      if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
    }
    setDraft(null);
  };

  return (
    <span className={s.readoutGroup}>
      <input
        type="text"
        aria-label={name}
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
          }
        }}
      />
      {unitSuffix(unit, s.readoutUnit)}
    </span>
  );
}

/**
 * The text a field shows and how an edit to it lands. With `onInput` the
 * field drafts: the draft shows while it differs from `value`, and settles
 * through `onChange` on blur or Enter. Without it, every keystroke is the
 * value.
 */
function useTextEdit(p: PropertyStringFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = p.mixed ? '' : (p.value ?? '');
  const drafting = p.onInput !== undefined;
  return {
    shown: draft ?? value,
    type: (next: string) => {
      if (!drafting) {
        p.onChange(next);
        return;
      }
      setDraft(next);
      p.onInput?.(next);
    },
    settle: () => {
      if (draft !== null && draft !== value) p.onChange(draft);
      setDraft(null);
    },
  };
}

function StringControl(p: PropertyStringFieldProps) {
  const edit = useTextEdit(p);
  const placeholder = p.mixed ? 'Mixed' : p.placeholder;
  const onKeyDown = (e: { key: string; currentTarget: HTMLElement }) => {
    if (e.key === 'Enter' && p.control !== 'textarea') e.currentTarget.blur();
  };
  if (p.control === 'textarea') {
    return (
      <textarea
        id={p.id}
        className={[p.chrome === 'framed' && s.textarea, p.className].filter(Boolean).join(' ') || undefined}
        aria-label={p.name}
        value={edit.shown}
        placeholder={placeholder}
        maxLength={p.maxLength}
        rows={3}
        onChange={(e) => edit.type(e.target.value)}
        onBlur={edit.settle}
      />
    );
  }
  if (p.chrome === 'framed') {
    return (
      <Input
        className={p.className}
        value={edit.shown}
        placeholder={placeholder}
        maxLength={p.maxLength}
        aria-label={p.name}
        onChange={edit.type}
        onBlur={edit.settle}
        onKeyDown={onKeyDown}
      />
    );
  }
  return (
    <input
      id={p.id}
      type="text"
      className={p.className}
      aria-label={p.name}
      value={edit.shown}
      placeholder={placeholder}
      maxLength={p.maxLength}
      onChange={(e) => edit.type(e.target.value)}
      onBlur={edit.settle}
      onKeyDown={onKeyDown}
    />
  );
}

// A row's <label> text also holds the help button's ⓘ and any readout, so a
// control takes its name from the string label, not from the <label> that
// `for` points at it.
function nameOf(label: ReactNode): string | undefined {
  return typeof label === 'string' ? label : undefined;
}

function EnumControl(p: PropertyEnumFieldProps) {
  const chosen = !p.mixed && p.options.some((opt) => opt.value === p.value);
  const current = chosen ? (p.value as string) : null;

  if (p.control === 'radio' || p.control === 'toggle') {
    if (p.chrome === 'framed') {
      if (p.control === 'radio') {
        return (
          <RadioGroup
            className={p.className}
            value={current}
            onChange={p.onChange}
            aria-label={p.name}
          >
            {p.options.map((o) => (
              <Radio key={o.value} value={o.value} isDisabled={o.disabled}>
                {o.label}
              </Radio>
            ))}
          </RadioGroup>
        );
      }
      return (
        <ToggleBar<string>
          size="sm"
          variant="flat"
          className={p.className}
          ariaLabel={p.name}
          items={p.options.map((o) => ({
            value: o.value,
            label: o.glyph ?? o.label,
            ariaLabel: nameOf(o.label),
            disabled: o.disabled,
          }))}
          value={current}
          onChange={(next) => {
            if (next !== null) p.onChange(next);
          }}
        />
      );
    }
    // Bare, both are segments; a radio's say which one is chosen, a toggle's
    // which are pressed.
    const radio = p.control === 'radio';
    return (
      <div
        className={p.className ? `${s.toggle} ${p.className}` : s.toggle}
        role={radio ? 'radiogroup' : 'group'}
        aria-label={p.name}
      >
        {p.options.map((opt) => {
          const selected = opt.value === current;
          return (
            <button
              key={opt.value}
              type="button"
              role={radio ? 'radio' : undefined}
              aria-checked={radio ? selected : undefined}
              aria-pressed={radio ? undefined : selected}
              aria-label={nameOf(opt.label)}
              disabled={opt.disabled}
              className={selected ? `${s.toggleButton} ${s.toggleButtonSelected}` : s.toggleButton}
              onClick={() => p.onChange(opt.value)}
            >
              {opt.glyph ?? opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  const bare = p.chrome !== 'framed';
  return (
    <Select<string>
      className={bare ? (p.className ? `${s.select} ${p.className}` : s.select) : p.className}
      variant={bare ? 'bare' : undefined}
      triggerId={bare ? p.id : undefined}
      aria-label={p.name}
      placeholder={p.mixed ? 'Mixed' : (p.placeholder ?? (p.unset ? '—' : 'Choose option…'))}
      selectedKey={current}
      options={p.options.map((o) => ({ value: o.value, label: o.label, isDisabled: o.disabled }))}
      onSelectionChange={(v) => {
        dlog('property-panel', 'select', { name: p.name, value: v });
        p.onChange(v);
      }}
    />
  );
}

/** A hex color as the `#rrggbb` a color input can hold and the 0..1 alpha
 *  beside it. Anything unreadable is opaque black, which is what the input
 *  would show for it anyway. */
function splitAlpha(value: string | undefined): { rgb: string; alpha: number } {
  const eight = toHex8(value?.trim() ?? '');
  if (!/^#[0-9a-f]{8}$/i.test(eight)) return { rgb: '#000000', alpha: 1 };
  return { rgb: eight.slice(0, 7).toLowerCase(), alpha: getAlpha01(eight) };
}

function ColorControl(p: PropertyColorFieldProps) {
  const inValue = p.alpha === true;
  const split = splitAlpha(p.value);
  const alpha = typeof p.alpha === 'number' ? p.alpha : split.alpha;

  // Where the alpha lives: in the color's own hex, or in a channel of its own.
  const color = (rgb: string, a: number) => (inValue ? withAlpha01(rgb, a) : rgb);
  const colorOut = (write: (hex: string) => void) => (rgb: string) => write(color(rgb, alpha));
  const alphaOut = (write: ((hex: string) => void) | undefined, own: ((a: number) => void) | undefined) =>
    inValue ? write && ((a: number) => write(withAlpha01(split.rgb, a))) : own;
  const alphaChange = alphaOut(p.onChange, p.onAlphaChange);
  const alphaInput = alphaOut(p.onInput, p.onAlphaInput);

  if (p.chrome === 'framed') {
    const withAlpha = p.alpha !== undefined && p.alpha !== false;
    // ColorField holds alpha in the hex; a separate channel goes in and comes
    // back out of it.
    const out = (write: ((hex: string) => void) | undefined, own: ((a: number) => void) | undefined) =>
      write &&
      ((hex: string) => {
        if (typeof p.alpha !== 'number') {
          write(hex);
          return;
        }
        const next = splitAlpha(hex);
        if (next.rgb !== split.rgb || !own) write(next.rgb);
        if (next.alpha !== alpha) own?.(next.alpha);
      });
    return (
      <ColorField
        className={p.className}
        value={p.mixed ? undefined : withAlpha ? withAlpha01(split.rgb, alpha) : (p.value ?? '#000000')}
        mixed={p.mixed}
        alpha={withAlpha}
        onChange={out(p.onChange, p.onAlphaChange) ?? p.onChange}
        onInput={out(p.onInput, p.onAlphaInput)}
        aria-label={p.name}
      />
    );
  }

  return (
    <BareColor
      p={p}
      rgb={split.rgb}
      alpha={p.alpha === undefined || p.alpha === false ? undefined : alpha}
      onColorChange={colorOut(p.onChange)}
      onColorInput={p.onInput && colorOut(p.onInput)}
      onAlphaChange={alphaChange}
      onAlphaInput={alphaInput}
    />
  );
}

function BareColor({
  p,
  rgb,
  alpha,
  onColorChange,
  onColorInput,
  onAlphaChange,
  onAlphaInput,
}: {
  p: PropertyColorFieldProps;
  rgb: string;
  alpha: number | undefined;
  onColorChange: (rgb: string) => void;
  onColorInput?: (rgb: string) => void;
  onAlphaChange?: (a: number) => void;
  onAlphaInput?: (a: number) => void;
}) {
  const liveColor = onColorInput ?? onColorChange;
  const color = useCommitListener(onColorInput && ((raw) => onColorChange(raw)));
  const liveAlpha = onAlphaInput ?? onAlphaChange;
  const alphaRange = useCommitListener(
    onAlphaInput && onAlphaChange && ((raw) => onAlphaChange(Number(raw))),
  );
  return (
    <>
      <input
        ref={color}
        id={p.id}
        type="color"
        className={p.className}
        aria-label={p.name}
        value={rgb}
        data-mixed={p.mixed || undefined}
        onChange={(e) => liveColor(e.target.value)}
      />
      {alpha !== undefined && (
        <input
          ref={alphaRange}
          type="range"
          aria-label={p.name ? `${p.name} opacity` : undefined}
          className={`${shared.range} ${shared.alpha} ${s.alpha}`}
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          disabled={p.alphaDisabled}
          onChange={(e) => liveAlpha?.(Number(e.target.value))}
        />
      )}
    </>
  );
}

function PaintControl(p: PropertyPaintFieldProps) {
  const Editor = p.control === 'inline' ? PaintInput : PaintField;
  return (
    <Editor
      className={p.className}
      value={p.value}
      mixed={p.mixed}
      unset={p.unset}
      kinds={p.kinds}
      allowNone={p.allowNone}
      onChange={p.onChange}
      onInput={p.onInput}
      aria-label={p.name}
    />
  );
}
