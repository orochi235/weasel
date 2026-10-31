/** A plot schema field or cell as the props of the params control that edits it. */
import type { PlotValue, PlotValueType } from '@weasel-js/plot';
import type { PropertyControlProps } from '../Properties';

/** What a field or cell is, for its control: its type, whether it can be unset or only read, and its value. */
export interface ValueSpec {
  type: PlotValueType;
  value: PlotValue;
  optional?: boolean;
  readOnly?: boolean;
}

/** The props of the control for `spec`, reporting each committed value through `set`. */
export function valueControl(spec: ValueSpec, name: string, set: (value: PlotValue) => void): PropertyControlProps {
  const { type, value, optional, readOnly } = spec;
  const clear = optional ? () => set(undefined) : undefined;
  switch (type.kind) {
    case 'number':
      return {
        kind: 'number', name, readOnly, value: typeof value === 'number' ? value : undefined,
        min: type.min, max: type.max, step: type.step, onChange: set, onClear: clear,
      };
    case 'boolean':
      return { kind: 'boolean', name, readOnly, value: value === true, onChange: set };
    case 'enum':
      return {
        kind: 'enum', name, readOnly, value: typeof value === 'string' ? value : undefined,
        options: type.options.map((o) => ({ value: o, label: o })), onChange: set, onClear: clear,
      };
    case 'color':
      return { kind: 'color', name, readOnly, value: typeof value === 'string' ? value : undefined, onChange: set, onInput: () => {} };
    case 'string':
      return {
        kind: 'string', name, readOnly, value: typeof value === 'string' ? value : undefined, placeholder: type.placeholder,
        onChange: (next) => set(next === '' && optional ? undefined : next),
      };
  }
}
