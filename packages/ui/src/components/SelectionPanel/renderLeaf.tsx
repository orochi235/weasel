/**
 * A selection's leaves as cells: one `ToolPrefLeaf` and its aggregated value
 * in, one rendered cell out, plus the run logic that turns a row of paired
 * toggles into a single segmented bar and the rows of an object leaf.
 *
 * The control itself is `PropertyControl`'s, through `prefFieldProps`; what
 * is decided here is how a selection surface sizes and composes it.
 * `ToolOptionsBar` renders a tool's options through the same functions.
 */
import { Fragment, type ReactNode } from 'react';
import type {
  ToolPrefBoolean,
  ToolPrefGroup,
  ToolPrefLeaf,
  ToolPrefObject,
} from '@weasel-js/core';
import { prefFieldProps } from '../Prefs/prefField';
import { PropertyControl } from '../Properties/PropertyField';
import { ToggleBar } from '../ToggleBar';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import s from './SelectionPanel.module.css';


/** What a {@link PropertyRenderer} is given for the property it is rendering. */
export interface PropertyRenderContext {
  /** Dotted node path of the leaf (`pose.x`, `data.fill`). */
  path: string;
  /** The schema leaf. App renderers narrow it to their own kind shape. */
  pref: ToolPrefLeaf;
  /** Aggregated value across the selection; `undefined` when mixed or unset. */
  value: unknown;
  /** True when selected nodes disagree at this path. */
  mixed: boolean;
  /**
   * True when the nodes agree and what they agree on is nothing — the field
   * is absent, and whatever paints comes from a fallback further down.
   *
   * Distinct from `mixed`, and both leave `value` undefined. A control must
   * not substitute its schema default here: doing so shows a value the node
   * does not hold, and the next edit writes that invention back.
   */
  unset: boolean;
  /**
   * The fields of the object this leaf is a field of — `undefined` for a
   * top-level leaf, and for a field of an object the node does not hold.
   *
   * What a control needs when its own field doesn't carry the whole answer:
   * a stroke's dash lengths are multiples of the stroke's width, so reading
   * the array as a style takes both.
   */
  siblings?: Record<string, unknown>;
  /** Commit a value — fans out to every selected node in one undo step. */
  setValue: (value: unknown) => void;
  /**
   * The aggregated value at another node path — what `value` and `mixed` are
   * for this leaf's own path, for any path.
   *
   * A control whose subject spans more than one field needs it: a font picker
   * reporting which variant will actually paint has to read the node's weight
   * and style. Reading it off `value` is impossible — a leaf is handed one
   * field.
   */
  valueAt: (path: string) => { value: unknown; mixed: boolean };
  /**
   * The ids of the nodes the values were read from, joined. It changes exactly
   * when the selection does, so a control holding scratch that belongs to one
   * selection can key on it and be remounted rather than carry it to the next.
   * Absent where the values come from no selection, as in a tool options bar.
   */
  selectionKey?: string;
}

/**
 * Renders the control for one property across the whole selection.
 * Returning `null` collapses the leaf.
 */
export type PropertyRenderer = (ctx: PropertyRenderContext) => ReactNode;


/**
 * One leaf with its context built but nothing rendered yet.
 *
 * Deferring the render is what lets a run of sibling flags become one bar:
 * whether a leaf joins its neighbors is a fact about the run, which no leaf
 * rendering itself can see.
 */
export interface LeafCell {
  key: string;
  leaf: ToolPrefLeaf;
  ctx: PropertyRenderContext;
  /** The accessible name this leaf's control carries — qualified by the row's
   *  pair where the row holds more than one leaf. */
  ariaLabel: string;
  /** Renders the leaf on its own, chrome and all. */
  render: () => ReactNode;
}

/** A cell's content, once the run it belongs to has been decided. */
export interface RenderedCell {
  key: string;
  /** The leaf that names the cell — the run's first, for a flag bar. */
  leaf: ToolPrefLeaf;
  block: boolean;
  content: ReactNode;
}

/**
 * True for a leaf that can join a flag bar: a paired toggle boolean the
 * consumer has not claimed with a renderer of its own.
 */
