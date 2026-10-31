import type { PlotData, PlotScope, PlotTable, PlotValue } from '@weasel-js/plot';
import type { ReactElement } from 'react';
import { Button } from '../Button';
import { CloseButton } from '../CloseButton';
import { DataGrid, type DataGridColumn } from '../DataGrid';
import { PropertyControl } from '../Properties';
import s from './PlotDataPanel.module.css';
import { valueControl } from './valueControl';

/** Props for {@link PlotTableView}. */
export interface PlotTableViewProps {
  data: PlotData;
  table: PlotTable;
  scope: PlotScope;
  /** Proposes `next` as the chart's data, an edit named `label`. */
  edit: (next: (data: PlotData) => PlotData, label: string) => void;
}

interface Row { id: string; index: number }

/** One table of a plot schema as a grid of controls: a row per item, which can be added, removed, dragged into
 *  another order, and opened onto the tables it holds. */
export function PlotTableView({ data, table, scope, edit }: PlotTableViewProps): ReactElement {
  const count = table.count(data, scope);
  const rows: Row[] = Array.from({ length: count }, (_, index) => ({ id: String(index), index }));
  const rowName = (r: number) => table.rowLabel?.(data, scope, r) || `${table.item} ${r + 1}`;
  const columns: DataGridColumn<Row>[] = table.columns(data, scope).map((column) => ({
    id: column.key,
    header: column.label,
    sortable: false,
    numeric: column.type.kind === 'number',
    render: ({ index }) => {
      if (column.applies?.(data, scope, index) === false) return null;
      const spec = { ...column, value: column.get(data, scope, index) };
      const set = (value: PlotValue) => edit((d) => column.set(d, scope, index, value), `Edit ${column.label.toLowerCase()}`);
      return <PropertyControl {...valueControl(spec, `${column.label} of ${rowName(index)}`, set)} className={s.cell} />;
    },
  }));
  const { insert, remove } = table;
  if (insert || remove) {
    columns.push({
      id: '__row', header: '', sortable: false,
      render: ({ index }) => (
        <span className={s.rowActions}>
          {insert && (
            <Button
              size="sm" variant="ghost" ariaLabel={`Insert ${table.item} after ${rowName(index)}`}
              onClick={() => edit((d) => insert(d, scope, index + 1), `Add ${table.item}`)}
            >
              +
            </Button>
          )}
          {remove && (
            <CloseButton ariaLabel={`Remove ${rowName(index)}`} onClick={() => edit((d) => remove(d, scope, index), `Remove ${table.item}`)} />
          )}
        </span>
      ),
    });
  }
  const move = table.move;
  const children = table.children;
  return (
    <div className={s.table}>
      {scope.length > 0 && <div className={s.heading}>{table.label}</div>}
      <DataGrid<Row>
        rows={rows}
        columns={columns}
        rowLabel={(r) => rowName(r.index)}
        empty={`No ${table.label.toLowerCase()}`}
        onReorder={move && ((ids, target) => {
          const from = Number(ids[0]);
          const to = target > from ? target - 1 : target;
          if (to !== from) edit((d) => move(d, scope, from, to), `Reorder ${table.label.toLowerCase()}`);
        })}
        renderDetail={children && (({ index }) => (
          <div className={s.nested}>
            {children.map((child) => (
              <PlotTableView key={child.key} data={data} table={child} scope={[...scope, index]} edit={edit} />
            ))}
          </div>
        ))}
      />
      {insert && (
        <Button size="sm" variant="ghost" className={s.add} onClick={() => edit((d) => insert(d, scope, table.count(d, scope)), `Add ${table.item}`)}>
          {`Add ${table.item}`}
        </Button>
      )}
    </div>
  );
}
