import { isBuiltinPref, type PrefLeaf } from '@weasel-js/prefs';
import { PropertyField, prefFieldProps } from '@weasel-js/ui';
import { valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { isLeafEnabled } from '../config/visible';
import type { ControlMatrixColumn } from './ControlMatrix';
import { ControlRow } from './ControlRow';
import { useFieldChoices } from './fieldChoices';

/** The open popover: which cell, and the element it hangs off. */
export interface OpenCell {
  path: string;
  leaf: PrefLeaf;
  column: ControlMatrixColumn;
  first: boolean;
  label: string;
}

/**
 * The control a cell opens. An enum lists its options outright, as radios: the
 * panel's dropdown would be a second popup opened from inside this one.
 * Choosing one is the whole edit, so it closes the popover.
 */
export function MatrixEditor({
  open,
  schema,
  config,
  setConfig,
  close,
}: {
  open: OpenCell;
  schema: ResolvedConfig;
  config: Record<string, unknown>;
  setConfig: (path: string, value: unknown) => void;
  close: () => void;
}) {
  const { path, leaf } = open;
  const choices = useFieldChoices();
  const disabled = !isLeafEnabled(schema, path, config);
  const field = isBuiltinPref(leaf)
    ? prefFieldProps(leaf, {
        value: valueAtPath(config, path) ?? leaf.default,
        setValue: (next) => setConfig(path, next),
        fields: choices,
        disabled,
      })
    : null;
  if (field?.kind === 'enum') {
    return (
      <PropertyField
        {...field}
        label={leaf.name}
        control="radio"
        onChange={(next: Parameters<typeof field.onChange>[0]) => {
          field.onChange(next);
          close();
        }}
      />
    );
  }
  return (
    <ControlRow
      path={path}
      leaf={leaf}
      resolved={schema}
      config={config}
      shown={config}
      setConfig={setConfig}
      pack="one-up"
      disabled={disabled}
    />
  );
}
