export type ConfigFieldType = 'slider' | 'checkbox' | 'select' | 'number' | 'text' | 'color';

export interface ConfigFieldBase {
  key: string;
  label: string;
  type: ConfigFieldType;
}

export interface SliderField extends ConfigFieldBase {
  type: 'slider';
  default: number;
  min: number;
  max: number;
  step?: number;
}

export interface CheckboxField extends ConfigFieldBase {
  type: 'checkbox';
  default: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectField extends ConfigFieldBase {
  type: 'select';
  default: string;
  options: SelectOption[];
}

export interface NumberField extends ConfigFieldBase {
  type: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface TextField extends ConfigFieldBase {
  type: 'text';
  default: string;
  placeholder?: string;
  maxLength?: number;
  /** Milliseconds to debounce live setConfig calls. Default 150 ms. Set to 0 to disable. */
  debounceMs?: number;
}

export interface ColorField extends ConfigFieldBase {
  type: 'color';
  default: string;
}

export type ConfigField =
  | SliderField
  | CheckboxField
  | SelectField
  | NumberField
  | TextField
  | ColorField;
