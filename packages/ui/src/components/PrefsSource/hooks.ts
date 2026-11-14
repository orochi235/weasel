import { useMemo } from 'react';
import {
  createSelectionSource,
  createValuesSource,
  type PrefGroup,
  type PrefSection,
  type PrefsSource,
  type SelectionSource,
  type SelectionSourceInput,
  type ValuesSourceOptions,
} from '@weasel-js/prefs';

/** `createValuesSource` (`@weasel-js/prefs`) over `values`, rebuilt only when what it reads changes. */
export function useValuesSource(
  schema: PrefGroup | PrefSection,
  values: unknown,
  onChange: (path: string, value: unknown) => void,
  options: ValuesSourceOptions = {},
): PrefsSource {
  const { auto, onAutoChange, canAuto, mixed, onReset, stateAt, over } = options;
  return useMemo(
    () => createValuesSource(schema, () => values, onChange, { auto, onAutoChange, canAuto, mixed, onReset, stateAt, over }),
    [schema, values, onChange, auto, onAutoChange, canAuto, mixed, onReset, stateAt, over],
  );
}

/** `createSelectionSource` (`@weasel-js/prefs`) over `input`. What a selection holds changes with every edit, so
 *  it is built fresh each render. */
export function useSelectionSource(input: SelectionSourceInput): SelectionSource {
  return createSelectionSource(input);
}
