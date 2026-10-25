/**
 * The Registry tab: what the canvas has registered, filtered by name, beside
 * the entry picked. Re-read when the registry changes, and on selection and
 * scene changes too, since an action's `enabled` and `active` move with them
 * and no notice reports that.
 */
import { useMemo, useState, type ReactElement } from 'react';
import type { DevtoolsRegistry } from '@weasel-js/core/devtools-protocol';
import { useRootQuery } from '../hooks';
import type { DevtoolsViewProps } from '../tabs';
import { RegistryBrowser, type RegistryBrowserPick, type RegistryCategory } from './RegistryBrowser';
import { RegistryEntryDetail, type RegistryPick } from './RegistryEntryDetail';
import s from './RegistryView.module.css';

const CATEGORIES = ['tools', 'actions', 'deps'] as const;
const TITLES = { tools: 'Tools', actions: 'Actions', deps: 'Deps' } as const;

interface Row { id: string; facts: string }

function rowsOf(reg: DevtoolsRegistry, category: (typeof CATEGORIES)[number]): Row[] {
  switch (category) {
    case 'tools': return reg.tools.map((t) => ({ id: t.id, facts: t.slot }));
    case 'actions': return reg.actions.map((a) => ({
      id: a.id, facts: [a.scope, a.enabled === true ? '' : 'disabled', a.active ? 'active' : ''].filter(Boolean).join(' '),
    }));
    case 'deps': return reg.deps.map((d) => ({ id: d.name, facts: d.depth === 0 ? '' : `+${d.depth}` }));
  }
}

function categoriesOf(reg: DevtoolsRegistry): RegistryCategory[] {
  return CATEGORIES.map((category) => ({
    id: category,
    label: TITLES[category],
    entries: rowsOf(reg, category).map((r) => ({
      id: r.id,
      label: r.id,
      ...(r.facts ? { trailing: <span className={s.facts}>{r.facts}</span> } : {}),
    })),
  }));
}

export function RegistryView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const registry = useRootQuery(
    client, rootId, ['registry', 'selection', 'scene'], () => client.request(rootId, { type: 'get-registry' }),
  );
  const [picked, setPicked] = useState<RegistryBrowserPick | null>(null);
  const reg = registry.data;
  const categories = useMemo(() => (reg ? categoriesOf(reg) : []), [reg]);

  if (registry.error) return <p className={s.note}>{registry.error}</p>;
  if (!reg) return <p className={s.note}>Loading…</p>;

  return (
    <RegistryBrowser
      categories={categories}
      defaultOpen={CATEGORIES}
      selected={picked}
      onSelect={setPicked}
      detail={
        <>
          {picked
            ? <RegistryEntryDetail registry={reg} pick={picked as RegistryPick} />
            : <p className={s.note}>Pick an entry to see its bindings.</p>}
          {reg.routingKinds.length > 0 && (
            <p className={s.kinds}>Routing kinds: {reg.routingKinds.join(', ')}</p>
          )}
        </>
      }
    />
  );
}
