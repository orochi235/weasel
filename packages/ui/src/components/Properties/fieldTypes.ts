import type { ReactNode } from 'react';
import type { Paint, PaintKind } from '@weasel-js/core';
import type { Display, Endless, UnitTable } from '@weasel-js/quantity';

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
  /** The control takes no input: every element of it is disabled, and keeps
   *  showing its value. */
  disabled?: boolean;
  /** The field shows its value and offers nothing to change it with: it draws
   *  as that value in words (`PropertyReadout`), not as a control. */
  readOnly?: boolean;
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
   * The committed value. A typed field fires it on blur, Enter, or a step,
   * never per keystroke. A slider given `onInput` as well fires it once a drag
   * ends; on its own it fires on every move, and a caller wanting settled
   * values only passes a no-op `onInput`.
   */
  onChange: (next: number) => void;
  /** The live value, fired continuously. Pass it alongside `onChange` when the
   *  write is expensive — cheap state here, the costly work there. */
  onInput?: (next: number) => void;
  /** A typed field's live edit was abandoned, by Escape or by text it cannot
   *  read. A field showing a value has already sent that value back through
   *  the live callback; a mixed one has none to send, so this is all it says. */
  onCancel?: () => void;
  /** A typed field was emptied and left by blur or Enter: the value is to be unset. Without it an emptied
   *  field puts its value back. */
  onClear?: () => void;
  /** A typed field's `+=` or `-=` entry, as an amount rather than a value:
   *  what a mixed field takes, for each value it stands for to move by. */
  onOffset?: (delta: number) => void;
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
   * The committed text: fires once, on blur or Enter, and only if the text
   * changed. `onInput` gets each keystroke.
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
   * `menu` is a button reading the value, as wide as that value and no wider.
   */
  control?: 'select' | 'radio' | 'toggle' | 'menu';
  /** Absent, or not one of `options`, chooses nothing. */
  value: T | undefined;
  options: ReadonlyArray<PropertyOption<T>>;
  onChange: (next: T) => void;
  /**
   * Given, choosing nothing is a value of its own: a `toggle` lets the chosen
   * segment be clicked off, and a select, a menu, and a radio group list an
   * "Unset" entry first; each calls this. Absent, the field always holds one.
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
  value: Paint | null | undefined;
  onChange: (next: Paint | null) => void;
  onInput?: (next: Paint | null) => void;
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
