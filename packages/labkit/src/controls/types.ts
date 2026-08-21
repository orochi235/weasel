/** Which control a config field is edited with. */
export type ConfigFieldType = 'slider' | 'checkbox' | 'select' | 'number' | 'text' | 'color';

/** What every config field carries: the config key it writes, the label shown
 *  beside it, and which control renders it. */
export interface ConfigFieldBase {
  key: string;
  label: string;
  type: ConfigFieldType;
}

/** A bounded number edited by dragging. */
export interface SliderField extends ConfigFieldBase {
  type: 'slider';
  default: number;
  min: number;
  max: number;
  step?: number;
}

/** A boolean. */
export interface CheckboxField extends ConfigFieldBase {
  type: 'checkbox';
  default: boolean;
}

/** One choice in a select field. */
export interface SelectOption {
  value: string;
  label: string;
}

/** A fixed set of labeled choices. */
export interface SelectField extends ConfigFieldBase {
  type: 'select';
  default: string;
  options: SelectOption[];
}

/** A number typed directly, optionally bounded. Use a slider field instead
 *  when the range matters more than the exact value. */
export interface NumberField extends ConfigFieldBase {
  type: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
}

/** A free-text string. Writes are debounced so typing does not re-run the
 *  instrument on every keystroke. */
export interface TextField extends ConfigFieldBase {
  type: 'text';
  default: string;
  placeholder?: string;
  maxLength?: number;
  /** Milliseconds to debounce live setConfig calls. Default 150 ms. Set to 0 to disable. */
  debounceMs?: number;
}

/** A color, as a CSS color string. */
export interface ColorField extends ConfigFieldBase {
  type: 'color';
  default: string;
}

/** One field of an instrument's config schema. The schema is what the control
 *  panel renders, and what `validateConfigSchema` checks. */
export type ConfigField =
  | SliderField
  | CheckboxField
  | SelectField
  | NumberField
  | TextField
  | ColorField;
