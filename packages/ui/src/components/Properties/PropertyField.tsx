import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { getAlpha01, toHex8, withAlpha01, type FillStyle, type PaintKind } from '@weasel-js/core';
import { dlog } from '../../dlog';
import type { Display, UnitTable } from '@weasel-js/quantity';
import { ColorField } from '../ColorField';
import { FontFamilySelect } from '../FontFamilySelect';
import { FontWeightSelect } from '../FontWeightSelect';
import { Input } from '../Input';
import { PaintField } from '../PaintField';
import { PaintInput } from '../PaintInput';
import { Radio, RadioGroup } from '../RadioGroup';
import { Select } from '../Select';
import { Switch } from '../Switch';
import { FitLabel, labelForms } from '../FitLabel/FitLabel';
import { ToggleBar } from '../ToggleBar';
import sharedCheckbox from '../checkbox.module.css';
import {
  type PropertyMetricProps,
  PropertyRow,
  type PropertyRowLayout,
  type PropertyRowVariant,
} from './PropertyPanel';
import s from './Properties.module.css';
import type { Endless } from '../../endless';
import { ignore, NumberInput, SliderCell, SliderRow } from './NumberControls';

/** One choice of an enum field. */
export interface PropertyOption<T extends string> {
  value: T;
  /** The option's name. A string also names its segment for a screen reader. */
  label: ReactNode;
  /** Shorter forms of `label`, longest first. A segment too narrow for
   *  `label` shows the longest that fits; `label` stays the accessible name.
   *  A select has room for the label and leaves these out. */
  short?: readonly string[];
  /** A glyph a segment draws in place of any text form, with `label` as its
   *  tooltip. A select draws it beside the label. */
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
  /** Shorter forms of `name`, longest first, for a `toggle` segment too
   *  narrow for the whole name. */
  short?: readonly string[];
  /** A glyph a `toggle` segment draws in place of any text form. */
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
   * or on blur, Enter or a step in a typed field; on its own it fires on every
   * move, keystroke and step. A caller wanting settled values only passes a
   * no-op `onInput`.
   */
  onChange: (next: number) => void;
  /** The live value, fired continuously. Pass it alongside `onChange` when the
   *  write is expensive — cheap state here, the costly work there. */
  onInput?: (next: number) => void;
  /** A slider's track runs 0..100 where these are omitted. */
  min?: number;
  max?: number;
  step?: number;
  /** Which end stop of a slider stands for infinity: dragged there, it
   *  reports `Infinity` (`-Infinity` at `min`), and a value of ±Infinity sits
   *  there. The readout shows `display`'s word for it — `endless(unit('ms'),
   *  'never')` reads `never` — else `∞`, and drops `unit` beside it. */
  endless?: Endless;
  /**
   * Suffix after the value. A string becomes a dim word unit (`px`); pass JSX
   * like `<sup>°</sup>` for a symbol. Display only — the value stays a number.
   */
  unit?: ReactNode;
  /** Units a person may type into a typed field, each mapped to the factor
   *  that turns it into the unit shown: `{ mm: 0.1, cm: 1 }`. */
  accepts?: Readonly<UnitTable>;
  /** How the value shows, is spoken, and reads back when typed —
   *  `compact()` reads `2.00M`. A slider readout defaults to the value at
   *  `step`'s precision. */
  display?: Display;
  /** A slider readout's text, for what no display expresses — a derived
   *  value. Wins over `display`, and is spoken as shown. */
  format?: (value: number) => ReactNode;
  placeholder?: string;
  /** A typed field's up and down buttons. Default `false`: a dense panel
   *  drives its numbers by typing, the arrow keys and the wheel. */
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
   * at once — a radio group lists them, and a toggle is a row of segments.
   */
  control?: 'select' | 'radio' | 'toggle';
  /** Absent, or not one of `options`, chooses nothing. */
  value: T | undefined;
  options: ReadonlyArray<PropertyOption<T>>;
  onChange: (next: T) => void;
  /**
   * Given, choosing nothing is a value of its own: a `toggle` lets the chosen
   * segment be clicked off, and calls this. Absent, a toggle always holds one.
   */
  onClear?: () => void;
  /** Shown while no option is chosen. Defaults to "Choose option…". */
  placeholder?: string;
}

