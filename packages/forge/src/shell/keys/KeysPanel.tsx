import './keys.css';
import { useLabEntries, type LabContribution } from '@weasel-js/labkit';
import { useActionsRegistry } from '@weasel-js/core';
import { useEffect, useMemo, useReducer } from 'react';
import { type KeyRow, keymapDefs, keyRows } from './keyRows';

export { describeBinding } from './keyRows';

/** Every key binding the lab's registry holds, by group, re-read as actions come and go. */
export function useKeyRows(): readonly KeyRow[] {
  const registry = useActionsRegistry();
  const entries = useLabEntries();
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => registry?.subscribe(bump), [registry]);
  return useMemo(
    () => (registry ? keyRows(registry.list(), keymapDefs(entries), registry.bindingOverrides()) : []),
    // `version` is the registry's change signal: `list()` has no identity to key on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registry, entries, version],
  );
}

function KeysPanel() {
  const rows = useKeyRows();
  if (rows.length === 0) return <p className="fg-keys__empty">No key bindings.</p>;
  const groups = new Map<string, KeyRow[]>();
  for (const row of rows) groups.set(row.group, [...(groups.get(row.group) ?? []), row]);
  return (
    <div className="fg-keys">
      {[...groups].map(([group, members]) => (
        <section key={group} className="fg-keys__group" aria-label={group}>
          <h3 className="fg-keys__heading">{group}</h3>
          <ul className="fg-keys__list">
            {members.map((row) => (
              <li key={row.id} className="fg-keys__row">
                <span className="fg-keys__label">{row.label}</span>
                <span className="fg-keys__chips">
                  {row.keys.map((chip) => (
                    <kbd key={chip} className="fg-keys__chip">{chip}</kbd>
                  ))}
                  {row.others.map((chip) => (
                    <kbd key={chip} className="fg-keys__chip fg-keys__chip--gesture">{chip}</kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export const KEYS_SECTION: LabContribution = {
  id: 'fg-keys',
  region: 'aside',
  item: { title: 'Keys', body: <KeysPanel /> },
};
