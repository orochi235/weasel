import { type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { dropSide } from '@weasel-js/ui-input';
import type { ReorderDragHandlers } from '../../useReorderDragList';
import { Disclosure } from '../Disclosure';
import type { ControlHold } from '../Disabled/controlHold';
import { ReorderHandle, type ReorderHandleProps } from '../ReorderHandle/ReorderHandle';
import type { DataGridColumn } from './DataGrid';
import { valueOf } from './rowSort';
import s from './DataGrid.module.css';

const INTERACTIVE = 'a[href], button, input, select, textarea, label, summary, [role="button"], [contenteditable="true"]';

/** Did this event start on a control inside the row rather than on the row itself? */
function fromControl(e: MouseEvent | KeyboardEvent): boolean {
  const target = e.target as Element | null;
  const hit = target?.closest?.(INTERACTIVE);
  return !!hit && e.currentTarget.contains(hit);
}

/** A row's place in the disclosure column, on a grid that has one. */
export interface RowDetail<Row> {
  expandable: boolean;
  expanded: boolean;
  /** The detail row's id, which the disclosure controls. */
  id: string;
  render: (row: Row) => ReactNode;
  onToggle: () => void;
}

interface DataGridRowProps<Row> {
  row: Row;
  index: number;
  rowCount: number;
  columns: readonly DataGridColumn<Row>[];
  /** Every column the table draws, the leading ones included, which a full-width row spans. */
  colCount: number;
  hold: ControlHold;
  /** Present when rows reorder by drag. */
  drag?: ReorderDragHandlers;
  rowLabel?: (row: Row) => string;
  rowClassName?: (row: Row) => string | undefined;
  /** Rows take focus and activate; `onRowClick` is absent while held. */
  activates: boolean;
  onRowClick?: (row: Row) => void;
  detail?: RowDetail<Row>;
}

/** One data row of a grid, with its drag handle and disclosure cells where the grid has them, and the detail row under it while expanded. */
export function DataGridRow<Row extends { id: string }>(props: DataGridRowProps<Row>) {
  const { row, index: i, columns, colCount, hold, drag, activates, onRowClick, detail } = props;
  const isDragging = drag?.state.draggedIds?.includes(row.id) ?? false;
  const side = drag ? dropSide(drag.state.targetIndex, i, props.rowCount) : null;
  const isExpanded = !!detail?.expandable && detail.expanded;
  const content = isExpanded ? detail.render(row) : null;
  const rowCls = [
    activates && s.clickable,
    isDragging && s.dragging,
    side === 'before' && s.dropBefore,
    side === 'after' && s.dropAfter,
    props.rowClassName?.(row),
  ].filter(Boolean).join(' ');
  return (
    <>
      <tr
        className={rowCls || undefined}
        data-expanded={isExpanded || undefined}
        tabIndex={activates ? (hold.access.reachable ? 0 : -1) : undefined}
        {...(activates ? hold.focus : {})}
        onClick={onRowClick ? (e) => { if (!fromControl(e)) onRowClick(row); } : undefined}
        onKeyDown={onRowClick ? (e) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          onRowClick(row);
        } : undefined}
      >
        {drag && (
          <HandleCell
            label={props.rowLabel?.(row) ?? `row ${i + 1}`}
            onPointerDown={drag.rowProps(row.id, i).onPointerDown}
            onNudge={(delta) => drag.nudge(row.id, i, delta)}
            disabled={hold.refuses}
            disabledReason={hold.access.reason}
          />
        )}
        {detail && (
          <td className={s.detailCell}>
            {detail.expandable && (
              <Disclosure
                open={isExpanded}
                disabled={hold.disabled}
                onOpenChange={() => { if (!hold.disabled) detail.onToggle(); }}
                label={isExpanded ? 'Hide details' : 'Show details'}
                aria-controls={content != null ? detail.id : undefined}
              />
            )}
          </td>
        )}
        {columns.map((col) => {
          const cell = col.render ? col.render(row) : String(valueOf(col)(row) ?? '');
          return (
            <td key={col.id} className={[col.className, col.numeric && s.numeric].filter(Boolean).join(' ') || undefined}>
              {cell}
            </td>
          );
        })}
      </tr>
      {content != null && (
        <tr id={detail!.id} className={s.detailRow} data-detail-of={row.id}>
          <td colSpan={colCount}>{content}</td>
        </tr>
      )}
    </>
  );
}

/** A row's leading cell, holding its drag handle. */
function HandleCell(props: Pick<ReorderHandleProps, 'label' | 'onPointerDown' | 'onNudge' | 'disabled' | 'disabledReason'>) {
  return (
    <td className={s.handleCell}>
      <ReorderHandle className={s.handle} {...props} />
    </td>
  );
}