export function isFlagCell(cell: LeafCell, renderers?: Record<string, PropertyRenderer>): boolean {
  const { leaf } = cell;
  return (
    leaf.kind === 'boolean' &&
    (leaf as ToolPrefBoolean).control === 'toggle' &&
    leaf.pair !== undefined &&
    renderers?.[cell.ctx.path] === undefined &&
    renderers?.[leaf.kind] === undefined
  );
}

/**
 * Renders a row's cells, collapsing each run of adjacent same-`pair` toggle
 * booleans into one segmented bar — the idiom the enum toggle a row away
 * already uses, rather than one detached pill per flag.
 */
export function renderCells(
  cells: readonly LeafCell[],
  renderers?: Record<string, PropertyRenderer>,
): RenderedCell[] {
  const out: RenderedCell[] = [];
  for (let i = 0; i < cells.length; ) {
    const cell = cells[i];
    if (!isFlagCell(cell, renderers)) {
      const content = cell.render();
      if (content != null) {
        out.push({ key: cell.key, leaf: cell.leaf, block: cell.leaf.block === true, content });
      }
      i += 1;
      continue;
    }
    let j = i + 1;
    while (
      j < cells.length &&
      isFlagCell(cells[j], renderers) &&
      cells[j].leaf.pair === cell.leaf.pair
    ) {
      j += 1;
    }
    const run = cells.slice(i, j);
    out.push({
      key: cell.key,
      leaf: cell.leaf,
      block: run.every((c) => c.leaf.block === true),
      content: <FlagBar run={run} ariaLabel={cell.leaf.pair as string} />,
    });
    i = j;
  }
  return out;
}

/**
 * A run of paired boolean flags as one multi-select bar — U / S / O, the way
 * every text editor draws them.
 */
function FlagBar({ run, ariaLabel }: { run: readonly LeafCell[]; ariaLabel: string }): ReactNode {
  const on = run.filter((c) => c.ctx.value === true).map((c) => c.key);
  return (
    <ToggleBar<string>
      mode="multiple"
      size="sm"
      variant="flat"
      className={s.flagToggle}
      ariaLabel={ariaLabel}
      items={run.map((c) => {
        const p = c.leaf as ToolPrefBoolean;
        return {
          value: c.key,
          label:
            p.icon && p.icon in ICON_PATHS ? (
              <Icon name={p.icon as IconName} size={14} />
            ) : (
              (p.short ?? p.name.slice(0, 1))
            ),
          ariaLabel: c.ariaLabel,
        };
      })}
      value={on}
      // Each flag owns its own path, so only the segment that moved is
      // written — committing the run would write two fields nobody touched,
      // and inside an object leaf would fabricate values for the other two.
      mixedValues={run.filter((c) => c.ctx.mixed).map((c) => c.key)}
      onChange={(next) => {
        for (const c of run) {
          const now = next.includes(c.key);
          if (now !== on.includes(c.key)) c.ctx.setValue(now);
        }
      }}
    />
  );
}

