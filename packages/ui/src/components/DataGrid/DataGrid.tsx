/**
 * Lightweight sortable data grid. Use for inspector tables — action
 * registries, route maps, telemetry rows. Intentionally narrow:
 *
 * - Sortable columns (click header to cycle asc → desc → none)
 * - Custom cell render via per-column `render`
 * - Optional drag handles for row reordering (when `onReorder` is set)
 * - Per-row class, row activation, and expandable full-width detail rows
 *
 * Not: virtual scrolling, column resizing, multi-column sort, filtering,
 * inline editing. Reach for a real grid library when you need those.
 */
import { Fragment, useId, useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useReorderDragList } from '../../useReorderDragList';
import { Disclosure } from '../Disclosure';
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
  /** Extra class on a row's `<tr>`, for row-level state such as a verdict. */
  rowClassName?: (row: Row) => string | undefined;
  /**
   * Activate a row. Makes each row focusable: a click anywhere in it, or
   * Enter/Space while it has focus, calls this. Clicks and keys landing on a
   * control inside a cell (button, link, input, …) are left to that control.
   */
  onRowClick?: (row: Row) => void;
  /**
   * Content for a full-width detail row under `row`, shown while the row is
   * expanded. Setting it adds a leading disclosure column. Return `null` for
   * no detail row.
   */
  renderDetail?: (row: Row) => ReactNode;
  /** Which rows offer the disclosure. Default: every row. */
  rowExpandable?: (row: Row) => boolean;
  /** Expanded row ids, controlled. Pair with `onExpandedChange`. */
  expandedIds?: ReadonlySet<string>;
  /** Initially expanded row ids when uncontrolled. */
  defaultExpandedIds?: Iterable<string>;
  /** Called with the next expanded set when a disclosure toggles. */
  onExpandedChange?: (ids: ReadonlySet<string>) => void;
}

type SortState = { columnId: string; direction: 'asc' | 'desc' } | null;

const INTERACTIVE = 'a[href], button, input, select, textarea, label, summary, [role="button"], [contenteditable="true"]';

/** Did this event start on a control inside the row rather than on the row itself? */
function fromControl(e: MouseEvent | KeyboardEvent): boolean {
  const target = e.target as Element | null;
  const hit = target?.closest?.(INTERACTIVE);
  return !!hit && e.currentTarget.contains(hit);
}

/**
 * Sortable table for inspector-style data. Rows are keyed by `id`. Clicking a
 * sortable header cycles ascending, descending, unsorted; nullish values sort
 * last regardless of direction. Passing `onReorder` adds a leading drag-handle
 * column — note that the drag indices it reports are into the *sorted* row
 * order, not the input order.
 */
export function DataGrid<Row extends { id: string }>(props: DataGridProps<Row>) {
  const {
    rows, columns, defaultSort, onReorder, empty = '—', className,
    rowClassName, onRowClick, renderDetail, rowExpandable, expandedIds, defaultExpandedIds, onExpandedChange,
  } = props;
  const [sort, setSort] = useState<SortState>(defaultSort ?? null);
  const [ownExpanded, setOwnExpanded] = useState<ReadonlySet<string>>(() => new Set(defaultExpandedIds));
  const expanded = expandedIds ?? ownExpanded;
  const detailIdBase = useId();

  const toggleExpanded = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (!expandedIds) setOwnExpanded(next);
    onExpandedChange?.(next);
  };

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
    rowSelector: ':not([data-detail-of])',
  });
  const dragEnabled = !!onReorder;
  const detailEnabled = !!renderDetail;
  const colCount = columns.length + (dragEnabled ? 1 : 0) + (detailEnabled ? 1 : 0);

  const cls = [s.grid, className].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
    >
      <table className={s.table}>
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
                  className={[col.className, active ? s.sortActive : ''].filter(Boolean).join(' ')}
                  aria-sort={sortable ? (active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                >
                  {sortable ? (
                    <button type="button" className={s.sortButton} onClick={() => cycleSort(col.id)}>
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
        <tbody ref={dragEnabled ? (drag.containerProps.ref as React.RefCallback<HTMLTableSectionElement>) : undefined}>
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={colCount} className={s.empty}>
                {empty}
              </td>
            </tr>
          )}
          {sortedRows.map((row, i) => {
            const isDragging = drag.state.draggedIds?.includes(row.id) ?? false;
            const target = drag.state.targetIndex;
            const expandable = detailEnabled && (rowExpandable?.(row) ?? true);
            const isExpanded = expandable && expanded.has(row.id);
            const detail = isExpanded ? renderDetail!(row) : null;
            const detailId = `${detailIdBase}-detail-${row.id}`;
            const rowCls = [
              onRowClick && s.clickable,
              isDragging && s.dragging,
              target === i && s.dropBefore,
              target === sortedRows.length && i === sortedRows.length - 1 && s.dropAfter,
              rowClassName?.(row),
            ].filter(Boolean).join(' ');
            return (
              <Fragment key={row.id}>
                <tr
                  className={rowCls || undefined}
                  data-expanded={isExpanded || undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? (e) => { if (!fromControl(e)) onRowClick(row); } : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                    e.preventDefault();
                    onRowClick(row);
                  } : undefined}
                >
                  {dragEnabled && (
                    <td
                      className={s.handleCell}
                      onPointerDown={(e) => drag.rowProps(row.id, i).onPointerDown(e)}
                    >
                      <span aria-hidden="true">⋮⋮</span>
                    </td>
                  )}
                  {detailEnabled && (
                    <td className={s.detailCell}>
                      {expandable && (
                        <Disclosure
                          open={isExpanded}
                          onToggle={() => toggleExpanded(row.id)}
                          label={isExpanded ? 'Hide details' : 'Show details'}
                          controls={detail != null ? detailId : undefined}
                        />
                      )}
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
                {detail != null && (
                  <tr id={detailId} className={s.detailRow} data-detail-of={row.id}>
                    <td colSpan={colCount}>{detail}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
