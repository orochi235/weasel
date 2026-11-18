import type { ControlHold } from '../Disabled/controlHold';
import type { DataGridColumn } from './DataGrid';
import type { SortState } from './rowSort';
import s from './DataGrid.module.css';

interface DataGridHeadProps<Row> {
  columns: readonly DataGridColumn<Row>[];
  sort: SortState;
  onSort: (columnId: string) => void;
  dragEnabled: boolean;
  detailEnabled: boolean;
  hold: ControlHold;
}

/** A data grid's header row: a sort button over each sortable column, marked with the direction it sorts. */
export function DataGridHead<Row>({ columns, sort, onSort, dragEnabled, detailEnabled, hold }: DataGridHeadProps<Row>) {
  return (
    <thead>
      <tr>
        {dragEnabled && <th className={s.handleCol} aria-label="drag" />}
        {detailEnabled && <th className={s.detailCol} aria-label="details" />}
        {columns.map((col) => {
          const sortable = col.sortable !== false;
          const active = sort?.columnId === col.id;
          const indicator = active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
          return (
            <th
              key={col.id}
              className={[col.className, col.numeric && s.numeric, active && s.sortActive].filter(Boolean).join(' ') || undefined}
              aria-sort={sortable ? (active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
            >
              {sortable ? (
                <button type="button" className={s.sortButton} {...hold.button(false)} onClick={() => onSort(col.id)}>
                  {col.header}{indicator}
                </button>
              ) : (
                <>{col.header}{indicator}</>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
