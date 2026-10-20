import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { type CollapseProps, PropertyHelp, PropertyPanel, useCollapse } from '@weasel-js/ui/components/Properties';
import { Focusable, Tooltip, TooltipTrigger } from '@weasel-js/ui/components/Tooltip';
import { useOverlayPortal } from '@weasel-js/ui/portal-host';
import type { StanceProps } from '@weasel-js/ui/stance';
import { type ReactElement, type ReactNode, useRef, useState } from 'react';
import { valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { aliasTargetsOf, isLeafEnabled, isLeafVisible } from '../config/visible';
import { FieldChoicesContext, useFieldChoicesOf } from './fieldChoices';
import type { OpenCell } from './MatrixEditor';
import { MatrixPopover } from './MatrixPopover';
import { MatrixSlot } from './MatrixSlot';
import { type MatrixTarget, matrixTargetAt } from './matrixTarget';

/** One column of a {@link ControlMatrix}: a config group, every one the same shape. */
export interface ControlMatrixColumn {
  /** Config path prefix of this column's group, e.g. `'looks.window'`. */
  key: string;
  /** Short header shown at narrow width, e.g. `'Win'`. */
  label: string;
  /** Full name, for the header's tooltip and accessible name, e.g. `'Window'`. */
  title?: string;
}

/** One row of a {@link ControlMatrix}: a setting every column's group may hold. */
export interface ControlMatrixRow {
  /** Path of the setting inside each column's group, e.g. `'background'` or `'fill.colorBy'`. */
  key: string;
  /** Row label. Defaults to the leaf's own name from the schema. */
  label?: string;
  /** What a cell of this row shows of its value. Defaults to the summary the leaf's `.dialog` declares, and
   *  else to the built-in reading of its kind: for a custom leaf, which has none. */
  summary?: (value: unknown) => ReactNode;
}

/** Props for `ControlMatrix`. */
export interface ControlMatrixProps extends StanceProps, CollapseProps {
  /** Heads the matrix. With `title`, `stance` or `tone` given, or with any of
   *  the fold props, it sits in a `<PropertyPanel>`, as a `ControlPanel` does.
   *  A titled matrix draws its column headers in the panel's title row, over
   *  their columns, and a folded one draws only the title. */
  title?: ReactNode;
  /** The whole resolved schema. A cell's leaf is looked up at
   *  `${column.key}.${row.key}`; a cell with none draws a dash. */
  schema: ResolvedConfig;
  /** The schema the matrix's aliases point into, and its conditions may read, when that is not `schema`
   *  itself: a matrix drawn from a layout over a dialog's settings. Its values are read from `config` at
   *  their own paths. */
  over?: PrefGroup | PrefSection;
  /** The scopes. Unless `inherit` is false, the first is the fallback the others inherit from: its cells
   *  never inherit, and its header is emphasized. */
  columns: readonly ControlMatrixColumn[];
  rows: readonly ControlMatrixRow[];
  /** Values to show, already resolved: an inherited cell's value is the one it
   *  inherits. */
  config: Record<string, unknown>;
  /** Full dotted paths whose cells inherit, drawn ghosted. */
  auto?: ReadonlySet<string>;
  /** Cells inherit from the first column until they are pinned. `false` makes a plain grid: no column is
   *  a fallback, no cell inherits, and none can be unpinned. Default `true`. */
  inherit?: boolean;
  /** Writes a value, which pins the cell, or labkit's `auto` sentinel, which
   *  unpins it. */
  setConfig: (path: string, value: unknown) => void;
  /** Clicking a column header. Without it the headers are plain text. */
  onColumnClick?: (column: ControlMatrixColumn) => void;
  /** What an inherited cell's tooltip says. Defaults to `from <first column>`. */
  inheritHint?: (column: ControlMatrixColumn) => string;
  className?: string;
}

const nameOf = (column: ControlMatrixColumn): string => column.title ?? column.label;
const NO_AUTO: ReadonlySet<string> = new Set();
const firstColumnHint =
  (fallback: ControlMatrixColumn | undefined) =>
  (_: ControlMatrixColumn): string =>
    fallback ? `from ${nameOf(fallback)}` : '';

/**
 * One setting across several config groups of the same shape: settings down
 * the side, scopes across the top, a compact read-only cell at each crossing.
 * A cell inherits from the first column until it is pinned; inherited cells
 * draw ghosted. Click a cell to edit it with the control a `ControlPanel` would
 * draw (a boolean flips and a color opens its picker in place); editing pins,
 * and the popover's Inherit button — or Option/Alt-click on the cell — unpins.
 */
export function ControlMatrix({
  title,
  stance,
  tone,
  schema,
  over,
  columns,
  rows,
  config,
  auto = NO_AUTO,
  inherit = true,
  setConfig,
  onColumnClick,
  inheritHint,
  className,
  collapsible,
  defaultCollapsed,
  collapsed,
  onCollapsedChange,
  twisty,
}: ControlMatrixProps): ReactElement {
  const hintFor = inheritHint ?? firstColumnHint(columns[0]);
  const [open, setOpen] = useState<OpenCell | null>(null);
  const choices = useFieldChoicesOf(schema.group);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { anchor, provide, ready } = useOverlayPortal();

  const targets = aliasTargetsOf(schema, config, over);
  const cellAt = (path: string): MatrixTarget | undefined => matrixTargetAt(schema, path, targets);

  // A row is named in `rows`, so a leaf's static `hidden` does not drop it; a `showIf` does.
  const visible = (path: string): boolean => isLeafVisible(schema, path, config, true, over);
  const rowSpecs = rows
    .map((row) => {
      const cells = columns.map((column) => cellAt(`${column.key}.${row.key}`));
      const named = cells.find((cell) => cell !== undefined)?.leaf;
      return { row, cells, label: row.label ?? named?.name ?? row.key, about: named?.description };
    })
    // A setting no column shows has no row; one no column has keeps its row of dashes.
    .filter(
      ({ row, cells }) =>
        cells.every((cell) => cell === undefined) ||
        cells.some((cell, i) => cell !== undefined && visible(`${columns[i]?.key}.${row.key}`)),
    );

  const fold = useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange, twisty });
  // With a title row to sit in, the headers leave the table for it.
  const lifted = title !== undefined;
  const headClass = (i: number): string =>
    i === 0 && inherit ? 'lk-control-matrix__head is-first' : 'lk-control-matrix__head';
  const heads = (
    <div className="lk-control-matrix__heads">
      {columns.map((column, i) => (
        <span key={column.key} className={headClass(i)}>
          <ColumnHeader column={column} onClick={onColumnClick} />
        </span>
      ))}
    </div>
  );

  const table = (
    <div className={className ? `lk-control-matrix ${className}` : 'lk-control-matrix'}>
      {anchor}
      <table className="lk-control-matrix__table">
        {/* A lifted header row stays, drawn at no height: it still sizes the
            columns and names them for a screen reader. */}
        <thead className={lifted ? 'is-lifted' : undefined}>
          <tr>
            <td className="lk-control-matrix__corner" />
            {columns.map((column, i) => (
              <th key={column.key} scope="col" className={headClass(i)}>
                {lifted ? nameOf(column) : <ColumnHeader column={column} onClick={onColumnClick} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowSpecs.map(({ row, cells, label, about }) => (
            <tr key={row.key}>
              <th scope="row" className="lk-control-matrix__label">
                <span className="lk-control-matrix__label-text">{label}</span>
                {about ? <PropertyHelp label={label} description={about} within="tr" /> : null}
              </th>
              {columns.map((column, i) => {
                const path = `${column.key}.${row.key}`;
                const cell = cells[i];
                const first = inherit && i === 0;
                const inherited = inherit && !first && cell?.own === true && auto.has(path);
                return (
                  <MatrixSlot
                    key={column.key}
                    cell={cell}
                    shown={visible(path)}
                    value={cell && valueAtPath(config, cell.at)}
                    name={`${nameOf(column)} ${label}`}
                    absent={`${nameOf(column)} has no ${label}`}
                    inherited={inherited}
                    hint={inherited ? hintFor(column) : undefined}
                    canUnpin={inherit && !first && !inherited}
                    summary={row.summary ?? (cell && schema.dialogs[cell.at]?.summary)}
                    disabled={!isLeafEnabled(schema, path, config, over)}
                    setConfig={setConfig}
                    onOpen={(el) => {
                      triggerRef.current = el;
                      if (cell) setOpen({ path, leaf: cell.node, column, first, label, cell });
                    }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {ready && (
        <MatrixPopover
          open={open}
          close={() => setOpen(null)}
          triggerRef={triggerRef}
          provide={provide}
          schema={schema}
          over={over}
          config={config}
          auto={auto}
          setConfig={setConfig}
          inherit={inherit}
          inheritHint={(cell) => hintFor(cell.column)}
        />
      )}
    </div>
  );

  const panel =
    title === undefined && stance === undefined && tone === undefined && !fold.folds ? (
      table
    ) : (
      <PropertyPanel
        className="lk-control-matrix-panel"
        title={title}
        actions={lifted && !fold.folded ? heads : undefined}
        stance={stance}
        tone={tone}
        {...(fold.folds
          ? { collapsible: true, collapsed: fold.folded, onCollapsedChange: fold.toggle, twisty }
          : {})}
      >
        {table}
      </PropertyPanel>
    );
  return <FieldChoicesContext.Provider value={choices}>{panel}</FieldChoicesContext.Provider>;
}

function ColumnHeader({
  column,
  onClick,
}: {
  column: ControlMatrixColumn;
  onClick?: (column: ControlMatrixColumn) => void;
}) {
  const name = nameOf(column);
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
