/**
 * A selection's leaves as cells: one `PrefLeaf` and its aggregated value
 * in, one rendered cell out, plus the run logic that turns a row of paired
 * toggles into a single segmented bar and the rows of an object leaf.
 *
 * The control itself is `PropertyControl`'s, through `prefFieldProps`; what
 * is decided here is how a selection surface sizes and composes it.
 * `ToolOptionsBar` renders a tool's options through the same functions.
 */
import { Fragment, type ReactNode } from 'react';
import {
  isPrefLeaf,
  pairRowsOf,
  type PrefBoolean,
  type PrefLeaf,
  type PrefObject,
  prefSectionLeaves,
} from '@weasel-js/prefs';
import { prefFieldProps, type PrefFieldState } from '../Prefs/prefField';
import type { PrefFieldChoice } from '../Prefs/schema';
import { FitLabel, labelForms } from '../FitLabel/FitLabel';
import { PropertyControl, type PropertyBooleanFieldProps } from '../Properties/PropertyField';
import { ToggleBar } from '../ToggleBar';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import s from './SelectionPanel.module.css';


/** What a {@link PropertyRenderer} is given for the property it is rendering. */
export interface PropertyRenderContext {
  /** Dotted node path of the leaf (`pose.x`, `data.fill`). */
  path: string;
  /** The panel's fields, which a `field` leaf names one of. */
  fields?: readonly PrefFieldChoice[];
  /** The schema leaf. App renderers narrow it to their own kind shape. */
  pref: PrefLeaf;
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
  /** The value each selected node holds at this path, in selection order —
   *  what `value` aggregates, and what a mixed selection still has. */
  each: readonly unknown[];
  /**
   * For a field of an object leaf, each node's own object (parallel to
   * `each`), which is still there when the nodes' objects differ and
   * `siblings` is not.
   */
  eachSiblings?: readonly (Record<string, unknown> | undefined)[];
  /** Commit a value — fans out to every selected node in one undo step. */
  setValue: (value: unknown) => void;
  /**
   * Commit a value derived from what each node holds at this path, in one undo
   * step. What `setValue` cannot do across a selection whose nodes differ: a
   * field of an object leaf has to land in each node's own object, not in one
   * object written over all of them. `siblings` is that node's object, for a
   * field of an object leaf.
   */
  update: (fn: (prev: unknown, siblings?: Record<string, unknown>) => unknown) => void;
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
  leaf: PrefLeaf;
  ctx: PropertyRenderContext;
  /** The accessible name this leaf's control carries — qualified by the row's
   *  pair where the row holds more than one leaf. */
  ariaLabel: string;
  /** Renders the leaf on its own, chrome and all. */
  render: () => ReactNode;
  /** The paired row the leaf shares, by the path that declared it and what it reads. */
  pair?: { key: string; label: string };
}

/** A cell's content, once the run it belongs to has been decided. */
export interface RenderedCell {
  key: string;
  /** The leaf that names the cell — the run's first, for a flag bar. */
  leaf: PrefLeaf;
  block: boolean;
  content: ReactNode;
  pair?: { key: string; label: string };
}

/**
 * True for a leaf that can join a flag bar: a paired toggle boolean the
 * consumer has not claimed with a renderer of its own.
 */
