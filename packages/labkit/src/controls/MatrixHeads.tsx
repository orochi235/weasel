import { Focusable, Tooltip, TooltipTrigger } from '@weasel-js/ui/components/Tooltip';
import type { ReactElement } from 'react';
import type { ControlMatrixColumn } from './ControlMatrix';

/** A column's full name: its title, else its short label. */
export const columnNameOf = (column: ControlMatrixColumn): string => column.title ?? column.label;

/** A header's class: the fallback column's is emphasized. */
export const headClassFor = (i: number, inherit: boolean): string =>
  i === 0 && inherit ? 'lk-control-matrix__head is-first' : 'lk-control-matrix__head';

/** The column headers lifted out of the table into a panel's title row, over their columns. */
export function ColumnHeads({
  columns,
  inherit,
  onClick,
}: {
  columns: readonly ControlMatrixColumn[];
  inherit: boolean;
  onClick?: (column: ControlMatrixColumn) => void;
}): ReactElement {
  return (
    <div className="lk-control-matrix__heads">
      {columns.map((column, i) => (
        <span key={column.key} className={headClassFor(i, inherit)}>
          <ColumnHeader column={column} onClick={onClick} />
        </span>
      ))}
    </div>
  );
}

/** A column's header: its short label, a button when the column can be clicked. */
export function ColumnHeader({
  column,
  onClick,
}: {
  column: ControlMatrixColumn;
  onClick?: (column: ControlMatrixColumn) => void;
}) {
  const name = columnNameOf(column);
  if (!onClick) {
    return column.title && column.title !== column.label ? (
      <abbr title={column.title} className="lk-control-matrix__head-text">
        {column.label}
      </abbr>
    ) : (
      <span className="lk-control-matrix__head-text">{column.label}</span>
    );
  }
  return (
    <TooltipTrigger>
      <Focusable>
        <button
          type="button"
          className="lk-control-matrix__head-button"
          aria-label={name}
          onClick={() => onClick(column)}
        >
          {column.label}
        </button>
      </Focusable>
      <Tooltip>{name}</Tooltip>
    </TooltipTrigger>
  );
}
