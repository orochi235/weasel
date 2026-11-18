/**
 * Lightweight sortable data grid for inspector tables. Intentionally narrow.
 * Not: virtual scrolling, column resizing, multi-column sort, filtering,
 * inline editing.
 */
import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useReorderDragList } from '../../useReorderDragList';
import type { HoldProps } from '../Disabled';
import { useControlHold } from '../Disabled/controlHold';
import { nextSort, sortedRows, type SortState } from './rowSort';
import { DataGridHead } from './DataGridHead';
import { DataGridRow } from './DataGridRow';
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
  /** A column of figures: equal-width digits, aligned to the end so the column
   *  reads down. Header included, so its label sits over the numbers. */
  numeric?: boolean;
}

/**
 * Props for {@link DataGrid}. Disabled, by `disabled` or a scope, nothing sorts, expands, activates, or moves, and with
 * no reason anywhere the rows leave the tab order. Read-only, rows still sort, expand, and activate, since those only
 * look; nothing moves. Either way the controls in its cells are held with it.
 */
export interface DataGridProps<Row extends { id: string }> extends HoldProps {
  rows: readonly Row[];
  columns: readonly DataGridColumn<Row>[];
  /** Initial sort. Omit for unsorted (rows render in input order). */
  defaultSort?: { columnId: string; direction: 'asc' | 'desc' };
  /** Enable drag handles in a leading column. Receives the reorder spec
   *  (the existing `useReorderDragList` semantics — see weasel-ui). */
  onReorder?: (ids: string[], targetIndex: number) => void;
  /** What a row is called, for its drag handle's accessible name ("Drag to
   *  reorder <label>"). Without it a handle is named for the row's position. */
  rowLabel?: (row: Row) => string;
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

/**
 * Sortable table for inspector-style data. Rows are keyed by `id`. Clicking a
 * sortable header cycles ascending, descending, unsorted; nullish and NaN values sort
 * last regardless of direction. Passing `onReorder` adds a leading drag-handle
 * column — note that the drag indices it reports are into the *sorted* row
 * order, not the input order.
 */
export function DataGrid<Row extends { id: string }>(props: DataGridProps<Row>) {
  const {
    rows, columns, defaultSort, onReorder, rowLabel, empty = '—', className,
    rowClassName, renderDetail, rowExpandable, expandedIds, defaultExpandedIds, onExpandedChange,
  } = props;
  const hold = useControlHold(props, { readonlyRole: false });
  const onRowClick = hold.disabled ? undefined : props.onRowClick;
  const activates = !!props.onRowClick;
  const [sort, setSort] = useState<SortState>(defaultSort ?? null);
  const [expanded, toggleExpanded] = useExpanded(expandedIds, defaultExpandedIds, onExpandedChange);
  const detailIdBase = useId();

  const shownRows = useMemo(() => sortedRows(rows, columns, sort), [rows, columns, sort]);

  const cycleSort = (columnId: string) => {
    if (hold.disabled) return;
    setSort((cur) => nextSort(cur, columnId));
  };

  // `label` is unused: the hook only reads id and locked.
  const drag = useReorderDragList({
    items: shownRows.map((r) => ({ id: r.id, label: '' })),
    selectedIds: [],
    onReorder: onReorder ?? (() => {}),
    rowSelector: ':not([data-detail-of])',
  });
  const dragEnabled = !!onReorder;
  const detailEnabled = !!renderDetail;
  const colCount = columns.length + (dragEnabled ? 1 : 0) + (detailEnabled ? 1 : 0);

  const cls = [s.grid, className].filter(Boolean).join(' ');

  return hold.wrap(hold.scope(
    <div className={cls} data-held={hold.held}>
      <table className={s.table}>
        <DataGridHead
          columns={columns} sort={sort} onSort={cycleSort} dragEnabled={dragEnabled} detailEnabled={detailEnabled} hold={hold}
        />
        <tbody ref={dragEnabled ? (drag.containerProps.ref as React.RefCallback<HTMLTableSectionElement>) : undefined}>
          {shownRows.length === 0 && (
            <tr>
              <td colSpan={colCount} className={s.empty}>
                {empty}
              </td>
            </tr>
          )}
          {shownRows.map((row, i) => {
            const expandable = detailEnabled && (rowExpandable?.(row) ?? true);
            return (
              <DataGridRow
                key={row.id}
                row={row}
                index={i}
                rowCount={shownRows.length}
                columns={columns}
                colCount={colCount}
                hold={hold}
                drag={dragEnabled ? drag : undefined}
                rowLabel={rowLabel}
                rowClassName={rowClassName}
                activates={activates}
                onRowClick={onRowClick}
                detail={renderDetail && {
                  expandable,
                  expanded: expandable && expanded.has(row.id),
                  id: `${detailIdBase}-detail-${row.id}`,
                  render: renderDetail,
                  onToggle: () => toggleExpanded(row.id),
                }}
              />
            );
          })}
        </tbody>
      </table>
    </div>,
  ));
}

/** The expanded rows, held here unless `given` is, and a toggle of one that reports the next set either way. */
function useExpanded(
  given: ReadonlySet<string> | undefined,
  initial: Iterable<string> | undefined,
  onChange: ((ids: ReadonlySet<string>) => void) | undefined,
): [ReadonlySet<string>, (id: string) => void] {
  const [own, setOwn] = useState<ReadonlySet<string>>(() => new Set(initial));
  const expanded = given ?? own;
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (!given) setOwn(next);
    onChange?.(next);
  };
  return [expanded, toggle];
}