export function isFlagCell(cell: LeafCell, renderers?: Record<string, PropertyRenderer>): boolean {
  const { leaf } = cell;
  return (
    leaf.kind === 'boolean' &&
    (leaf as PrefBoolean).control === 'toggle' &&
    cell.pair !== undefined &&
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
        out.push({ key: cell.key, leaf: cell.leaf, block: cell.leaf.block === true, content, ...(cell.pair ? { pair: cell.pair } : {}) });
      }
      i += 1;
      continue;
    }
    let j = i + 1;
    while (
      j < cells.length &&
      isFlagCell(cells[j], renderers) &&
      cells[j].pair?.key === cell.pair?.key
    ) {
      j += 1;
    }
    const run = cells.slice(i, j);
    out.push({
      key: cell.key,
      leaf: cell.leaf,
      block: run.every((c) => c.leaf.block === true),
      content: <FlagBar run={run} ariaLabel={cell.pair?.label ?? cell.leaf.name} />,
      ...(cell.pair ? { pair: cell.pair } : {}),
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
  // Each flag through the same field props a lone one gets, so an `encoding`
  // (Italic stored as `fontStyle`) reads and writes the same way in a bar.
  const flags = run.map((c) => {
    const field = prefFieldProps(c.leaf, {
      value: c.ctx.value,
      mixed: c.ctx.mixed,
      unset: c.ctx.unset,
      siblings: c.ctx.siblings,
      setValue: c.ctx.setValue,
      ...perNodeState(c.ctx),
    }) as PropertyBooleanFieldProps;
    return { cell: c, field };
  });
  const on = flags.filter((f) => !f.field.mixed && f.field.value === true).map((f) => f.cell.key);
  return (
    <ToggleBar<string>
      mode="multiple"
      size="sm"
      variant="flat"
      className={s.flagToggle}
      ariaLabel={ariaLabel}
      items={flags.map(({ cell, field }) => ({
        value: cell.key,
        label: field.glyph ?? <FitLabel forms={labelForms(cell.leaf.name, field.short)} />,
        ariaLabel: cell.ariaLabel,
        tooltip: field.glyph === undefined ? undefined : cell.leaf.name,
      }))}
      value={on}
      // Each flag owns its own path, so only the segment that moved is
      // written — committing the run would write two fields nobody touched,
      // and inside an object leaf would fabricate values for the other two.
      mixedValues={flags.filter((f) => f.field.mixed).map((f) => f.cell.key)}
      onChange={(next) => {
        for (const { cell, field } of flags) {
          const now = next.includes(cell.key);
          if (now !== on.includes(cell.key)) field.onChange(now);
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
    fields: ctx.fields,
    siblings: ctx.siblings,
    setValue,
    ...perNodeState(ctx),
    // The font pickers read the rest of the font from the leaves beside
    // them: the family's substitution probe runs at the weight and style
    // that will paint, and a weight lists what its family has. A mixed
    // selection has no single one; the probe falls back to 400/normal there.
    fontVariant: {
      weight: ctx.valueAt(siblingPath(ctx.path, 'fontWeight')).value,
      style: ctx.valueAt(siblingPath(ctx.path, 'fontStyle')).value,
    },
    fontFamily: ctx.valueAt(siblingPath(ctx.path, 'fontFamily')).value,
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
          name={ariaLabel}
          control={field.control ?? 'switch'}
          className={field.control === 'toggle' ? s.flagToggle : undefined}
        />
      );
    case 'number':
      return (
        <PropertyControl
          {...field}
          name={ariaLabel}
          className={field.control === 'slider' ? s.slider : s.number}
          // A typed number writes once it is entered, as text does; a slider
          // writes as it moves.
          onInput={field.control === 'slider' ? field.onInput : settledOnly}
        />
      );
    case 'string':
      // Settled values only: a live write per keystroke would be one undo
      // step per character.
      return <PropertyControl {...field} name={ariaLabel} onInput={settledOnly} />;
    case 'enum':
      return (
        <PropertyControl
          {...field}
          name={ariaLabel}
          // A clearable toggle is a set of exclusive flags, and sits beside
          // other flags sized the way they are.
          className={
            field.control === 'toggle'
              ? field.onClear ? s.flagToggle : s.toggle
              : field.control === 'radio' ? undefined : s.select
          }
        />
      );
    case 'font-family':
    case 'font-weight':
      return <PropertyControl {...field} name={ariaLabel} className={s.select} />;
    case 'paint':
      return (
        <PropertyControl
          {...field}
          name={ariaLabel}
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
    case 'color':
      // One write per gesture, not one per step of the picker.
      return <PropertyControl {...field} name={ariaLabel} onInput={settledOnly} />;
  }
}

const settledOnly = (): void => {};

/** The dotted path of the leaf `key` beside the one at `path`. */
function siblingPath(path: string, key: string): string {
  const dot = path.lastIndexOf('.');
  return dot < 0 ? key : `${path.slice(0, dot + 1)}${key}`;
}

/** What an `encoding` needs to read and write each node against its own
 *  object — nothing for a leaf that is not a field of one. */
function perNodeState(ctx: PropertyRenderContext): Pick<PrefFieldState, 'perNode' | 'update'> {
  if (ctx.eachSiblings === undefined) return {};
  const siblings = ctx.eachSiblings;
  return {
    perNode: ctx.each.map((value, i) => ({ value, siblings: siblings[i] })),
    update: ctx.update,
  };
}

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
  const pref = ctx.pref as PrefObject;
  const held = typeof ctx.value === 'object' && ctx.value !== null
    ? (ctx.value as Record<string, unknown>)
    : undefined;
  const eachObject = ctx.each.map((v) =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined,
  );

  // A value whose fields all sit under sections is titled by them — its
  // own heading would stack onto the first one and name nothing new.
  const allGrouped = Object.values(pref.children).every((child) => !isPrefLeaf(child));

  // Every field's full path, so a `pair` resolves against the paths the
  // fields are written at.
  const pairs = pairRowsOf(
    prefSectionLeaves(pref.children).map(([key, leaf]) => [`${ctx.path}.${key}`, leaf] as const),
  );

  // `indent` is false when nothing visible sits above these rows: depth is
  // drawn only where a label marks it.
  const rowsOf = (
    children: PrefObject['children'],
    indent: boolean,
  ): ReactNode[] => {
    const out: (ReactNode | ObjectRow)[] = [];
    const isRow = (v: ReactNode | ObjectRow): v is ObjectRow =>
      typeof v === 'object' && v !== null && 'controls' in v;

    // Cells accumulate unrendered so a run of adjacent same-`pair` flags can
    // be seen as a run before any of them draws; a section heading between two
    // fields ends the run, exactly as it ends a paired row.
    let pending: LeafCell[] = [];
    const flush = (): void => {
      for (const { key, leaf, block, content, pair } of renderCells(pending, renderers)) {
        const prev = out[out.length - 1];
        if (pair !== undefined && isRow(prev) && prev.pair === pair.key) {
          prev.controls.push(<Fragment key={key}>{content}</Fragment>);
          prev.block &&= block;
          continue;
        }
        out.push({
          key,
          ...(pair ? { pair: pair.key } : {}),
          label: pair?.label ?? leaf.name,
          title: leaf.description,
          block,
          controls: [<Fragment key={key}>{content}</Fragment>],
        });
      }
      pending = [];
    };

    for (const [key, child] of Object.entries(children)) {
      if (!isPrefLeaf(child)) {
        const labeled = child.name !== '';
        const inner = rowsOf(child.members, labeled);
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
      // Nodes whose objects differ still agree or disagree field by field: two
      // styles at different sizes are both upright, and saying "mixed" for
      // every field of them hides that.
      const field = ctx.mixed ? ctx.valueAt(childPath) : { value: held?.[key], mixed: false };
      // Each node's own object, with this one field changed. Deriving it per
      // node is what keeps a multi-selection edit from writing one node's
      // object over all the others.
      const update = (fn: (prev: unknown, siblings?: Record<string, unknown>) => unknown): void =>
        ctx.update((prev) => {
          // The node holds no object yet, so writing one field has to
          // materialize the rest: the leaf's `default` is what a complete
          // value looks like. Starting from `{}` instead committed the one
          // field on its own — a `data.stroke` of `{ width: 2 }` with no
          // `paint`, which the type forbids and the painter threw on, taking
          // the whole frame and the visible document with it.
          const base: Record<string, unknown> =
            typeof prev === 'object' && prev !== null
              ? (prev as Record<string, unknown>)
              : (pref.fromScalar?.(prev)
                ?? (typeof pref.default === 'object' && pref.default !== null
                  ? { ...(pref.default as Record<string, unknown>) }
                  : {}));
          const v = fn(base[key], base);
          if (v === undefined) {
            // A field written as absent is absent — leaving the key holding
            // `undefined` says the object has a dash of nothing.
            const { [key]: _dropped, ...rest } = base;
            return rest;
          }
          return { ...base, [key]: v };
        });
      const childCtx: PropertyRenderContext = {
        path: childPath,
        ...(ctx.fields ? { fields: ctx.fields } : {}),
        pref: child,
        value: field.mixed ? undefined : field.value,
        mixed: field.mixed,
        // A field of an object the node does not hold is unset, and so is one
        // the object omits — `data.stroke` absent leaves every stroke field
        // with nothing behind it, not with the schema's defaults.
        unset: !field.mixed && field.value === undefined,
        siblings: held,
        each: eachObject.map((o) => o?.[key]),
        eachSiblings: eachObject,
        valueAt: ctx.valueAt,
        selectionKey: ctx.selectionKey,
        update,
        setValue: (v) => update(() => v),
      };
      const pair = pairs.get(childPath);
      pending.push({
        key: childPath,
        leaf: child,
        ctx: childCtx,
        ariaLabel: child.name,
        ...(pair ? { pair } : {}),
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
          const unlabeled = pairs.has(childPath) || child.block === true;
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
