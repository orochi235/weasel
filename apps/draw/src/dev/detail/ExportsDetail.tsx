import { DataGrid } from '@weasel-js/ui/components/DataGrid';
import s from '../RegistryInspector.module.css';
import type { ExportsEntry } from '../registryEntries';

export function ExportsDetail({ entry }: { entry: ExportsEntry }) {
  const rows = Object.entries(entry.names).map(([name, kind]) => ({ id: name, name, kind }));
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <p className={s.empty}>
        Every name this entry point exports, from <code>packages/core/exports.inventory.json</code>.
      </p>
      <DataGrid
        rows={rows}
        columns={[
          { id: 'name', header: 'Name', sortable: true, accessor: (r) => r.name, render: (r) => <code>{r.name}</code> },
          { id: 'kind', header: 'Kind', sortable: true, accessor: (r) => r.kind, render: (r) => r.kind },
        ]}
        empty="This entry point exports nothing."
      />
    </div>
  );
}
