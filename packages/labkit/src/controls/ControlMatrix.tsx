import { isPrefLeaf, type PrefLeaf } from '@weasel-js/prefs';
import {
  Button,
  type CollapseProps,
  Focusable,
  PropertyHelp,
  PropertyList,
  PropertyPanel,
  type StanceProps,
  Tooltip,
  TooltipTrigger,
  useCollapse,
  useOverlayPortal,
} from '@weasel-js/ui';
import { type ReactElement, type ReactNode, useRef, useState } from 'react';
import { Dialog as RACDialog, Popover as RACPopover } from 'react-aria-components';
import { auto as autoValue } from '../config/auto';
import { schemaNodeAtPath, valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { FieldChoicesContext, useFieldChoicesOf } from './fieldChoices';
import { clearable, MatrixCell } from './MatrixCell';
import { MatrixEditor, type OpenCell } from './MatrixEditor';

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
  /** The scopes. The first is the fallback the others inherit from: its cells
   *  never inherit, and its header is emphasized. */
  columns: readonly ControlMatrixColumn[];
  rows: readonly ControlMatrixRow[];
  /** Values to show, already resolved: an inherited cell's value is the one it
   *  inherits. */
  config: Record<string, unknown>;
  /** Full dotted paths whose cells inherit, drawn ghosted. */
  auto: ReadonlySet<string>;
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
  columns,
  rows,
  config,
  auto,
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
  const fallback = columns[0];
  const hintFor =
    inheritHint ?? ((_: ControlMatrixColumn) => (fallback ? `from ${nameOf(fallback)}` : ''));
  const [open, setOpen] = useState<OpenCell | null>(null);
  const choices = useFieldChoicesOf(schema.group);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { anchor, portalProps, ready } = useOverlayPortal();

  const leafAt = (path: string): PrefLeaf | undefined => {
    const node = schemaNodeAtPath(schema.group, path);
    return node && isPrefLeaf(node) ? node : undefined;
  };

  const rowSpecs = rows.map((row) => {
    const leaves = columns.map((column) => leafAt(`${column.key}.${row.key}`));
    const named = leaves.find((leaf) => leaf !== undefined);
    return { row, leaves, label: row.label ?? named?.name ?? row.key, about: named?.description };
  });

  const fold = useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange, twisty });
  // With a title row to sit in, the headers leave the table for it.
  const lifted = title !== undefined;
  const headClass = (i: number): string =>
    i === 0 ? 'lk-control-matrix__head is-first' : 'lk-control-matrix__head';
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
          {rowSpecs.map(({ row, leaves, label, about }) => (
            <tr key={row.key}>
              <th scope="row" className="lk-control-matrix__label">
                <span className="lk-control-matrix__label-text">{label}</span>
                {about ? <PropertyHelp label={label} description={about} within="tr" /> : null}
              </th>
              {columns.map((column, i) => {
                const path = `${column.key}.${row.key}`;
                const leaf = leaves[i];
                if (!leaf) {
                  return (
                    <td key={column.key} className="lk-control-matrix__cell is-missing">
                      <span role="img" aria-label={`${nameOf(column)} has no ${label}`}>
                        —
                      </span>
                    </td>
                  );
                }
                const first = i === 0;
                const inherited = !first && auto.has(path);
                return (
                  <td
                    key={column.key}
                    className={
                      inherited ? 'lk-control-matrix__cell is-inherited' : 'lk-control-matrix__cell'
                    }
                  >
                    <MatrixCell
                      path={path}
                      leaf={leaf}
                      value={valueAtPath(config, path)}
                      name={`${nameOf(column)} ${label}`}
                      hint={inherited ? hintFor(column) : undefined}
                      canUnpin={!first && !inherited}
                      setConfig={setConfig}
                      onOpen={(el) => {
                        triggerRef.current = el;
                        setOpen({ path, leaf, column, first, label });
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {ready && (
        <RACPopover
          triggerRef={triggerRef}
          isOpen={open !== null}
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          placement="bottom"
          className="lk-control-matrix__popover"
          data-weasel-overlay=""
          {...portalProps}
        >
          {open ? (
            <RACDialog
              className="lk-control-matrix__editor"
              aria-label={`${nameOf(open.column)} ${open.label}`}
            >
              <PropertyList pack="one-up">
                <MatrixEditor
                  open={open}
                  schema={schema}
                  config={config}
                  setConfig={setConfig}
                  close={() => setOpen(null)}
                />
              </PropertyList>
              {clearable(open.leaf) ? (
                <div className="lk-control-matrix__editor-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!valueAtPath(config, open.path) || auto.has(open.path)}
                    onClick={() => setConfig(open.path, null)}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
              {open.first ? null : (
                <div className="lk-control-matrix__editor-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={auto.has(open.path)}
                    tooltip={`Inherit ${hintFor(open.column)}`}
                    onClick={() => setConfig(open.path, autoValue)}
                  >
                    Inherit
                  </Button>
                </div>
              )}
            </RACDialog>
          ) : null}
        </RACPopover>
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
