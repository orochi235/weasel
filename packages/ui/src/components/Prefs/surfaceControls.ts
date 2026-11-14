import type { ControlForm } from '../ActionButton/controlForm';
import type { PropertyControlProps, PropertyEnumFieldProps } from '../Properties/PropertyField';
import type { ParamsSurface } from './commitPolicy';

/** Which control a surface draws where a leaf's own `control` does not settle it. */
export interface SurfaceControls {
  /** What a row draws for a boolean naming no control. A bar picks its own. */
  flag: 'checkbox' | 'switch';
  /** Whether a boolean asking for `toggle` gets one. Where not, it draws as `flag`. */
  flagToggle: boolean;
  /** Whether a number asking for a slider gets one with an end of its range missing, its track running 100 past the end it has. Where not, it is typed. */
  openSlider: boolean;
  /** Whether an enum's `radio` and `menu` draw as asked. Where not, `radio` is the segments `toggle` draws and `menu` is a select. */
  enumAsAsked: boolean;
}

/** {@link SurfaceControls} by surface: the one place a form, a panel, and a lab differ over a leaf's control. */
export const PARAMS_CONTROLS: Record<ParamsSurface, SurfaceControls> = {
  form: { flag: 'checkbox', flagToggle: true, openSlider: true, enumAsAsked: true },
  panel: { flag: 'switch', flagToggle: true, openSlider: true, enumAsAsked: true },
  lab: { flag: 'checkbox', flagToggle: false, openSlider: true, enumAsAsked: true },
};

/** A control an enum can ask for. */
export type EnumControlName = NonNullable<PropertyEnumFieldProps['control']>;

/**
 * The control an enum asking for one draws, by form, where the form has no room for it: a radio group's
 * column does not fit a bar's one line or a palette's, and a dropdown or a menu opened in a popover is a popup inside
 * a popup.
 * Every other control draws as asked, on every surface.
 */
export const PARAMS_ENUM_PLACES: Record<ControlForm, Partial<Record<EnumControlName, EnumControlName>>> = {
  row: {},
  bar: { radio: 'toggle' },
  palette: { radio: 'toggle' },
  popover: { select: 'radio', menu: 'radio' },
  // A bar's overflow draws its cells in the forms they have on the bar.
  menu: { radio: 'toggle' },
};

/** The control an enum asking for `control` draws in `form`. One naming none asks for a select. */
export function enumControlAt(control: EnumControlName | undefined, form: ControlForm): EnumControlName {
  const asked = control ?? 'select';
  return PARAMS_ENUM_PLACES[form][asked] ?? asked;
}

/** `field` with the control `surface` draws for the one its leaf asked for. One naming none is left without. */
export function withSurfaceControl(field: PropertyControlProps, surface: ParamsSurface): PropertyControlProps {
  const draws = PARAMS_CONTROLS[surface];
  switch (field.kind) {
    case 'boolean':
      return field.control === 'toggle' && !draws.flagToggle ? { ...field, control: draws.flag } : field;
    case 'number': {
      const open = field.min === undefined || field.max === undefined;
      return field.control === 'slider' && open && !draws.openSlider ? { ...field, control: 'input' } : field;
    }
    case 'enum':
      if (draws.enumAsAsked) return field;
      if (field.control === 'radio') return { ...field, control: 'toggle' };
      return field.control === 'menu' ? { ...field, control: 'select' } : field;
    default:
      return field;
  }
}

/** `field` as a row of `surface` draws it: a boolean naming no control gets the surface's. */
export function withRowControl(field: PropertyControlProps, surface: ParamsSurface): PropertyControlProps {
  return field.kind === 'boolean' && field.control === undefined
    ? { ...field, control: PARAMS_CONTROLS[surface].flag }
    : field;
}
