import { Badge } from '@weasel-js/ui/components/Badge';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { KeySequence, keySpecsFromShortcut } from '@weasel-js/ui/components/Keycaps';
import s from '../RegistryInspector.module.css';
import { collectBundles } from '../registryData';
import type { BundleEntry, ToolEntry } from '../registryEntries';
import { BundleBadge } from './shared';

export type BundleMemberRow = { id: string; tool: ToolEntry | undefined };

export function bundleMemberColumns(): readonly DataGridColumn<BundleMemberRow>[] {
  return [
    {
      id: 'label',
      header: 'Tool',
      accessor: (r) => r.tool?.label ?? r.id,
      render: (r) => r.tool?.label ?? r.id,
    },
    {
      id: 'id',
      header: 'id',
      accessor: (r) => r.id,
      render: (r) => <code>{r.id}</code>,
    },
    {
      id: 'hook',
      header: 'hook',
      accessor: (r) => r.tool?.hookName ?? '',
      render: (r) => r.tool?.hookName
        ? <code>{r.tool.hookName}</code>
        : <span className={s.empty}>—</span>,
    },
    {
      id: 'group',
      header: 'group',
      accessor: (r) => r.tool?.presentation?.group ?? '',
      render: (r) => r.tool?.presentation?.group ?? <span className={s.empty}>—</span>,
    },
    {
      id: 'shortcut',
      header: 'shortcut',
      sortable: false,
      render: (r) => <KeySequence keys={keySpecsFromShortcut(r.tool?.switchShortcut)} variant="inverse" />,
    },
  ];
}

export function BundleDetail({
  entry, tools,
}: {
  entry: BundleEntry;
  tools: readonly ToolEntry[];
}) {
  const byId = new Map(tools.map((t) => [t.id, t]));
  const others = collectBundles().filter((b) => b.id !== entry.id);
  // Group breakdown — counts of presentation.group across the bundle's tools.
  const groupCounts = new Map<string, number>();
  for (const id of entry.tools) {
    const g = byId.get(id)?.presentation?.group ?? '—';
    groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
  }
  return (
    <div>
      <h2 className={s.detailHeading}><BundleBadge id={entry.id} label={entry.label} /></h2>
      <DetailList>
        <DetailRow label="id"><Code>{entry.id}</Code></DetailRow>
        <DetailRow label="tool count" values="figures">{entry.tools.length}</DetailRow>
        <DetailRow label="by group">
          {[...groupCounts.entries()].map(([g, n]) => (
            <Code key={g}>{g} <Badge shape="pill" size="sm" status="neutral" variant="subtle">{n}</Badge></Code>
          ))}
        </DetailRow>
      </DetailList>
      <h3 className={s.subHeading}>Tools</h3>
      <DataGrid
        rows={entry.tools.map((id) => ({ id, tool: byId.get(id) }))}
        columns={bundleMemberColumns()}
        empty="No tools in this bundle."
      />
      <DetailList title="Diff vs other bundles" className={s.diffSection}>
        {others.map((o) => {
          const mine = new Set(entry.tools);
          const theirs = new Set(o.tools);
          const added = entry.tools.filter((t) => !theirs.has(t));
          const removed = o.tools.filter((t) => !mine.has(t));
          return (
            <DetailRow key={o.id} label={<>vs <BundleBadge id={o.id} label={o.label} /></>}>
              {added.length === 0 && removed.length === 0
                ? <span className={s.empty}>(identical)</span>
                : <>
                    {added.map((t) => <Code key={`+${t}`} status="success">+{t}</Code>)}
                    {removed.map((t) => <Code key={`-${t}`} status="danger">−{t}</Code>)}
                  </>}
            </DetailRow>
          );
        })}
      </DetailList>
    </div>
  );
}
