import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { getOwn } from '@weasel-js/registry';
import { PropertyHelp } from '@weasel-js/ui/components/Properties';
import type { ReactElement } from 'react';
import { configValueAt } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { isRowEnabled } from '../config/visible';
import type { ControlMatrixColumn, ControlMatrixRow } from './ControlMatrix';
import type { OpenCell } from './MatrixEditor';
import { columnNameOf } from './MatrixHeads';
import { MatrixSlot } from './MatrixSlot';
import type { MatrixTarget } from './matrixTarget';

/** A row as drawn: its cells, one per column, and what its label says. */
export interface RowSpec {
  row: ControlMatrixRow;
  cells: (MatrixTarget | undefined)[];
  label: string;
  about: string | undefined;
}

/** The rows a matrix draws: a setting no column shows has no row; one no column has keeps its row of dashes. */
export function rowSpecsOf(
  rows: readonly ControlMatrixRow[],
  columns: readonly ControlMatrixColumn[],
  cellAt: (path: string) => MatrixTarget | undefined,
  visible: (path: string) => boolean,
): RowSpec[] {
  return rows
    .map((row) => {
      const cells = columns.map((column) => cellAt(`${column.key}.${row.key}`));
      const named = cells.find((cell) => cell !== undefined)?.leaf;
      return {
        row,
        cells,
        label: row.label ?? named?.name ?? row.key,
        about: named?.description,
      };
    })
    .filter(
      ({ row, cells }) =>
        cells.every((cell) => cell === undefined) ||
        cells.some((cell, i) => cell !== undefined && visible(`${columns[i]?.key}.${row.key}`)),
    );
}

/** What every row of one matrix reads: the schema and values, and how inheritance is drawn. */
export interface MatrixRowScope {
  columns: readonly ControlMatrixColumn[];
  schema: ResolvedConfig;
  over: PrefGroup | PrefSection | undefined;
  config: Record<string, unknown>;
  auto: ReadonlySet<string>;
  inherit: boolean;
  setConfig: (path: string, value: unknown) => void;
  visible: (path: string) => boolean;
  hintFor: (column: ControlMatrixColumn) => string;
  /** A cell was pressed: open its editor, hung off `el`. */
  onOpen: (el: HTMLElement, open: OpenCell) => void;
}

/** One setting across every column: its label, then a slot per column. */
export function MatrixRow({ spec, scope }: { spec: RowSpec; scope: MatrixRowScope }) {
  const { row, cells, label, about } = spec;
  const { columns, schema, over, config, auto, inherit } = scope;
  return (
    <tr>
      <RowLabel label={label} about={about} />
      {columns.map((column, i) => {
        const path = `${column.key}.${row.key}`;
        const cell = cells[i];
        const first = inherit && i === 0;
        const inherited = inherit && !first && cell?.own === true && auto.has(path);
        return (
          <MatrixSlot
            key={column.key}
            cell={cell}
            shown={scope.visible(path)}
            value={cell && configValueAt(config, cell.at)}
            name={`${columnNameOf(column)} ${label}`}
            absent={`${columnNameOf(column)} has no ${label}`}
            inherited={inherited}
            hint={inherited ? scope.hintFor(column) : undefined}
            canUnpin={inherit && !first && !inherited}
            summary={row.summary ?? (cell && getOwn(schema.dialogs, cell.at)?.summary)}
            disabled={!isRowEnabled(schema, path, config, over)}
            setConfig={scope.setConfig}
            onOpen={(el) => {
              if (cell) scope.onOpen(el, { path, leaf: cell.node, column, first, label, cell });
            }}
          />
        );
      })}
    </tr>
  );
}

/** A row's name, its `about` shown in a tooltip when the name is hovered or the row's first control has focus. */
function RowLabel({ label, about }: { label: string; about: string | undefined }): ReactElement {
  const text = <span className="lk-control-matrix__label-text">{label}</span>;
  return (
    <th scope="row" className="lk-control-matrix__label">
      {about ? (
        <PropertyHelp label={label} description={about} within="tr">
          {text}
        </PropertyHelp>
      ) : (
        text
      )}
    </th>
  );
}
