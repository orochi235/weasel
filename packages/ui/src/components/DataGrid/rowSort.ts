import { getOwn } from '@weasel-js/registry';
import type { DataGridColumn } from './DataGrid';

export type SortState = { columnId: string; direction: 'asc' | 'desc' } | null;

type CellValue = string | number | null | undefined;

/** How `col` reads a row's value: its `accessor`, else the row's property named by its id. */
export const valueOf = <Row,>(col: DataGridColumn<Row>): ((row: Row) => CellValue) =>
  col.accessor ?? ((row: Row) => getOwn(row as unknown as Record<string, unknown>, col.id) as CellValue);

/** Nullish or NaN: a value sorting cannot place, which goes last either way. */
const unplaced = (v: CellValue): v is null | undefined => v == null || Number.isNaN(v);

/** `rows` in `sort`'s order, a copy either way; input order with no sort or no such column. */
export function sortedRows<Row>(rows: readonly Row[], columns: readonly DataGridColumn<Row>[], sort: SortState): Row[] {
  if (!sort) return [...rows];
  const col = columns.find((c) => c.id === sort.columnId);
  if (!col) return [...rows];
  const get = valueOf(col);
  const dir = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    if (unplaced(av) && unplaced(bv)) return 0;
    if (unplaced(av)) return 1;
    if (unplaced(bv)) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

/** The sort after a click on `columnId`'s header: ascending, then descending, then none. */
export function nextSort(cur: SortState, columnId: string): SortState {
  if (!cur || cur.columnId !== columnId) return { columnId, direction: 'asc' };
  if (cur.direction === 'asc') return { columnId, direction: 'desc' };
  return null;
}
