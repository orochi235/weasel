import { DataGrid } from '@weasel-js/ui/components/DataGrid';
import { ItemList } from '@weasel-js/ui/components/ItemList';
import { Cell } from './Cell';
import { Section } from './Section';

export function ListsAndData() {
  return (
    <Section title="Lists & data">
      <Cell label="ItemList">
        <ItemList
          rows={[
            { id: 'a', label: 'Draw rect' },
            { id: 'b', label: 'Fill', selected: true },
            { id: 'c', label: 'Move', muted: true },
          ]}
          empty="Nothing"
        />
      </Cell>
      <Cell label="DataGrid">
        <DataGrid
          rows={[
            { id: '1', name: 'accent', count: 3 },
            { id: '2', name: 'info', count: 1 },
            { id: '3', name: 'danger', count: 2 },
          ]}
          columns={[
            { id: 'name', header: 'name', accessor: (r) => r.name, sortable: true },
            { id: 'count', header: 'count', accessor: (r) => r.count, sortable: true },
          ]}
          defaultSort={{ columnId: 'name', direction: 'asc' }}
        />
      </Cell>
    </Section>
  );
}
