/**
 * A selection's leaves as cells: one `PrefLeaf` and its aggregated value
 * in, one rendered cell out, plus the run logic that turns a row of paired
 * toggles into a single segmented bar.
 *
 * The control itself is `PropertyControl`'s, through `prefFieldProps`; what
 * is decided here is how a selection surface sizes and composes it.
 * `ToolOptionsBar` renders a tool's options through the same functions.
 */
import type { ReactNode } from 'react';
import {
  type PrefAction,
  type PrefAlias,
  type PrefBoolean,
  type PrefLeaf,
  type PrefMap,
  type PrefUnion,
  prefVariantOf,
} from '@weasel-js/prefs';
import { MapEditor } from '../Prefs/MapEditor';
import { PrefActionButton } from '../Prefs/PrefActionButton';
import { PrefMixed } from '../Prefs/PrefMixed';
import { prefDrawsNoControl, PrefWords } from '../Prefs/PrefWords';
import { UnionPicker } from '../Prefs/UnionPicker';
import { prefFieldProps, type PrefFieldState } from '../Prefs/prefField';
import type { PrefFieldChoice } from '../Prefs/schema';
import { renderBarLeaf, type LeafSurface } from '../Bar/renderBarLeaf';
import { FitLabel, labelForms } from '../FitLabel/FitLabel';
import {
  PropertyControl,
  type PropertyBooleanFieldProps,
  type PropertyControlProps,
} from '../Properties/PropertyField';
import { ToggleBar } from '../ToggleBar';
import { ListLeaf } from './ListLeaf';
import { ObjectLeaf } from './ObjectLeaf';
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
  /** The leaf takes no input: its `enableIf`, or that of a section above it, does not hold. A renderer draws its
   *  control disabled. */
  disabled?: boolean;
  /** Whether the field at a path under this leaf's is disabled by a condition of its own. */
  disabledAt?: (path: string) => boolean;
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
  /** Every leaf the cell draws is disabled. */
  disabled: boolean;
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
        out.push({ key: cell.key, leaf: cell.leaf, block: cell.leaf.block === true || prefDrawsNoControl(cell.leaf), disabled: cell.ctx.disabled === true, content, ...(cell.pair ? { pair: cell.pair } : {}) });
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
      disabled: run.every((c) => c.ctx.disabled === true),
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
      disabled: c.ctx.disabled,
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
        disabled: field.disabled,
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

export interface RenderBuiltinOptions {
  /** Identifies the current selection, so a control holding per-selection
   *  scratch (the paint kind memory) is remounted rather than carried over. */
  selectionKey?: string;
  /** True for a field of an object leaf. Such a field writes itself into its
   *  parent, so it can only hold values its parent's type permits — which is
   *  what rules "none" out for a nested paint. */
  nested?: boolean;
  surface?: LeafSurface;
}

