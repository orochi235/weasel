/**
 * The Registry tab: what the canvas has registered, filtered by name, beside
 * the entry picked. Re-read when the registry changes, and on selection and
 * scene changes too, since an action's `enabled` and `active` move with them
 * and no notice reports that.
 */
import { useState, type ReactElement } from 'react';
import type { DevtoolsRegistry } from '@weasel-js/core/devtools';
import { Input } from '@weasel-js/ui/components/Input';
import { Tree, type TreeNode } from '@weasel-js/ui/components/Tree';
import { useRootQuery } from '../hooks';
import type { DevtoolsViewProps } from '../tabs';
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

function nodesOf(reg: DevtoolsRegistry, filter: string): TreeNode[] {
  const q = filter.trim().toLowerCase();
  return CATEGORIES.map((category) => {
    const rows = rowsOf(reg, category).filter((r) => !q || r.id.toLowerCase().includes(q));
    return {
      id: `cat:${category}`,
      label: TITLES[category],
      trailing: <span className={s.count}>{rows.length}</span>,
      children: rows.map((r) => ({
        id: `${category}:${r.id}`,
        textValue: r.id,
        label: r.id,
        ...(r.facts ? { trailing: <span className={s.facts}>{r.facts}</span> } : {}),
      })),
    };
  });
}

function parsePick(key: string | null): RegistryPick | null {
  if (!key || key.startsWith('cat:')) return null;
  const at = key.indexOf(':');
  return { category: key.slice(0, at) as RegistryPick['category'], id: key.slice(at + 1) };
}

export function RegistryView({ client, rootId }: DevtoolsViewProps): ReactElement {
  const registry = useRootQuery(
    client, rootId, ['registry', 'selection', 'scene'], () => client.request(rootId, { type: 'get-registry' }),
  );
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(CATEGORIES.map((c) => `cat:${c}`)));

  if (registry.error) return <p className={s.note}>{registry.error}</p>;
  const reg = registry.data;
  if (!reg) return <p className={s.note}>Loading…</p>;
  const pick = parsePick(picked);

  return (
    <div className={s.split}>
      <div className={s.listPane} data-pane="list">
        <Input aria-label="Filter" placeholder="Filter by name" value={filter} onChange={setFilter} />
        <Tree
          aria-label="Registry entries"
          nodes={nodesOf(reg, filter)}
          expandedIds={expanded}
          onExpandedChange={setExpanded}
          selectionMode="single"
          selectedIds={picked ? [picked] : []}
          onSelectionChange={(ids) => setPicked(ids.values().next().value ?? null)}
        />
      </div>
      <div className={s.detailPane} data-pane="detail">
        {pick
          ? <RegistryEntryDetail registry={reg} pick={pick} />
          : <p className={s.note}>Pick an entry to see its bindings.</p>}
        {reg.routingKinds.length > 0 && (
          <p className={s.kinds}>Routing kinds: {reg.routingKinds.join(', ')}</p>
        )}
      </div>
    </div>
  );
}
