import {
  isBuiltinPref,
  type PrefGroup,
  type PrefLeaf,
  type PrefSection,
  prefLeafValue,
} from '@weasel-js/prefs';
import { enumControlAt, prefFieldProps } from '@weasel-js/ui/components/Prefs';
import { PropertyField } from '@weasel-js/ui/components/Properties';
import { valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { isLeafEnabled } from '../config/visible';
import type { ControlMatrixColumn } from './ControlMatrix';
import { ControlRow } from './ControlRow';
import { useFieldChoices } from './fieldChoices';
import type { MatrixTarget } from './matrixTarget';

/** The open popover: which cell, and the element it hangs off. */
export interface OpenCell {
  path: string;
  /** The schema's own leaf at `path`: an alias, where the cell shows another setting. */
  leaf: PrefLeaf;
  cell: MatrixTarget;
  column: ControlMatrixColumn;
  first: boolean;
  label: string;
}

/**
 * The control a cell opens. An enum draws the control it asks for, except that
 * one which would open a popup of its own lists its options as radios instead
 * (`PARAMS_ENUM_PLACES`).
 * Choosing one is the whole edit, so it closes the popover.
 */
export function MatrixEditor({
  open,
  schema,
  over,
  config,
  setConfig,
  close,
}: {
  open: OpenCell;
  schema: ResolvedConfig;
  over?: PrefGroup | PrefSection;
  config: Record<string, unknown>;
  setConfig: (path: string, value: unknown) => void;
  close: () => void;
}) {
  const { path, leaf } = open;
  const choices = useFieldChoices();
  const disabled = !isLeafEnabled(schema, path, config, over);
  const field = isBuiltinPref(leaf)
    ? prefFieldProps(
        leaf,
        {
          value: prefLeafValue(leaf, valueAtPath(config, path)),
          setValue: (next) => setConfig(path, next),
          fields: choices,
          disabled,
        },
        'lab',
      )
    : null;
  if (field?.kind === 'enum') {
    return (
      <PropertyField
        {...field}
        label={leaf.name}
        control={enumControlAt(field.control, 'popover')}
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
      over={over}
      config={config}
      shown={config}
      setConfig={setConfig}
      pack="one-up"
      disabled={disabled}
    />
  );
}