/** A single color. */
export interface PropertyColorFieldProps extends FieldBase {
  kind: 'color';
  /** `#rrggbb`, or `#rrggbbaa` when `alpha` is `true`. */
  value: string | undefined;
  /**
   * The committed color. Given `onInput` as well, it fires once per gesture —
   * the picker closing, or the opacity track let go; on its own it fires on
   * every move. A caller wanting settled values only passes a no-op `onInput`.
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

/** A font weight, picked from the weights its family has registered. */
export interface PropertyFontWeightFieldProps extends FieldBase {
  kind: 'font-weight';
  value: number | undefined;
  onChange: (next: number) => void;
  /** The family whose weights to offer. */
  family?: string;
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
  | PropertyFontFamilyFieldProps
  | PropertyFontWeightFieldProps;

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
  /** What the row reads when it is auto — see `<PropertyRow autoValue>`. */
  autoValue?: ReactNode;
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
    autoValue,
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
    autoValue,
    className: rowClassName,
    variant: shape.variant,
    group: shape.group,
    // The font pickers take no id; any other single control is named by the
    // row's `<label>` through this one.
    htmlFor: shape.group || control.kind === 'font-family' || control.kind === 'font-weight'
      ? undefined
      : id,
  };

  if (control.kind === 'number' && control.control === 'slider') {
    return <SliderRow row={row} readout={readout} control={control} />;
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
  if (props.kind === 'number' && props.control === 'slider') return <SliderCell {...props} />;
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
    case 'font-weight':
      return (
        <FontWeightSelect
          className={props.className}
          value={props.mixed ? undefined : props.value}
          mixed={props.mixed}
          family={props.family}
          onChange={props.onChange}
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
        items={[{ value: key, label: p.glyph ?? <FitLabel forms={labelForms(p.name, p.short)} />, ariaLabel: p.name }]}
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
  // A native box rather than the kit's `Checkbox`: that one renders a `<label>`
  // of its own, which may not sit inside the row's, and without the row's the
  // label text would no longer toggle it.
  return (
    <Dimmed unset={p.unset}>
      <input
        ref={box}
        id={p.id}
        type="checkbox"
        className={p.className ? `${sharedCheckbox.checkbox} ${p.className}` : sharedCheckbox.checkbox}
        aria-label={p.name}
        checked={on}
        onChange={(e) => p.onChange(e.target.checked)}
      />
    </Dimmed>
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
  if (p.control === 'textarea') {
    return (
      <textarea
        id={p.id}
        className={p.className ? `${s.textarea} ${p.className}` : s.textarea}
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
  return (
    <Input
      id={p.id}
      className={p.className ? `${s.textField} ${p.className}` : s.textField}
      value={edit.shown}
      placeholder={placeholder}
      maxLength={p.maxLength}
      aria-label={p.name}
      onChange={edit.type}
      onBlur={edit.settle}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLElement).blur();
      }}
    />
  );
}

// A row's <label> text also holds the help button's ⓘ and any readout, so a
// control takes its name from the string label, not from the <label> that
// `for` points at it.
function nameOf(label: ReactNode): string | undefined {
  return typeof label === 'string' ? label : undefined;
}

/** A segment drawing a glyph hides its label, so the label comes back as its tooltip. */
function glyphTip(o: PropertyOption<string>): ReactNode {
  return o.glyph === undefined || o.glyph === null ? undefined : o.label;
}

function EnumControl(p: PropertyEnumFieldProps) {
  const chosen = !p.mixed && p.options.some((opt) => opt.value === p.value);
  const current = chosen ? (p.value as string) : null;

  if (p.control === 'radio') {
    return (
      <RadioGroup className={p.className} value={current} onChange={p.onChange} aria-label={p.name}>
        {p.options.map((o) => (
          <Radio key={o.value} value={o.value} isDisabled={o.disabled}>
            {o.label}
          </Radio>
        ))}
      </RadioGroup>
    );
  }
  if (p.control === 'toggle' && p.onClear) {
    // `multiple` for what `single` cannot give: a mixed state on each segment,
    // and arrow keys that move focus without choosing. At most one stays lit —
    // the segment just added wins, and adding none means the lit one was
    // clicked off.
    const { onClear } = p;
    const lit = current === null ? [] : [current];
    return (
      <ToggleBar<string>
        mode="multiple"
        size="sm"
        variant="flat"
        className={p.className ? `${s.toggleBar} ${p.className}` : s.toggleBar}
        ariaLabel={p.name}
        items={p.options.map((o) => ({
          value: o.value,
          label: o.glyph ?? <FitLabel forms={labelForms(o.label, o.short)} />,
          ariaLabel: nameOf(o.label),
          tooltip: glyphTip(o),
          disabled: o.disabled,
        }))}
        value={lit}
        mixedValues={p.mixed ? p.options.map((o) => o.value) : []}
        onChange={(next) => {
          const added = next.find((v) => !lit.includes(v));
          if (added !== undefined) p.onChange(added);
          else onClear();
        }}
      />
    );
  }
  if (p.control === 'toggle') {
    return (
      <ToggleBar<string>
        size="sm"
        variant="flat"
        className={p.className ? `${s.toggleBar} ${p.className}` : s.toggleBar}
        ariaLabel={p.name}
        items={p.options.map((o) => ({
          value: o.value,
          label: o.glyph ?? <FitLabel forms={labelForms(o.label, o.short)} />,
          ariaLabel: nameOf(o.label),
          tooltip: glyphTip(o),
          disabled: o.disabled,
        }))}
        value={current}
        onChange={(next) => {
          if (next !== null) p.onChange(next);
        }}
      />
    );
  }
  return (
    <Select<string>
      className={p.className ? `${s.select} ${p.className}` : s.select}
      triggerId={p.id}
      aria-label={p.name}
      placeholder={p.mixed ? 'Mixed' : (p.placeholder ?? (p.unset ? '—' : 'Choose option…'))}
      selectedKey={current}
      options={p.options.map((o) => ({
        value: o.value,
        label: o.label,
        icon: o.glyph,
        isDisabled: o.disabled,
      }))}
      onSelectionChange={(v) => {
        dlog('property-panel', 'select', { name: p.name, value: v });
        p.onChange(v);
      }}
    />
  );
}

/** A hex color as the `#rrggbb` it paints and the 0..1 alpha beside it.
 *  Anything unreadable is opaque black, which is what a swatch would show for
 *  it anyway. */
function splitAlpha(value: string | undefined): { rgb: string; alpha: number } {
  const eight = toHex8(value?.trim() ?? '');
  if (!/^#[0-9a-f]{8}$/i.test(eight)) return { rgb: '#000000', alpha: 1 };
  return { rgb: eight.slice(0, 7).toLowerCase(), alpha: getAlpha01(eight) };
}

function ColorControl(p: PropertyColorFieldProps) {
  const withAlpha = p.alpha !== undefined && p.alpha !== false;
  const apart = typeof p.alpha === 'number';
  const split = splitAlpha(p.value);
  const alpha = apart ? (p.alpha as number) : split.alpha;

  // `ColorField` holds alpha in the hex. One kept in a channel of its own goes
  // in with the color and comes back out of it, each half to its own callback.
  const route =
    (write: (hex: string) => void, own: ((a: number) => void) | undefined) => (hex: string) => {
      if (!apart) {
        write(hex);
        return;
      }
      const next = splitAlpha(hex);
      if (next.rgb !== split.rgb || !own) write(next.rgb);
      // Read back at the track's percent, which is all a hex byte can hold of it.
      const a = Math.round(next.alpha * 100) / 100;
      if (a !== Math.round(alpha * 100) / 100) own?.(a);
    };
  // As a number does: one callback is the live one, and the commit at the end
  // of a gesture would only repeat its last call.
  const drafting = p.onInput !== undefined || p.onAlphaInput !== undefined;
  const live = route(p.onInput ?? p.onChange, p.onAlphaInput ?? p.onAlphaChange);
  const settled = drafting ? route(p.onChange, p.onAlphaChange) : ignore;
  return (
    <ColorField
      id={p.id}
      className={p.className ? `${s.colorField} ${p.className}` : s.colorField}
      value={p.mixed ? undefined : withAlpha ? withAlpha01(split.rgb, alpha) : (p.value ?? '#000000')}
      mixed={p.mixed}
      alpha={withAlpha}
      alphaDisabled={p.alphaDisabled}
      onInput={live}
      onChange={settled}
      aria-label={p.name}
    />
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
