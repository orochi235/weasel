import { Fragment, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  asNodeId,
  isBuiltinToolPref,
  type FillStyle,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type Scene,
  type SelectionApi,
  type ToolPrefBoolean,
  type ToolPrefColor,
  type ToolPrefEnum,
  type ToolPrefLeaf,
  type ToolPrefNumber,
  type ToolPrefPaint,
  type ToolPrefGroup,
  type ToolPrefObject,
} from '@weasel-js/core';
import { ColorField } from '../ColorField';
import { FontFamilySelect } from '../FontFamilySelect';
import { PaintInput } from '../PaintInput';
import { InlineRange } from '../InlineRange';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { Select } from '../Select';
import { Switch } from '../Switch';
import { ToggleBar } from '../ToggleBar';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import {
  MIXED,
  aggregateValue,
  classifyKind,
  effectiveSections,
  kindBreakdown,
  setAtPath,
  type AnyNode,
  type PanelLeaf,
} from './model';
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
}

/**
 * Renders the control for one property across the whole selection.
 * Returning `null` collapses the leaf.
 */
export type PropertyRenderer = (ctx: PropertyRenderContext) => ReactNode;

/** Props for {@link SelectionPanel}. */
export interface SelectionPanelProps<TData, TLayer extends string, TPose> {
  /** The scene handle (`useScene`). The panel subscribes itself, so it
   *  re-renders on scene mutations regardless of parent renders. */
  scene: Scene<TData, TLayer, TPose>;
  /** Selection handle (`useSelection`). Only `current` is read. */
  selection: Pick<SelectionApi, 'current'>;
  /** Properties-trait entries, e.g. core's `defaultNodeProperties` /
   *  `inferredNodeProperties` (+ consumer extras). Memoize or hoist. */
  properties: readonly NodePropertiesEntry[];
  /** Routing-trait classifiers used to derive each node's kind — pass
   *  the same list the canvas uses. Memoize or hoist. */
  routing: readonly NodeRoutingEntry[];
  /** Control overrides / app-defined kinds (PrefsForm-style). Keys are
   *  leaf paths (`data.fill`, checked first) or leaf kinds (`color`).
   *  A renderer returning `null` collapses its leaf (and the row, when
   *  every leaf in it collapses). */
  renderers?: Record<string, PropertyRenderer>;
  /** Kind → header label. Default: capitalized kind name. */
  kindLabel?: (kind: string) => string;
  /** Rendered when the selection is empty. */
  emptyState?: ReactNode;
  className?: string;
}

const defaultKindLabel = (kind: string): string =>
  kind.length === 0 ? kind : kind[0].toUpperCase() + kind.slice(1);

/**
 * Pre-baked selection properties panel. Shows the selected nodes' kind
 * and the properties-trait schema for that kind; multi-selections show
 * the intersection of the kinds' schemas with per-field Mixed state.
 * Edits commit as one labeled `scene.batch` fan-out per gesture.
 */