export function renderBuiltin(
  ctx: PropertyRenderContext,
  ariaLabel: string,
  renderers?: Record<string, PropertyRenderer>,
  /** Identifies the current selection, so a control holding per-selection
   *  scratch (the paint kind memory) is remounted rather than carried over. */
  selectionKey = '',
  /** True for a field of an object leaf. Such a field writes itself into its
   *  parent, so it can only hold values its parent's type permits — which is
   *  what rules "none" out for a nested paint. */
  nested = false,
): ReactNode {
  const { pref, value, mixed, unset, setValue } = ctx;
  if (pref.kind === 'object') {
    // One value with fields hanging off it. Each child writes the parent
    // whole, so a field is never set on a half-built object.
    return <ObjectLeaf ctx={ctx} renderers={renderers} selectionKey={selectionKey} />;
  }
  const field = prefFieldProps(pref, {
    value,
    mixed,
    unset,
    siblings: ctx.siblings,
    setValue,
    // The substitution probe runs at the node's own weight and style, so the
    // picker names the variant that will actually paint. A mixed selection
    // has no single one; the probe falls back to 400/normal there.
    fontVariant: {
      weight: ctx.valueAt('data.style.fontWeight').value,
      style: ctx.valueAt('data.style.fontStyle').value,
    },
  });
  if (field === null) {
    return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
  switch (field.kind) {
    case 'boolean':
      // A panel's flag is a switch unless it asks otherwise.
      return (
        <PropertyControl
          {...field}
          {...framed(ariaLabel)}
          control={field.control ?? 'switch'}
          className={field.control === 'toggle' ? s.flagToggle : undefined}
        />
      );
    case 'number':
      return (
        <PropertyControl
          {...field}
          {...framed(ariaLabel)}
          className={field.control === 'slider' ? s.slider : s.number}
          steppers={false}
        />
      );
    case 'string':
      // Settled values only: a live write per keystroke would be one undo
      // step per character.
      return <PropertyControl {...field} {...framed(ariaLabel)} onInput={settledOnly} />;
    case 'enum':
      return (
        <PropertyControl
          {...field}
          {...framed(ariaLabel)}
          className={field.control === 'toggle' ? s.toggle : field.control === 'radio' ? undefined : s.select}
        />
      );
    case 'font-family':
      return <PropertyControl {...field} {...framed(ariaLabel)} className={s.select} />;
    case 'paint':
      return (
        <PropertyControl
          {...field}
          {...framed(ariaLabel)}
          // Per-kind switch memory is scratch for one selection; carrying it
          // across would recall the previous node's gradient.
          key={selectionKey}
          control="inline"
          // A nested paint writes one field of its parent, and no kit paint
          // field is optional — `Stroke.paint` is required. Removing the
          // whole parent is a different edit than repainting it, so the
          // control must not offer one as the other.
          allowNone={!nested}
        />
      );
    default:
      return <PropertyControl {...field} {...framed(ariaLabel)} />;
  }
}

const framed = (name: string) => ({ chrome: 'framed' as const, name });

const settledOnly = (): void => {};

/**
 * Renders an object leaf: a titled block whose rows are the object's own
 * fields. A child's edit commits the parent object, never the child's path —
 * writing into a path whose value is not an object yet would corrupt it.
 */
/** One labeled row inside an object leaf; `pair` merges adjacent fields into
 *  it, exactly as the section rows merge theirs. */
interface ObjectRow {
  key: string;
  pair?: string;
  label: string;
  title?: string;
  /** Every field in the row brought its own chrome, so the row drops the
   *  label column and spans the block. One unlabeled field in an otherwise
   *  labeled pair would leave the row named after half of itself. */
  block: boolean;
  controls: ReactNode[];
}

/**
 * Renders an object leaf: the object's own fields, as rows. A child's edit
 * commits the parent object, never the child's path — writing into a path
 * whose value is not an object yet would corrupt it.
 */
function ObjectLeaf({
  ctx,
  renderers,
  selectionKey = '',
}: {
  ctx: PropertyRenderContext;
  renderers?: Record<string, PropertyRenderer>;
  selectionKey?: string;
}): ReactNode {
  const pref = ctx.pref as ToolPrefObject;
  const held = typeof ctx.value === 'object' && ctx.value !== null
    ? (ctx.value as Record<string, unknown>)
    : undefined;

  // A value whose fields are entirely grouped is titled by those groups — its
  // own heading would stack onto the first one and name nothing new.
  const allGrouped = Object.values(pref.children).every((child) => !('kind' in child));

  // `indent` is false when nothing visible sits above these rows: depth is
  // drawn only where a label marks it.
  const rowsOf = (
    children: Record<string, ToolPrefLeaf | ToolPrefGroup>,
    indent: boolean,
  ): ReactNode[] => {
    const out: (ReactNode | ObjectRow)[] = [];
    const isRow = (v: ReactNode | ObjectRow): v is ObjectRow =>
      typeof v === 'object' && v !== null && 'controls' in v;

    // Cells accumulate unrendered so a run of adjacent same-`pair` flags can
    // be seen as a run before any of them draws; a group heading between two
    // fields ends the run, exactly as it ends a paired row.
    let pending: LeafCell[] = [];
    const flush = (): void => {
      for (const { key, leaf, block, content } of renderCells(pending, renderers)) {
        const prev = out[out.length - 1];
        if (leaf.pair !== undefined && isRow(prev) && prev.pair === leaf.pair) {
          prev.controls.push(<Fragment key={key}>{content}</Fragment>);
          prev.block &&= block;
          continue;
        }
        out.push({
          key,
          pair: leaf.pair,
          label: leaf.pair ?? leaf.name,
          title: leaf.description,
          block,
          controls: [<Fragment key={key}>{content}</Fragment>],
        });
      }
      pending = [];
    };

    for (const [key, child] of Object.entries(children)) {
      // A group among the children organises the fields under a heading
      // without contributing to the path — the rule group keys follow at the
      // top level.
      if (!('kind' in child)) {
        const labeled = child.name !== '';
        const inner = rowsOf(child.children, labeled);
        if (inner.length === 0) continue;
        flush();
        out.push(
          <div key={`group:${key}`} className={labeled && indent ? s.objectGroup : undefined}>
            {labeled && <h5 className={s.sectionTitle}>{child.name}</h5>}
            {inner}
          </div>,
        );
        continue;
      }
      const childPath = `${ctx.path}.${key}`;
      const childCtx: PropertyRenderContext = {
        path: childPath,
        pref: child,
        value: held?.[key],
        mixed: ctx.mixed,
        // A field of an object the node does not hold is unset, and so is one
        // the object omits — `data.stroke` absent leaves every stroke field
        // with nothing behind it, not with the schema's defaults.
        unset: !ctx.mixed && held?.[key] === undefined,
        siblings: held,
        valueAt: ctx.valueAt,
        selectionKey: ctx.selectionKey,
        setValue: (v) => {
          // The node holds no object yet, so writing one field has to
          // materialize the rest: the leaf's `default` is what a complete
          // value looks like. Starting from `{}` instead committed the one
          // field on its own — a `data.stroke` of `{ width: 2 }` with no
          // `paint`, which the type forbids and the painter threw on, taking
          // the whole frame and the visible document with it.
          const base = held
            ?? pref.fromScalar?.(ctx.value)
            ?? (typeof pref.default === 'object' && pref.default !== null
              ? { ...(pref.default as Record<string, unknown>) }
              : {});
          if (v === undefined) {
            // A field written as absent is absent — leaving the key holding
            // `undefined` says the object has a dash of nothing.
            const { [key]: _dropped, ...rest } = base;
            ctx.setValue(rest);
            return;
          }
          ctx.setValue({ ...base, [key]: v });
        },
      };
      pending.push({
        key: childPath,
        leaf: child,
        ctx: childCtx,
        ariaLabel: child.name,
        render: () => {
          const custom = renderers?.[childPath] ?? renderers?.[child.kind];
          const rendered = custom
            ? custom(childCtx)
            : renderBuiltin(childCtx, child.name, renderers, selectionKey, true);
          if (rendered == null) return null;
          // Neither a paired row nor a block one gives a field its own label
          // column, so the glyph is all that names it on screen. The control
          // already carries `name` as its accessible name, which leaves the
          // glyph decorative.
          const unlabeled = child.pair !== undefined || child.block === true;
          const glyph = unlabeled && child.icon && child.icon in ICON_PATHS;
          if (!glyph) return rendered;
          return (
            <span className={s.namedField}>
              <Icon name={child.icon as IconName} size={14} />
              {rendered}
            </span>
          );
        },
      });
    }
    flush();
    return out.map((entry) =>
      typeof entry === 'object' && entry !== null && 'controls' in entry ? (
        entry.block ? (
          <div key={entry.key} className={`${s.rowControls} ${s.blockRow}`} title={entry.title}>
            {entry.controls}
          </div>
        ) : (
          <div key={entry.key} className={s.row}>
            <span className={s.rowLabel} title={entry.title}>{entry.label}</span>
            <span className={s.rowControls}>{entry.controls}</span>
          </div>
        )
      ) : (
        entry
      ),
    );
  };

  const rows = rowsOf(pref.children, !allGrouped);
  if (rows.length === 0) return null;
  return (
    <div className={s.objectLeaf}>
      {!allGrouped && <h4 className={s.sectionTitle}>{pref.name}</h4>}
      {rows}
    </div>
  );
}