export function renderBuiltin(
  ctx: PropertyRenderContext,
  ariaLabel: string,
  renderers?: Record<string, PropertyRenderer>,
  { selectionKey = '', nested = false, surface = 'row' }: RenderBuiltinOptions = {},
): ReactNode {
  const { pref, value, mixed, setValue } = ctx;
  if (surface === 'bar') {
    return renderBarLeaf({
      leaf: pref,
      path: ctx.path,
      name: ariaLabel,
      field: leafField(ctx, nested),
      disabled: ctx.disabled,
      row: () => renderBuiltin(ctx, ariaLabel, renderers, { selectionKey, nested }),
    });
  }
  // A leaf drawn inside this one's value is a field of it.
  const within: RenderBuiltinOptions = { selectionKey, nested: true };
  if (pref.kind === 'object') {
    // One value with fields hanging off it. Each child writes the parent
    // whole, so a field is never set on a half-built object.
    return <ObjectLeaf ctx={ctx} renderers={renderers} selectionKey={selectionKey} />;
  }
  if (pref.kind === 'list') {
    return (
      <ListLeaf
        ctx={ctx}
        drawsStrings={renderers?.string !== undefined}
        renderItem={(item, name) => {
          const custom = renderers?.[item.path] ?? renderers?.[item.pref.kind];
          return custom ? custom(item) : renderBuiltin(item, name, renderers, within);
        }}
      />
    );
  }
  if (pref.kind === 'map') {
    if (mixed) return <PrefMixed />;
    const map = pref as PrefMap;
    return (
      <MapEditor
        pref={map}
        value={value}
        onChange={setValue}
        disabled={ctx.disabled}
        renderValue={(held, set, name, key) => {
          const item: PropertyRenderContext = {
            ...ctx,
            path: `${ctx.path}.${key}`,
            pref: map.item,
            value: held,
            mixed: false,
            unset: held === undefined,
            siblings: undefined,
            each: [held],
            eachSiblings: undefined,
            setValue: set,
            update: (fn) => set(fn(held)),
          };
          const custom = renderers?.[map.item.kind];
          return custom ? custom(item) : renderBuiltin(item, name, renderers, within);
        }}
      />
    );
  }
  if (pref.kind === 'union') {
    const union = pref as PrefUnion;
    // Nodes of different variants share no fields to draw.
    const split = mixed && new Set(ctx.each.map((v) => prefVariantOf(union, v)?.[0])).size > 1;
    return (
      <UnionPicker pref={union} value={mixed ? ctx.each[0] : value} mixed={split} disabled={ctx.disabled} onChange={setValue}>
        {(variant, key) => (
          <ObjectLeaf
            ctx={{
              ...ctx,
              pref: variant,
              // A node holding no object yet is built from the variant's default, which carries no tag.
              update: (fn) =>
                ctx.update((prev, siblings) => {
                  const next = fn(prev, siblings);
                  return next !== null && typeof next === 'object' ? { ...next, [union.tag]: key } : next;
                }),
            }}
            renderers={renderers}
            selectionKey={selectionKey}
          />
        )}
      </UnionPicker>
    );
  }
  if (pref.kind === 'action') return <PrefActionButton pref={pref as PrefAction} path={ctx.path} disabled={ctx.disabled} />;
  if (prefDrawsNoControl(pref)) return <PrefWords pref={pref} />;
  if (pref.kind === 'alias') {
    // The panel draws a resolved alias as its target, so one that reaches here points at nothing.
    const of = (pref as PrefAlias).of;
    return <span className={s.unrenderable}>(alias: no pref at {of === '' ? 'an empty path' : of})</span>;
  }
  const field = leafField(ctx, nested);
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
        <PropertyControl {...field} name={ariaLabel} className={field.control === 'slider' ? s.slider : s.number} />
      );
    case 'string':
      return <PropertyControl {...field} name={ariaLabel} />;
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
              : field.control === 'radio' || field.control === 'menu' ? undefined : s.select
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
        />
      );
    case 'color':
      return <PropertyControl {...field} name={ariaLabel} />;
    default: {
      // A control kind with no arm is a compile error here, not a cell that silently drops out of its row.
      const _exhaustive: never = field;
      return <span className={s.unrenderable}>({(_exhaustive as { kind: string }).kind}: no renderer)</span>;
    }
  }
}

/**
 * A leaf as one control's props, writing the way a selection surface commits:
 * what is the same whether the control then sits in a row or in a bar. Null
 * for a leaf that is not one control.
 */
function leafField(ctx: PropertyRenderContext, nested: boolean): PropertyControlProps | null {
  const field = prefFieldProps(ctx.pref, {
    value: ctx.value,
    mixed: ctx.mixed,
    unset: ctx.unset,
    fields: ctx.fields,
    siblings: ctx.siblings,
    setValue: ctx.setValue,
    disabled: ctx.disabled,
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
  switch (field?.kind) {
    case 'number':
      // A typed number writes once it is entered, as text does; a slider
      // writes as it moves.
      return field.control === 'slider' ? field : { ...field, onInput: settledOnly };
    case 'string':
      // Settled values only: a live write per keystroke would be one undo
      // step per character.
      return { ...field, onInput: settledOnly };
    case 'color':
      // One write per gesture, not one per step of the picker.
      return { ...field, onInput: settledOnly };
    case 'paint':
      // A nested paint writes one field of its parent, and no kit paint
      // field is optional — `Stroke.paint` is required. Removing the
      // whole parent is a different edit than repainting it, so the
      // control must not offer one as the other.
      return { ...field, allowNone: !nested };
    default:
      return field;
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
