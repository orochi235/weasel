import { Code, DataGrid, type DataGridColumn } from '@weasel-js/ui';
import s from './RegistryInspector.module.css';
import type { PropertyDescriptor } from './traitSchemas.types';

interface SchemaRow { id: string; prop: PropertyDescriptor }

const COLUMNS: readonly DataGridColumn<SchemaRow>[] = [
  {
    id: 'property',
    header: 'property',
    sortable: false,
    render: ({ prop }) => (
      <>
        <code className={s.schemaName}>{prop.name}</code>
        {prop.optional && <span className={s.schemaOptional} aria-label="optional">?</span>}
      </>
    ),
  },
  {
    id: 'type',
    header: 'type',
    sortable: false,
    render: ({ prop }) => <Code variant="plain" tone="accent" size="xs">{prop.type}</Code>,
  },
  {
    id: 'default',
    header: 'default',
    sortable: false,
    render: ({ prop }) => (prop.defaultLiteral !== undefined
      ? <code className={s.schemaDefault}>{prop.defaultLiteral}</code>
      : <span className={s.schemaMuted}>—</span>),
  },
];

/** Renders a list of property descriptors as a compact table. Each row shows
 *  the property name, an optional `?` indicator, the TypeScript type, and the
 *  authored default literal when known. Used by every "what does this thing
 *  take" panel in the inspector. */
export function SchemaTable({
  rows,
  empty,
}: {
  rows: readonly PropertyDescriptor[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className={s.empty}>{empty ?? 'No properties extracted.'}</p>;
  }
  return (
    <DataGrid
      className={s.schemaTable}
      rows={rows.map((prop) => ({ id: prop.name, prop }))}
      columns={COLUMNS}
    />
  );
}
