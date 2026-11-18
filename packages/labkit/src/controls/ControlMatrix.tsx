import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import type { AppearanceProps } from '@weasel-js/ui/appearance';
import {
  type CollapseProps,
  PropertyPanel,
  useCollapse,
} from '@weasel-js/ui/components/Properties';
import { useOverlayPortal } from '@weasel-js/ui/portal-host';
import { type ReactElement, type ReactNode, useRef, useState } from 'react';
import type { ResolvedConfig } from '../config/types';
import { aliasTargetsOf, isRowVisible } from '../config/visible';
import { FieldChoicesContext, useFieldChoicesOf } from './fieldChoices';
import type { OpenCell } from './MatrixEditor';
import { ColumnHeader, ColumnHeads, columnNameOf, headClassFor } from './MatrixHeads';
import { MatrixPopover } from './MatrixPopover';
import { MatrixRow, type MatrixRowScope, rowSpecsOf } from './MatrixRow';
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
export interface ControlMatrixProps extends AppearanceProps, CollapseProps {
  /** Heads the matrix. With `title`, any appearance prop given, or with any of
   *  the fold props, it sits in a `<PropertyPanel>`, as a `ControlPanel` does.
   *  A titled matrix draws its column headers in the panel's title row, over
   *  their columns, and a folded one draws only the title. */
  title?: ReactNode;
  /** The whole resolved schema. A cell's leaf is looked up at
   *  `${column.key}.${row.key}`; a cell with none draws a dash. */
  schema: ResolvedConfig;
  /** The schema the matrix's aliases point into, and its conditions may read, when that is not `schema`
   *  itself: a matrix drawn from a layout over a dialog's settings. Its values are read from `config` at
   *  their own paths. Defaults to the schema's own `over`. */
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

const NO_AUTO: ReadonlySet<string> = new Set();
const firstColumnHint =
  (fallback: ControlMatrixColumn | undefined) =>
  (_: ControlMatrixColumn): string =>
    fallback ? `from ${columnNameOf(fallback)}` : '';

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
  schema,
  over = schema.over,
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
  ...appearance
}: ControlMatrixProps): ReactElement {
  const hintFor = inheritHint ?? firstColumnHint(columns[0]);
  const [open, setOpen] = useState<OpenCell | null>(null);
  const choices = useFieldChoicesOf(schema.group);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { anchor, provide, ready } = useOverlayPortal();

  const targets = aliasTargetsOf(schema, config, over);
  const cellAt = (path: string): MatrixTarget | undefined => matrixTargetAt(schema, path, targets);

  // A row is named in `rows`, so a leaf's static `hidden` does not drop it; a `showIf` does.
  const visible = (path: string): boolean => isRowVisible(schema, path, config, true, over);
  const scope: MatrixRowScope = {
    columns,
    schema,
    over,
    config,
    auto,
    inherit,
    setConfig,
    visible,
    hintFor,
    onOpen: (el, cell) => {
      triggerRef.current = el;
      setOpen(cell);
    },
  };

  // With a title row to sit in, the headers leave the table for it.
  const lifted = title !== undefined;
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
              <th key={column.key} scope="col" className={headClassFor(i, inherit)}>
                {lifted ? (
                  columnNameOf(column)
                ) : (
                  <ColumnHeader column={column} onClick={onColumnClick} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowSpecsOf(rows, columns, cellAt, visible).map((spec) => (
            <MatrixRow key={spec.row.key} spec={spec} scope={scope} />
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

  return (
    <FieldChoicesContext.Provider value={choices}>
      <MatrixFrame
        title={title}
        appearance={appearance}
        fold={{ collapsible, defaultCollapsed, collapsed, onCollapsedChange, twisty }}
        heads={<ColumnHeads columns={columns} inherit={inherit} onClick={onColumnClick} />}
      >
        {table}
      </MatrixFrame>
    </FieldChoicesContext.Provider>
  );
}

/** The table on its own, or in a `<PropertyPanel>` when it has a title, an appearance or a fold. A titled
 *  panel carries the column headers in its title row while it is open. */
function MatrixFrame({
  title,
  appearance,
  fold: foldProps,
  heads,
  children,
}: {
  title: ReactNode;
  appearance: AppearanceProps;
  fold: CollapseProps;
  heads: ReactNode;
  children: ReactElement;
}): ReactElement {
  const fold = useCollapse(foldProps);
  if (
    title === undefined &&
    !Object.values(appearance).some((v) => v !== undefined) &&
    !fold.folds
  ) {
    return children;
  }
  return (
    <PropertyPanel
      className="lk-control-matrix-panel"
      title={title}
      actions={title !== undefined && !fold.folded ? heads : undefined}
      {...appearance}
      {...(fold.folds
        ? {
            collapsible: true,
            collapsed: fold.folded,
            onCollapsedChange: fold.toggle,
            twisty: foldProps.twisty,
          }
        : {})}
    >
      {children}
    </PropertyPanel>
  );
}