export function SelectionPanel<TData, TLayer extends string, TPose>(
  props: SelectionPanelProps<TData, TLayer, TPose>,
) {
  const {
    scene,
    selection,
    properties,
    routing,
    renderers,
    kindLabel = defaultKindLabel,
    emptyState = null,
    className,
  } = props;

  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const nodes = selection.current
    .map((id) => scene.get(asNodeId(id)))
    .filter((n): n is NonNullable<typeof n> => n != null) as readonly AnyNode[];

  const kinds = nodes.map((n) => classifyKind(n, routing));
  const selectionKey = nodes.map((n) => n.id).join(',');
  const sections = effectiveSections(kinds, properties);

  if (nodes.length === 0) {
    return <div className={[s.root, className].filter(Boolean).join(' ')}>{emptyState}</div>;
  }

  const commit = (leaf: PanelLeaf, value: unknown): void => {
    const [head, ...rest] = leaf.path.split('.');
    if (rest.length === 0) return;
    const ids = selection.current.map(asNodeId);
    scene.batch(`Edit ${leaf.leaf.name}`, () => {
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        // `setAtPath` spreads plain objects/arrays down the schema path;
        // consumer `pose`/`data` are assumed plain-object-shaped along
        // that path (a class instance's prototype would be dropped by
        // the spread) — the `as TPose`/`as TData` casts below rely on it.
        if (head === 'pose') {
          scene.setPose(id, setAtPath(node.pose as object, rest, value) as TPose);
        } else if (head === 'data') {
          scene.update(id, { data: setAtPath(node.data as object, rest, value) as TData });
        }
      }
    });
  };

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
      <header className={s.header}>
        {nodes.length === 1 ? (
          <span className={s.kind}>{kindLabel(kinds[0])}</span>
        ) : (
          <>
            <span className={s.kind}>{nodes.length} selected</span>
            <span className={s.breakdown}>{kindBreakdown(kinds)}</span>
          </>
        )}
      </header>
      {sections.map((section) => {
        // Render controls before emitting row chrome so a null-rendering
        // leaf (custom renderer opting out) collapses its cell — and the
        // whole row / section when nothing survives. PrefsForm precedent.
        const rows = section.rows
          .map((row) => {
            const controls = renderCells(
              row.leaves.map((panelLeaf) =>
                leafCell(
                  panelLeaf,
                  row.leaves.length > 1
                    ? `${row.label} ${panelLeaf.leaf.name}`
                    : panelLeaf.leaf.name,
                  nodes,
                  renderers,
                  commit,
                  selectionKey,
                ),
              ),
              renderers,
            );
            return { row, controls };
          })
          .filter(({ controls }) => controls.length > 0);
        if (rows.length === 0) return null;
        return (
          <section key={section.key} className={s.section}>
            {section.name !== '' && <h3 className={s.sectionTitle}>{section.name}</h3>}
            {rows.map(({ row, controls }) => (
              // A `block` leaf brings its own chrome — it spans the section
              // instead of sitting in a labeled row's control cell. Under a
              // headless section nothing else names it, so it heads itself;
              // an object leaf already renders its own heading.
              row.leaves.length === 1 && row.leaves[0].leaf.block ? (
                <div key={row.leaves[0].path}>
                  {section.name === '' && row.leaves[0].leaf.kind !== 'object' && (
                    <h4 className={s.sectionTitle} title={row.leaves[0].leaf.description}>
                      {row.leaves[0].leaf.name}
                    </h4>
                  )}
                  {controls[0].content}
                </div>
              ) : (
              <div key={row.leaves[0].path} className={s.row}>
                <span className={s.rowLabel} title={row.leaves[0].leaf.description}>
                  {row.label}
                </span>
                <span className={s.rowControls}>
                  {controls.map(({ key, content }) => (
                    <Fragment key={key}>{content}</Fragment>
                  ))}
                </span>
              </div>
              )
            ))}
          </section>
        );
      })}
    </div>
  );
}

/**
 * One leaf with its context built but nothing rendered yet.
 *
 * Deferring the render is what lets a run of sibling flags become one bar:
 * whether a leaf joins its neighbours is a fact about the run, which no leaf
 * rendering itself can see.
 */
