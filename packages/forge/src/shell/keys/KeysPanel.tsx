import './keys.css';
import { useLabEntries, type LabContribution } from '@weasel-js/labkit';
import { type ActionsRegistry, useActionsRegistry } from '@weasel-js/core';
import { useRegisteredActions } from '@weasel-js/ui/components/Prefs';
import { useMemo, useSyncExternalStore } from 'react';
import { type KeyRow, keymapDefs, keyRows } from './keyRows';

export { describeBinding } from './keyRows';

/** Every key binding the lab's registry holds, by group, re-read as actions come and go. */
export function useKeyRows(): readonly KeyRow[] {
  const registry = useActionsRegistry();
  const entries = useLabEntries();
  const actions = useRegisteredActions();
  const overrides = useSyncExternalStore(registry?.subscribe ?? noSubscribe, () => overridesOf(registry));
  return useMemo(() => keyRows(actions, keymapDefs(entries), overrides), [actions, entries, overrides]);
}

const noSubscribe = (): (() => void) => () => {};
const overridesOf = (registry: ActionsRegistry | null) => registry?.bindingOverrides();

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
