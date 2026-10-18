import { type ReactNode, useId } from 'react';
import { ControlBody } from './fieldControls';
import { nameOf } from './nameOf';
import type { PropertyControlProps } from './fieldTypes';
import { PropertyRow, type PropertyRowLayout, type PropertyRowVariant } from './PropertyRow';
import { type PropertyMetricProps } from './metrics';
import { SliderCell, SliderRow } from './NumberControls';

export type {
  PropertyBooleanFieldProps,
  PropertyColorFieldProps,
  PropertyControlProps,
  PropertyEnumFieldProps,
  PropertyFieldKind,
  PropertyFontFamilyFieldProps,
  PropertyFontWeightFieldProps,
  PropertyNumberFieldProps,
  PropertyOption,
  PropertyPaintFieldProps,
  PropertyStringFieldProps,
} from './fieldTypes';

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
  /** Take only the width the label and the control need — see `<PropertyRow hug>`. */
  hug?: boolean;
  /** The row is auto — see `<PropertyRow auto>`. */
  auto?: boolean;
  /** Toggles `auto` from the row's label — see `<PropertyRow onAutoChange>`. */
  onAutoChange?: (next: boolean) => void;
  /** What the row reads when it is auto — see `<PropertyRow autoValue>`. */
  autoValue?: ReactNode;
  /** The value differs from a baseline of the caller's — see `<PropertyRow changed>`. */
  changed?: boolean;
  /** Class on the row. `controlClassName` reaches the control. */
  rowClassName?: string;
  controlClassName?: string;
}

/** Props for {@link PropertyField}: one field, and the row around it. */
export type PropertyFieldProps<T extends string = string> = PropertyFieldRowProps &
  DistributiveOmit<PropertyControlProps<T>, 'className' | 'id'>;

/** `Omit` applied to each member of a union, so a discriminated union stays one. */
export type DistributiveOmit<U, K extends PropertyKey> = U extends unknown ? Omit<U, K> : never;

/**
 * A labeled settings row for one field, its control chosen by `kind` (and
 * `control`): `<PropertyField kind="number" control="slider" label="Blur" …>`.
 *
 * The row is a {@link PropertyRow}; the control is the one
 * {@link PropertyControl} draws for the same props.
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
    hug,
    density,
    align,
    auto,
    onAutoChange,
    autoValue,
    changed,
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
    hug,
    density,
    align,
    auto,
    onAutoChange,
    autoValue,
    changed,
    className: rowClassName,
    variant: shape.variant,
    group: shape.group,
    disabled: control.disabled,
    // The font pickers take no id; any other single control is named by the
    // row's `<label>` through this one.
    htmlFor: shape.group || control.kind === 'font-family' || control.kind === 'font-weight'
      ? undefined
      : id,
  };

  if (control.kind === 'number' && control.control === 'slider' && !control.readOnly) {
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
 * a row with others, or a surface that draws its own row. A slider brings its
 * readout beside the track. Several elements come back as siblings rather than
 * wrapped, so the surrounding row lays them out.
 */
export function PropertyControl<T extends string = string>(typed: PropertyControlProps<T>) {
  const props = typed as unknown as PropertyControlProps;
  if (props.kind === 'number' && props.control === 'slider' && !props.readOnly) return <SliderCell {...props} />;
  return <ControlBody {...props} />;
}

/** Whether a field's control is several controls, or one a `<label>` may not wrap: its row is then a group
 *  (`PropertyRow`'s `group`). The one decision, for a surface that draws its own row around a {@link PropertyControl}. */
export function controlIsGroup(control: PropertyControlProps<string>): boolean {
  return rowShape(control).group;
}

/** How a row holds a field's control. */
function rowShape(p: PropertyControlProps<string>): { variant: PropertyRowVariant; group: boolean } {
  // A readout is one `<output>`, which a label may name.
  if (p.readOnly) return { variant: 'default', group: false };
  switch (p.kind) {
    case 'boolean':
      // A switch renders its own <label>, and a segment is a button: neither
      // may sit inside the row's.
      return { variant: 'checkbox', group: p.control === 'switch' || p.control === 'toggle' };
    case 'enum':
      // A <label> hands a click on its text to its first control, which in a
      // group of options means choosing the first one, and for a menu opening it.
      return { variant: 'default', group: p.control === 'radio' || p.control === 'toggle' || p.control === 'menu' };
    case 'color':
      return { variant: 'color', group: false };
    case 'paint':
      return { variant: 'default', group: true };
    default:
      return { variant: 'default', group: false };
  }
}