interface LeafCell {
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
interface RenderedCell {
  key: string;
  /** The leaf that names the cell — the run's first, for a flag bar. */
  leaf: ToolPrefLeaf;
  block: boolean;
  content: ReactNode;
}

function leafCell(
  panelLeaf: PanelLeaf,
  ariaLabel: string,
  nodes: readonly AnyNode[],
  renderers: Record<string, PropertyRenderer> | undefined,
  commit: (leaf: PanelLeaf, value: unknown) => void,
  selectionKey: string,
): LeafCell {
  const { path, leaf } = panelLeaf;
  const aggregated = aggregateValue(nodes, path);
  const mixed = aggregated === MIXED;
  const value = mixed ? undefined : aggregated;

  const ctx: PropertyRenderContext = {
    path,
    pref: leaf,
    value,
    mixed,
    unset: !mixed && aggregated === undefined,
    setValue: (v) => commit(panelLeaf, v),
    valueAt: (p) => {
      const at = aggregateValue(nodes, p);
      return at === MIXED ? { value: undefined, mixed: true } : { value: at, mixed: false };
    },
  };

  return {
    key: path,
    leaf,
    ctx,
    ariaLabel,
    render: () => {
      const custom = renderers?.[path] ?? renderers?.[leaf.kind];
      if (custom) return custom(ctx);
      return renderBuiltin(ctx, ariaLabel, renderers, selectionKey);
    },
  };
}

/**
 * True for a leaf that can join a flag bar: a paired toggle boolean the
 * consumer has not claimed with a renderer of its own.
 */
function isFlagCell(cell: LeafCell, renderers?: Record<string, PropertyRenderer>): boolean {
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
function renderCells(
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

function renderBuiltin(
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
  if (pref.kind === 'font-family') {
    // Not a `ToolPref` kind: its options are the live font registry, which no
    // static schema can carry. Core's own text schema still declares it, so
    // the panel ships the control rather than leaving every consumer to.
    //
    // The substitution probe runs at the node's own weight and style, so the
    // label names the variant that will actually paint. A mixed selection has
    // no single one; the probe falls back to 400/normal there.
    const weight = ctx.valueAt('data.style.fontWeight');
    const style = ctx.valueAt('data.style.fontStyle');
    return (
      <FontFamilySelect
        className={s.select}
        value={mixed || typeof value !== 'string' ? undefined : value}
        mixed={mixed}
        onChange={setValue}
        weight={typeof weight.value === 'number' ? weight.value : undefined}
        fontStyle={style.value === 'italic' ? 'italic' : undefined}
        aria-label={ariaLabel}
      />
    );
  }
  if (!isBuiltinToolPref(pref)) {
    return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
  switch (pref.kind) {
    case 'number': {
      const p = pref as ToolPrefNumber;
      const stored = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
      const display = stored !== undefined ? (p.unit ? p.unit.toDisplay(stored) : stored) : NaN;
      if (p.control === 'slider') {
        const min = p.min ?? 0;
        const max = p.max ?? 100;
        const known = !mixed && stored !== undefined;
        return (
          <>
            <InlineRange
              min={min}
              max={max}
              step={p.step ?? 1}
              // The thumb clamps to the track; the readout beside it does not,
              // so a value past `max` is still reported as what it is.
              value={known ? Math.min(Math.max(display, min), max) : min}
              disabled={mixed}
              className={s.slider}
              aria-label={ariaLabel}
              onChange={(e) => {
                const next = Number(e.target.value);
                setValue(p.unit ? p.unit.fromDisplay(next) : next);
              }}
            />
            <span className={s.sliderReadout} aria-hidden="true">
              {known ? `${display}${p.unit?.suffix ?? ''}` : '—'}
            </span>
          </>
        );
      }
      const field = (
        <NumberField
          className={s.number}
          value={mixed || stored === undefined ? NaN : display}
          placeholder={mixed ? 'Mixed' : undefined}
          minValue={p.min}
          maxValue={p.max}
          step={p.step ?? 1}
          hideSteppers
          aria-label={ariaLabel}
          onChange={(n) => {
            if (Number.isNaN(n)) return;
            setValue(p.unit ? p.unit.fromDisplay(n) : n);
          }}
        />
      );
      if (p.unit?.suffix === undefined) return field;
      return (
        <>
          {field}
          <span className={s.unitSuffix} aria-hidden="true">
            {p.unit.suffix}
          </span>
        </>
      );
    }
    case 'string': {
      return (
        <DraftInput
          text={mixed ? undefined : typeof value === 'string' ? value : ''}
          placeholder={mixed ? 'Mixed' : undefined}
          ariaLabel={ariaLabel}
          onCommit={setValue}
        />
      );
    }
    case 'boolean': {
      const p = pref as ToolPrefBoolean;
      if (p.control === 'toggle') {
        // One segment, so the bar is the flag: `short` (else the initial of
        // `name`) is all a paired row has room for, and `name` stays the
        // accessible name.
        //
        // No dimming wrapper here. Unselected already *is* how a toggle button
        // says "not set", and dimming it reads as disabled; mixed has an ARIA
        // form on a toggle — `mixedValues` — which the `Switch` below has to
        // fake for want of one.
        return (
          <ToggleBar<string>
            mode="multiple"
            size="sm"
            variant="flat"
            className={s.flagToggle}
            ariaLabel={ariaLabel}
            items={[{
              value: ctx.path,
              label:
                p.icon && p.icon in ICON_PATHS ? (
                  <Icon name={p.icon as IconName} size={14} />
                ) : (
                  (p.short ?? p.name.slice(0, 1))
                ),
              ariaLabel,
            }]}
            value={value === true ? [ctx.path] : []}
            mixedValues={mixed ? [ctx.path] : []}
            onChange={(next) => setValue(next.includes(ctx.path))}
          />
        );
      }
      const control = <Switch isSelected={Boolean(value)} onChange={setValue} aria-label={ariaLabel} />;
      // Neither `Switch`'s indeterminate gap nor "unset" has an ARIA form, so
      // a reduced-opacity wrapper with a title is the cue for both — a mixed
      // selection, and a field the node leaves to its fallback.
      if (!mixed && !unset) return control;
      return (
        <span className={s.mixedSwitch} title={mixed ? 'Mixed' : 'Not set'}>
          {control}
        </span>
      );
    }
    case 'enum': {
      const p = pref as ToolPrefEnum;
      // An encoded leaf stores something other than the option string, so the
      // option comes from the encoding rather than from the value — and an
      // absent field is one of the things it reads (no dash is `solid`), which
      // is why `unset` doesn't blank the control here.
      const option = p.encoding
        ? (mixed ? undefined : p.encoding.read(value, ctx.siblings))
        : mixed || unset
          ? undefined
          : typeof value === 'string'
            ? value
            : p.default;
      const choose = (next: string): void =>
        setValue(p.encoding ? p.encoding.write(next, ctx.siblings) : next);
      if (p.control === 'toggle') {
        // Every option visible at once, which is the point of a segmented
        // control: a glyph, else `short`, keeps it to the width a property row
        // has, and the full label stays the accessible name. A mixed selection
        // selects nothing rather than picking a winner.
        return (
          <ToggleBar<string>
            size="sm"
            variant="flat"
            className={s.toggle}
            ariaLabel={ariaLabel}
            items={p.options.map((o) => ({
              value: o.value,
              label:
                o.icon && o.icon in ICON_PATHS ? (
                  <Icon name={o.icon as IconName} size={14} />
                ) : (
                  (o.short ?? o.label)
                ),
              ariaLabel: o.label,
              disabled: o.disabled,
            }))}
            value={option ?? null}
            onChange={(next) => { if (next !== null) choose(next); }}
          />
        );
      }
      return (
        <Select<string>
          className={s.select}
          options={p.options.map((o) => ({ value: o.value, label: o.label, isDisabled: o.disabled }))}
          selectedKey={option ?? null}
          placeholder={mixed ? 'Mixed' : unset ? '—' : undefined}
          onSelectionChange={choose}
          aria-label={ariaLabel}
        />
      );
    }
    case 'color': {
      const p = pref as ToolPrefColor;
      return (
        <ColorField
          value={mixed ? undefined : typeof value === 'string' ? value : p.default}
          mixed={mixed}
          alpha={p.alpha}
          onChange={setValue}
          aria-label={ariaLabel}
        />
      );
    }
    case 'paint': {
      // The value is a whole `FillStyle`, and `PaintInput` edits it as one —
      // previewing a gradient as a gradient rather than degrading it to the
      // indeterminate chip. That leaves the checkerboard meaning `mixed` and
      // nothing else.
      const p = pref as ToolPrefPaint;
      // `??` would read an explicit `null` — "no paint" — as absent and show
      // the schema default over it, so the None segment could never stay lit.
      // Unset shows the fallback that is actually on the canvas, dimmed: true,
      // but not chosen, which is what the dimming says.
      const paint = (value === null
        ? null
        : (value ?? (mixed ? undefined : p.default))) as FillStyle | null | undefined;
      return (
        <PaintInput
          // Per-kind switch memory is scratch for one selection; carrying it
          // across would recall the previous node's gradient.
          key={selectionKey}
          value={paint}
          mixed={mixed}
          unset={unset}
          // A nested paint writes one field of its parent, and no kit paint
          // field is optional — `Stroke.paint` is required. Removing the
          // whole parent is a different edit than repainting it, so the
          // control must not offer one as the other. A consumer whose
          // renderer owns the parent key (WeaselDraw's `setStroke`) can.
          allowNone={!nested}
          onChange={setValue}
          aria-label={ariaLabel}
        />
      );
    }
    case 'object': {
      // One value with fields hanging off it. Each child writes the parent
      // whole, so a field is never set on a half-built object.
      return <ObjectLeaf ctx={ctx} renderers={renderers} selectionKey={selectionKey} />;
    }
    default: {
      // Not reachable while every built-in kind has an arm — and a new kind
      // that lacks one is a compile error here, never a blank cell.
      const _exhaustive: never = pref;
      throw new Error(
        `SelectionPanel: no control for built-in pref kind "${(_exhaustive as { kind: string }).kind}"`,
      );
    }
  }
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

/** Text input with commit-on-blur/Enter semantics — live-per-keystroke
 *  writes would emit one undo step per character. */
function DraftInput({
  text,
  placeholder,
  ariaLabel,
  onCommit,
}: {
  text: string | undefined;
  placeholder?: string;
  ariaLabel: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      value={draft ?? text ?? ''}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={setDraft}
      onBlur={() => {
        if (draft !== null && draft !== text) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
