import { Select, usePersistedState } from '@weasel-js/labkit';
import { useCallback, useEffect, useMemo } from 'react';
import type { Globals } from '../protocol/messages';
import { type GlobalDeclarations, labGlobals } from './globals';

const RECORD = 'fg-globals';

function useLabGlobals(declarations: GlobalDeclarations): [Globals, (key: string, value: string) => void] {
  const [stored, setStored] = usePersistedState<unknown>(RECORD, null, { scope: 'lab' });
  const values = useMemo(() => labGlobals(declarations, stored), [declarations, stored]);
  const set = useCallback(
    (key: string, value: string) => setStored((prev: unknown) => ({ ...labGlobals(declarations, prev), [key]: value })),
    [declarations, setStored],
  );
  return [values, set];
}

/** The lab's header control for its global values: one select per declaration. */
export function GlobalsToolbar({ declarations }: { declarations: GlobalDeclarations }) {
  const [values, set] = useLabGlobals(declarations);
  return (
    <div className="fg-globals" role="toolbar" aria-label="Globals">
      {Object.entries(declarations).map(([key, declaration]) => (
        <Select
          key={key}
          aria-label={declaration.label}
          width="fit"
          selectedKey={String(values[key])}
          onSelectionChange={(value) => set(key, value)}
          options={declaration.options}
        />
      ))}
    </div>
  );
}

/** Reports the lab's global values, as the toolbar persists them, to `onChange`. Renders nothing; mount it inside the lab. */
export function LabGlobals({
  declarations,
  onChange,
}: {
  declarations: GlobalDeclarations;
  onChange: (values: Globals) => void;
}) {
  const [values] = useLabGlobals(declarations);
  useEffect(() => onChange(values), [values, onChange]);
  return null;
}
