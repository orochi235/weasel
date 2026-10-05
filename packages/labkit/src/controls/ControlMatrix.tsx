import { getAlpha01, isBuiltinToolPref, toHex8, withAlpha01 } from '@weasel-js/core';
import {
  Button,
  Focusable,
  isPrefLeaf,
  type PrefLeaf,
  type PropertyControlProps,
  PropertyField,
  PropertyHelp,
  PropertyList,
  PropertyPanel,
  prefFieldProps,
  type StanceProps,
  Tooltip,
  TooltipTrigger,
  useOverlayPortal,
} from '@weasel-js/ui';
import {
  type CSSProperties,
  type DOMAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useRef,
  useState,
} from 'react';
import { Dialog as RACDialog, Popover as RACPopover } from 'react-aria-components';
import { auto as autoValue } from '../config/auto';
import { schemaNodeAtPath, valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { ControlRow } from './ControlPanel';
import { summarizeValue } from './inDialog';

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

export interface ControlMatrixProps extends StanceProps {
  /** Heads the matrix. With `title`, `stance` or `tone` given it sits in a
   *  `<PropertyPanel>`, as a `ControlPanel` does. */
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

const NO_AUTO: ReadonlySet<string> = new Set();
const noop = (): void => {};

const nameOf = (column: ControlMatrixColumn): string => column.title ?? column.label;

/** The open popover: which cell, and the element it hangs off. */
interface OpenCell {
  path: string;
  leaf: PrefLeaf;
  column: ControlMatrixColumn;
  first: boolean;
  label: string;
}

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
}: ControlMatrixProps): ReactElement {
  const fallback = columns[0];
  const hintFor =
    inheritHint ?? ((_: ControlMatrixColumn) => (fallback ? `from ${nameOf(fallback)}` : ''));
  const [open, setOpen] = useState<OpenCell | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { anchor, portalProps } = useOverlayPortal();

  const leafAt = (path: string): PrefLeaf | undefined => {
    const node = schemaNodeAtPath(schema.group, path);
    return node && isPrefLeaf(node) ? node : undefined;
  };

  const rowSpecs = rows.map((row) => {
    const leaves = columns.map((column) => leafAt(`${column.key}.${row.key}`));
    const named = leaves.find((leaf) => leaf !== undefined);
    return { row, leaves, label: row.label ?? named?.name ?? row.key, about: named?.description };
  });

  const table = (
    <div className={className ? `lk-control-matrix ${className}` : 'lk-control-matrix'}>
      {anchor}
      <table className="lk-control-matrix__table">
        <thead>
          <tr>
            <td className="lk-control-matrix__corner" />
            {columns.map((column, i) => (
              <th
                key={column.key}
                scope="col"
                className={i === 0 ? 'lk-control-matrix__head is-first' : 'lk-control-matrix__head'}
              >
                <ColumnHeader column={column} onClick={onColumnClick} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowSpecs.map(({ row, leaves, label, about }) => (
            <tr key={row.key}>
              <th scope="row" className="lk-control-matrix__label">
                <span className="lk-control-matrix__label-text">{label}</span>
                {about ? <PropertyHelp label={label} description={about} /> : null}
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
                    <Cell
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
              <Editor
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
    </div>
  );

  if (title === undefined && stance === undefined && tone === undefined) return table;
  return (
    <PropertyPanel title={title} stance={stance} tone={tone}>
      {table}
    </PropertyPanel>
  );
}

/**
 * The control a cell opens. An enum lists its options outright, as radios: the
 * panel's dropdown would be a second popup opened from inside this one.
 * Choosing one is the whole edit, so it closes the popover.
 */
function Editor({
  open,
  schema,
  config,
  setConfig,
  close,
}: {
  open: OpenCell;
  schema: ResolvedConfig;
  config: Record<string, unknown>;
  setConfig: (path: string, value: unknown) => void;
  close: () => void;
}) {
  const { path, leaf } = open;
  const field = isBuiltinToolPref(leaf)
    ? prefFieldProps(leaf, {
        value: valueAtPath(config, path) ?? leaf.default,
        setValue: (next) => setConfig(path, next),
      })
    : null;
  if (field?.kind === 'enum') {
    return (
      <PropertyField
        {...field}
        label={leaf.name}
        control="radio"
        onChange={(next: Parameters<typeof field.onChange>[0]) => {
          field.onChange(next);
          close();
        }}
      />
    );
  }
  return (
    <ControlRow
      path={path}
      leaf={leaf}
      resolved={schema}
      config={config}
      shown={config}
      setConfig={setConfig}
      pack="one-up"
      auto={NO_AUTO}
      setRowAuto={noop}
    />
  );
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

/** A color leaf whose default is empty: unset is a value of its own, not black. */
const clearable = (leaf: PrefLeaf): boolean => leaf.kind === 'color' && leaf.default === '';

/** The number of decimals a step implies: `0.05` shows two, `1` none. */
function decimalsOf(step: number | undefined): number {
  if (step === undefined || !Number.isFinite(step) || step <= 0) return 0;
  const text = String(step);
  const exp = /e-(\d+)$/.exec(text);
  if (exp) return Number(exp[1]);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** What a cell shows of a value it opens a popover to edit. */
function summaryOf(field: PropertyControlProps | null, value: unknown): ReactNode {
  if (field?.kind === 'number') {
    return typeof field.value === 'number' ? field.value.toFixed(decimalsOf(field.step)) : '—';
  }
  if (field?.kind === 'enum') {
    const option = field.options.find((o) => o.value === field.value);
    if (!option) return '—';
    return typeof option.glyph === 'string' ? option.glyph : option.label;
  }
  if (field?.kind === 'string') return field.value || '—';
  return summarizeValue(value);
}

function Cell({
  path,
  leaf,
  value,
  name,
  hint,
  canUnpin,
  setConfig,
  onOpen,
}: {
  path: string;
  leaf: PrefLeaf;
  value: unknown;
  /** The cell's accessible name: column and row. */
  name: string;
  /** Present while the cell inherits: where from. */
  hint?: string;
  canUnpin: boolean;
  setConfig: (path: string, value: unknown) => void;
  onOpen: (el: HTMLElement) => void;
}) {
  const shown = value ?? leaf.default;
  const write = (next: unknown): void => setConfig(path, next);
  const field = isBuiltinToolPref(leaf)
    ? prefFieldProps(leaf, { value: shown, setValue: write })
    : null;
  const label = hint ? `${name}, ${hint}` : name;

  // Option/Alt-click hands a pinned cell back to the fallback, and does nothing
  // else on any cell — it must not also flip or open what it lands on.
  const unpinned = (e: MouseEvent): boolean => {
    if (!e.altKey) return false;
    e.preventDefault();
    if (canUnpin) setConfig(path, autoValue);
    return true;
  };

  // The shape `Focusable` asks of the element it makes a tooltip trigger.
  let control: ReactElement<DOMAttributes<HTMLElement>, string>;
  if (field?.kind === 'boolean') {
    const on = field.value === true;
    control = (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="lk-control-matrix__switch"
        onClick={(e) => {
          if (!unpinned(e)) field.onChange(!on);
        }}
      >
        <span className="lk-control-matrix__track" aria-hidden="true">
          <span className="lk-control-matrix__thumb" />
        </span>
      </button>
    );
  } else if (field?.kind === 'color' && !clearable(leaf)) {
    const stored =
      typeof field.value === 'string' && field.value !== '' ? toHex8(field.value) : '#000000ff';
    control = (
      <input
        type="color"
        aria-label={label}
        className="lk-control-matrix__swatch"
        value={stored.slice(0, 7)}
        onClick={(e) => {
          unpinned(e);
        }}
        onChange={(e) => {
          const rgb = e.currentTarget.value;
          field.onChange(field.alpha ? withAlpha01(rgb, getAlpha01(stored)) : rgb);
        }}
      />
    );
  } else if (field?.kind === 'color') {
    // A color that may be unset opens the popover, which is the only place it can be cleared.
    const set = typeof field.value === 'string' && field.value !== '';
    control = (
      <button
        type="button"
        aria-label={set ? label : `${label}, unset`}
        aria-haspopup="dialog"
        className="lk-control-matrix__value"
        onClick={(e) => {
          if (!unpinned(e)) onOpen(e.currentTarget);
        }}
      >
        <span
          className={set ? 'lk-control-matrix__chip' : 'lk-control-matrix__chip is-unset'}
          style={set ? ({ '--lk-chip': field.value } as CSSProperties) : undefined}
          aria-hidden="true"
        />
      </button>
    );
  } else {
    const valueClass =
      field?.kind === 'number' ? 'lk-control-matrix__value is-number' : 'lk-control-matrix__value';
    control = (
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        className={valueClass}
        onClick={(e) => {
          if (!unpinned(e)) onOpen(e.currentTarget);
        }}
      >
        {summaryOf(field, shown)}
      </button>
    );
  }

  if (!hint) return control;
  return (
    <TooltipTrigger>
      <Focusable>{control}</Focusable>
      <Tooltip>{hint}</Tooltip>
    </TooltipTrigger>
  );
}
