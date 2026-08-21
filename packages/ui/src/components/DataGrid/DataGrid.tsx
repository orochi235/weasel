/**
 * Lightweight sortable data grid. Use for inspector tables — action
 * registries, route maps, telemetry rows. Intentionally narrow:
 *
 * - Sortable columns (click header to cycle asc → desc → none)
 * - Custom cell render via per-column `render`
 * - Optional drag handles for row reordering (when `onReorder` is set)
 *
 * Not: virtual scrolling, column resizing, multi-column sort, filtering,
 * inline editing. Reach for a real grid library when you need those.
 */
import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useReorderDragList } from '../../useReorderDragList';
import s from './DataGrid.module.css';

/**
 * One column of a {@link DataGrid}. `id` doubles as the default property name
 * read off each row when no `accessor` is given.
 */
export interface DataGridColumn<Row> {
  id: string;
  header: ReactNode;
  /** Pull a sortable value from the row. Defaults to `(row as any)[column.id]`. */
  accessor?: (row: Row) => string | number | null | undefined;
  /** Render the cell. Defaults to `String(accessor(row) ?? '')`. */
  render?: (row: Row) => ReactNode;
  /** Default true. Set false to suppress the sort affordance on this column. */
  sortable?: boolean;
  /** Optional CSS class on every <td> in this column. */
  className?: string;
}

/** Props for {@link DataGrid}. */
export interface DataGridProps<Row extends { id: string }> {
  rows: readonly Row[];
  columns: readonly DataGridColumn<Row>[];
  /** Initial sort. Omit for unsorted (rows render in input order). */
  defaultSort?: { columnId: string; direction: 'asc' | 'desc' };
  /** Enable drag handles in a leading column. Receives the reorder spec
   *  (the existing `useReorderDragList` semantics — see weasel-ui). */
  onReorder?: (ids: string[], targetIndex: number) => void;
  /** Empty-state row text. Default `'—'`. */
  empty?: ReactNode;
  className?: string;
}

type SortState = { columnId: string; direction: 'asc' | 'desc' } | null;

/**
 * Sortable table for inspector-style data. Rows are keyed by `id`. Clicking a
 * sortable header cycles ascending, descending, unsorted; nullish values sort
 * last regardless of direction. Passing `onReorder` adds a leading drag-handle
 * column — note that the drag indices it reports are into the *sorted* row
 * order, not the input order.
 */
export function DataGrid<Row extends { id: string }>(props: DataGridProps<Row>) {
  const { rows, columns, defaultSort, onReorder, empty = '—', className } = props;
  const [sort, setSort] = useState<SortState>(defaultSort ?? null);

  const sortedRows = useMemo(() => {
    if (!sort) return [...rows];
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col) return [...rows];
    const get = col.accessor ?? ((row: Row) => (row as unknown as Record<string, unknown>)[col.id] as string | number | null | undefined);
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, columns, sort]);

  const cycleSort = (columnId: string) => {
    setSort((cur) => {
      if (!cur || cur.columnId !== columnId) return { columnId, direction: 'asc' };
      if (cur.direction === 'asc') return { columnId, direction: 'desc' };
      return null;
    });
  };

  // Drag handles via useReorderDragList. Adapter: the hook expects
  // `{ id, label }`-shaped items; we map our rows to that shape (label
  // unused — the hook only uses id and locked).
  const drag = useReorderDragList({
    items: sortedRows.map((r) => ({ id: r.id, label: '' })),
    selectedIds: [],
    onReorder: onReorder ?? (() => {}),
  });
  const dragEnabled = !!onReorder;

  const cls = [s.grid, className].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      ref={dragEnabled ? (drag.containerProps.ref as React.RefCallback<HTMLDivElement>) : undefined}
      onPointerMove={dragEnabled ? drag.containerProps.onPointerMove : undefined}
      onPointerUp={dragEnabled ? drag.containerProps.onPointerUp : undefined}
      onPointerCancel={dragEnabled ? drag.containerProps.onPointerCancel : undefined}
    >
      <table className={s.table}>
        <thead>
          <tr>
            {dragEnabled && <th className={s.handleCol} aria-label="drag" />}
            {columns.map((col) => {
              const sortable = col.sortable !== false;
              const active = sort?.columnId === col.id;
              const indicator = active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
              return (
                <th
                  key={col.id}
                  className={[col.className, sortable ? s.sortable : '', active ? s.sortActive : '']
                    .filter(Boolean).join(' ')}
                  onClick={sortable ? () => cycleSort(col.id) : undefined}
                >
                  {col.header}{indicator}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (dragEnabled ? 1 : 0)} className={s.empty}>
                {empty}
              </td>
            </tr>
          )}
          {sortedRows.map((row, i) => {
            const isDragging = drag.state.draggedIds?.includes(row.id) ?? false;
            return (
              <Fragment key={row.id}>
                <tr className={isDragging ? s.dragging : undefined}>
                  {dragEnabled && (
                    <td
                      className={s.handleCell}
                      onPointerDown={(e) => drag.rowProps(row.id, i).onPointerDown(e)}
                    >
                      <span aria-hidden="true">⋮⋮</span>
                    </td>
                  )}
                  {columns.map((col) => {
                    const get = col.accessor ?? ((r: Row) => (r as unknown as Record<string, unknown>)[col.id] as string | number | null | undefined);
                    const content = col.render ? col.render(row) : String(get(row) ?? '');
                    return (
                      <td key={col.id} className={col.className}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {dragEnabled && drag.state.targetIndex !== null && (
        <div
          className={s.dropIndicator}
          style={{ top: `${drag.state.targetIndex * 28}px` }}
        />
      )}
    </div>
  );
}
