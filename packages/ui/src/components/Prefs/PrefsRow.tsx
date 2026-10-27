import { type ReactNode } from 'react';
import {
  prefAliasName,
  prefLeafValue,
  prefValueAtPath,
  type PrefAction,
  type PrefActions,
  type PrefAlias,
  type PrefAliasTargets,
  type PrefLeaf,
  type PrefMap,
  type PrefUnion,
  prefDrawsSeveral,
} from '@weasel-js/prefs';
import type { BarCell, BarLeafNode } from '../Bar/BarLayout';
import { renderBarLeaf, withBarLabel, type LeafSurface } from '../Bar/renderBarLeaf';
import { PrefActionButton, PrefActionRows } from './PrefActionButton';
import { prefDrawsActionRow } from './registeredActions';
import { PrefMixed } from './PrefMixed';
import { aliasOfNothing, prefDrawsNoControl, PrefWords } from './PrefWords';
import { rowWidthOf } from './compound';
import { entryConditions, type EntryAt } from './entry';
import { ListLeaf } from './ListLeaf';
import { MapEditor } from './MapEditor';
import { leafAtValues } from './leafAtValues';
import { ObjectLeaf } from './ObjectLeaf';
import { UnionPicker } from './UnionPicker';
import { controlIsGroup, PropertyControl, type PropertyControlProps } from '../Properties/PropertyField';
import { PropertyRow } from '../Properties/PropertyRow';
import type { LiveControl } from './commitPolicy';
import { prefFieldProps } from './prefField';
import type { PrefFieldChoice } from './schema';
import { dropValuePath, type PrefDrop } from './drop';
import { HiddenBadge, marksHidden } from './hidden';
import { withRowControl } from './surfaceControls';
import { selectionAttrs } from './selection';
import { SplitBody, SplitHead, SplitMarks, SplitToggle, splitRowState } from './SplitRow';
import type { SplitCtx } from './splitRows';
import s from './Prefs.module.css';

/** What a {@link PrefRenderer} is given for the leaf it is rendering. */
export interface PrefRenderContext {
  /** Dotted path of the leaf within the schema root. */
  path: string;
  /** The schema node. App renderers narrow this to their own kind shape. */
  pref: PrefLeaf;
  /** Current value: `values` at `path` as `prefLeafValue` shows it. */
  value: unknown;
  /** Everything the surface edits, from its root: a form's `values`, a control panel's `config`. What a row
   *  reads of another setting. */
  values?: unknown;
  /** The surface marks this leaf's row as changed: a renderer drawing its whole row passes it to `PropertyRow`. */
  changed?: boolean;
  /** The leaf stands for several values that disagree; `value` is undefined. */
  mixed?: boolean;
  setValue: (value: unknown) => void;
  /** Whether a path at or under this leaf's is in the form's `mixed`; with `below`, whether it or any path under it is. */
  mixedAt?: (path: string, below?: boolean) => boolean;
  /** Writes at a path under this leaf's, where `setValue` writes the leaf whole. */
  setValueAt?: (path: string, value: unknown) => void;
  /** Whether this leaf is currently auto — not pinned, computed by the owner. */
  auto: boolean;
  /** Toggle this leaf's auto state. */
  setAuto: (next: boolean) => void;
  /** The form's fields, which a `field` leaf names one of. */
  fields?: readonly PrefFieldChoice[];
  /** The leaf takes no input: its `enableIf`, or that of a group above it, does not hold. A renderer draws its
   *  control disabled. */
  disabled?: boolean;
  /** Whether the field at a path under this leaf's is disabled by a condition of its own. */
  disabledAt?: (path: string) => boolean;
  /** The leaf is one a `showIf` hides, drawn because the form was given `markHidden`. */
  hidden?: boolean;
  /** Whether the field at a path under this leaf's is one a `showIf` hides, in a form given `markHidden`. */
  hiddenAt?: (path: string) => boolean;
  /** An entry of a list or a map under this leaf, as the conditions that read the entry leave it. */
  entryAt?: EntryAt;
  /** Which live controls write only the value an edit settles on, as the form's kit settings have it. Absent, the
   *  form's defaults. */
  settles?: Readonly<Record<LiveControl, boolean>>;
  /** What is wrong with the value, where the surface has a message for this leaf. A renderer drawing its own
   *  `<PropertyRow>` hands it to the row's `error`. */
  error?: ReactNode;
}

/**
 * Renders the control cell for one preference leaf. Returning `null`
 * collapses the row.
 */
export type PrefRenderer = ((ctx: PrefRenderContext) => ReactNode) & {
  /** The control is several, or one a `<label>` may not wrap: its row is a group, and each control carries its own name. */
  group?: boolean;
  /** The control wants the row's whole width, its label above it, as a `map`'s or a `union`'s gets: for one too
   *  wide for the control column. In a field of an object leaf as in a row of the form. */
  wide?: boolean;
};

/** What a prefs form hands every row it draws: the values, the callbacks, and how the form is set up. */
export interface WalkCtx {
  values: unknown;
  onChange: (path: string, value: unknown) => void;
  renderers?: Record<string, PrefRenderer>;
  auto?: ReadonlySet<string>;
  mixed?: ReadonlySet<string>;
  onAutoChange?: (path: string, next: boolean) => void;
  inheritHint?: (path: string) => string | undefined;
  canInherit?: (path: string) => boolean;
  fields?: readonly PrefFieldChoice[];
  /** The schema the form's aliases point into, as its conditions leave it: what an alias row is drawn from. */
  targets?: PrefAliasTargets;
  /** Paths of the rows whose labels are drawn as changed. */
  changed?: ReadonlySet<string>;
  /** Paths of the rows and groups the form marks as selected. */
  selected?: readonly string[];
  /** The one of `selected` the form brings into view and opens the page of. */
  lead?: string | null;
  /** The drop the form is drawing. */
  drop?: PrefDrop | null;
  /** The form takes drops, so a bar in it keeps every cell on its line to drop beside. */
  droppable?: boolean;
  /** Paths of the leaves, fields, and groups a failed `enableIf` disables. */
  disabled?: ReadonlySet<string>;
  /** Paths of the leaves, fields, and groups a failed `showIf` hides, in a form that draws them marked. */
  hidden?: ReadonlySet<string>;
  /** Answers the conditions that read an entry of a list or a map, for that entry. */
  entryAt?: EntryAt;
  /** Which live controls write only the value an edit settles on. */
  settles?: Readonly<Record<LiveControl, boolean>>;
  /** What the form was given to split values with, and which rows are open. */
  split?: SplitCtx;
  /** A surface that draws its leaves itself and its groups as the form does: a standalone `Bar`'s opened
   *  group. A leaf's row and a nested bar's cells are its, and a `heading` leaf stays a row. */
  leaves?: {
    row: (node: BarLeafNode) => ReactNode;
    cells: (leaves: readonly BarLeafNode[]) => BarCell[];
  };
}

/**
 * The leaf a form draws for `pref`, and where its value lives when that is not the leaf's own path: an alias is
 * drawn as the leaf it points at. Null for an alias of nothing.
 */
export function shownLeaf(ctx: WalkCtx, pref: PrefLeaf): { pref: PrefLeaf; at?: string } | null {
  if (pref.kind !== 'alias' || ctx.renderers?.alias) return { pref };
  const shown = ctx.targets?.shown(pref as PrefAlias);
  return shown ? { pref: shown.leaf, at: shown.path } : null;
}

/** A leaf's row. `at` says `pref` is already the leaf an alias at `path` shows, and where its value lives. */
export function PrefRow({ ctx, path, pref, at }: { ctx: WalkCtx; path: string; pref: PrefLeaf; at?: string }) {
  if (ctx.leaves) return ctx.leaves.row(at === undefined ? { path, leaf: pref } : { path, leaf: pref, at });
  const shown = at === undefined ? shownLeaf(ctx, pref) : { pref, at };
  if (shown) return <LeafRow ctx={ctx} path={path} pref={shown.pref} at={shown.at} />;
  const alias = pref as PrefAlias;
  // An alias of nothing is a wiring fault, shown where it sits and not dropped from the form.
  return (
    <div className={s.rowSlot} {...selectionAttrs(path, ctx, true)}>
      <PropertyRow label={prefAliasName(alias)} description={alias.description} className={s.row}
        hint={marksHidden(ctx.hidden, path) ? <HiddenBadge /> : undefined}>
        <span className={s.unrenderable}>{aliasOfNothing(alias)}</span>
      </PropertyRow>
    </div>
  );
}

/**
 * What a leaf's renderer is given, read from the form's values, and whether the leaf's auto state can be toggled.
 * `at` is where the value lives when that is not the leaf's `own` path: the target of an alias.
 */
export function prefRenderContext(
  ctx: WalkCtx, own: string, pref: PrefLeaf, at?: string,
): { renderCtx: PrefRenderContext; toggles: boolean } {
  const path = at ?? own;
  // A placeholder shows what its node shows where it was dragged from.
  const from = at ?? dropValuePath(ctx.drop, own);
  const stored = prefValueAtPath(ctx.values, from);
  const mixed = ctx.mixed?.has(from) ?? false;
  const { onAutoChange } = ctx;
  const inside = at === undefined ? undefined : ctx.targets;
  const entryAt = inside?.entryAt ?? ctx.entryAt;
  const toggles = onAutoChange !== undefined && pref.manual !== true && (ctx.canInherit?.(path) ?? true);
  const renderCtx: PrefRenderContext = {
    path,
    pref: leafAtValues(pref, ctx.values),
    value: mixed ? undefined : prefLeafValue(pref, stored),
    values: ctx.values,
    ...(ctx.changed?.has(path) ? { changed: true } : {}),
    mixed,
    setValue: (v) => ctx.onChange(path, v),
    mixedAt: (at, below = false) => pathIsMixed(ctx.mixed, from + at.slice(path.length), below),
    setValueAt: ctx.onChange,
    auto: ctx.auto?.has(from) ?? false,
    setAuto: (next) => {
      if (toggles) onAutoChange(path, next);
    },
    ...(ctx.fields ? { fields: ctx.fields } : {}),
    disabled: ctx.disabled?.has(own) ?? false,
    // The row answers by the form's own schema, at its own path; what is inside an alias's by its target's.
    disabledAt: inside?.disabledAt ?? ((at) => ctx.disabled?.has(at) ?? false),
    ...(ctx.hidden ? { hidden: ctx.hidden.has(own), hiddenAt: inside?.hiddenAt ?? ((at: string) => ctx.hidden!.has(at)) } : {}),
    ...(entryAt ? { entryAt } : {}),
    ...(ctx.settles ? { settles: ctx.settles } : {}),
  };
  return { renderCtx, toggles };
}

function pathIsMixed(mixed: ReadonlySet<string> | undefined, path: string, below: boolean): boolean {
  if (mixed === undefined) return false;
  if (mixed.has(path)) return true;
  if (!below) return false;
  for (const at of mixed) if (at.startsWith(`${path}.`)) return true;
  return false;
}

/** One leaf's row. `at` is where its value lives when that is not the row's own `path`: the target of an alias. */
function LeafRow({ ctx, path: own, pref, at }: { ctx: WalkCtx; path: string; pref: PrefLeaf; at?: string }) {
  const { renderCtx, toggles } = prefRenderContext(ctx, own, pref, at);
  const { path, auto: inherited, setAuto } = renderCtx;

  const marked = marksHidden(ctx.hidden, own);
  const custom = ctx.renderers?.[pref.kind];
  if (prefDrawsNoControl(pref) && !custom) {
    return (
      <div className={s.rowSlot} data-wide="" {...selectionAttrs(own, ctx, true)}>
        {marked && <HiddenBadge lead />}
        <PrefWords pref={pref} />
      </div>
    );
  }
  const control = custom ? custom(renderCtx) : renderBuiltin(renderCtx, ctx.renderers);
  if (custom && control === null) return null;

  const width = rowWidthOf(pref, ctx.renderers);
  const stacked = width !== 'column';
  const split = splitRowState(ctx.split, ctx.values, pref, own, path, at !== undefined, renderCtx.mixedAt?.(path, true) === true);
  const toggleSplit = (): void => ctx.split!.setOpen(own, !split!.open);
  const members = split?.open && (
    <SplitBody ctx={renderCtx} state={split} split={ctx.split!}
      parts={{ renderControl: (of) => renderPrefControl(of, ctx.renderers), isGroup: (of) => rowIsGroup(of, ctx.renderers), width }} />
  );

  // `block` leaves own their chrome (embedded editors with their own
  // header), and an action's button reads its own label — no label/tooltip row.
  if (pref.block || (!custom && prefDrawsActionRow(pref))) {
    return (
      <div className={s.rowSlot} data-wide="" {...selectionAttrs(own, ctx, true)}>
        {marked && <HiddenBadge lead />}
        {split && <SplitHead state={split} onToggle={toggleSplit} />}
        {control}
        {members}
      </div>
    );
  }
  const inheritHint = inherited ? ctx.inheritHint?.(path) : undefined;

  return (
    <div className={s.rowSlot} data-wide={pref.kind === 'object' || stacked || Array.isArray(pref.default) ? '' : undefined} {...selectionAttrs(own, ctx, true)}>
    <PropertyRow
      label={pref.name}
      changed={ctx.changed?.has(path)}
      mixed={renderCtx.mixedAt?.(path, true)}
      description={pref.description}
      layout={stacked ? 'block' : 'inline'}
      className={stacked ? `${s.row} ${s.rowStacked}` : s.row}
      group={rowIsGroup(renderCtx, ctx.renderers)}
      // The owner passes an inherited leaf's value already resolved, so the
      // control keeps drawing it; editing it pins, through `onChange`.
      auto={inherited}
      autoControl="dimmed"
      onAutoChange={toggles ? setAuto : undefined}
      hint={marked || split ? <>{marked && <HiddenBadge />}{inheritHint}{split && <SplitMarks levels={split.shape.levels} />}</> : inheritHint}
      disabled={renderCtx.disabled}
    >
      <span className={width === 'filled' ? `${s.rowControl} ${s.rowControlFilled}` : s.rowControl}>
        {control}
        {split && <SplitToggle state={split} onToggle={toggleSplit} />}
      </span>
    </PropertyRow>
    {members}
    </div>
  );
}

/** A leaf's control with no row around it, as it is drawn nested in another's value: by the app's renderer for its kind, where it has one. */
export function renderPrefControl(
  ctx: PrefRenderContext,
  renderers: Record<string, PrefRenderer> | undefined,
  siblings?: Record<string, unknown>,
  surface: LeafSurface = 'row',
): ReactNode {
  const custom = renderers?.[ctx.pref.kind];
  if (!custom) return renderBuiltin(ctx, renderers, siblings, surface);
  return surface === 'bar' ? withBarLabel(ctx.pref, custom(ctx)) : custom(ctx);
}

function renderBuiltin(
  ctx: PrefRenderContext,
  renderers: Record<string, PrefRenderer> | undefined,
  // The object a nested leaf is a field of — what an enum `encoding` and a
  // font's weight and slant read against. Undefined for a top-level leaf.
  siblings?: Record<string, unknown>,
  surface: LeafSurface = 'row',
): ReactNode {
  const { pref, value, setValue } = ctx;
  if (surface === 'bar') {
    return renderBarLeaf({
      leaf: pref,
      path: ctx.path,
      name: pref.name,
      field: leafField(ctx, siblings),
      disabled: ctx.disabled,
      row: () => renderBuiltin(ctx, renderers, siblings),
    });
  }
  const object = (of: PrefRenderContext): ReactNode => (
    <ObjectLeaf
      ctx={of}
      renderField={(field, held, on) => renderPrefControl(field, renderers, held, on)}
      isGroup={(field, held) => rowIsGroup(field, renderers, held)}
      rowWidth={(leaf) => rowWidthOf(leaf, renderers)}
    />
  );
  if (pref.kind === 'object') return object(ctx);
  if (ctx.mixed && (pref.kind === 'list' || pref.kind === 'map')) return <PrefMixed onReplace={ctx.disabled ? undefined : () => ctx.setValue(pref.kind === 'list' ? [] : {})} />;
  if (pref.kind === 'list')
    return <ListLeaf ctx={ctx} renderers={renderers} renderItem={(item) => renderPrefControl(item, renderers)} />;
  if (pref.kind === 'map') {
    const map = pref as PrefMap;
    return (
      <MapEditor
        pref={map}
        value={value}
        onChange={setValue}
        disabled={ctx.disabled}
        renderValue={(held, set, name, key) => {
          const { item, ...conditions } = entryConditions(ctx, `${ctx.path}.${key}`, map.item, held);
          return renderPrefControl(
            { ...ctx, ...conditions, path: `${ctx.path}.${key}`, pref: { ...item, name }, value: held, setValue: set },
            renderers,
          );
        }}
      />
    );
  }
  if (pref.kind === 'union') {
    return (
      <UnionPicker pref={pref as PrefUnion} value={value} mixed={ctx.mixed} disabled={ctx.disabled} onChange={setValue}>
        {(variant) => object({ ...ctx, pref: variant })}
      </UnionPicker>
    );
  }
  if (pref.kind === 'action') return <PrefActionButton pref={pref as PrefAction} path={ctx.path} disabled={ctx.disabled} />;
  if (pref.kind === 'actions') return <PrefActionRows pref={pref as PrefActions} path={ctx.path} disabled={ctx.disabled} />;
  const field = leafField(ctx, siblings);
  if (field === null) {
    // App-defined kind with no `renderers` entry: labeled placeholder, not a
    // crash — a missing wiring should be visible and recoverable.
    return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
  if (field.kind === 'number') {
    return <PropertyControl {...field} name={pref.name} steppers={field.accepts === undefined} />;
  }
  return <PropertyControl {...withRowControl(field, 'form')} name={pref.name} />;
}

/** Whether a leaf's row is a group and not a `<label>`: its control is several, or one a label may not wrap. */
function rowIsGroup(
  ctx: PrefRenderContext,
  renderers: Record<string, PrefRenderer> | undefined,
  siblings?: Record<string, unknown>,
): boolean {
  if (prefDrawsSeveral(ctx.pref)) return true;
  const custom = renderers?.[ctx.pref.kind];
  if (custom) return custom.group === true;
  const field = leafField(ctx, siblings);
  return field !== null && controlIsGroup(field);
}

/** A leaf as one control's props, writing when a form writes. Null for a leaf that is not one control. */
function leafField(ctx: PrefRenderContext, siblings: Record<string, unknown> | undefined): PropertyControlProps | null {
  return prefFieldProps(
    ctx.pref,
    { value: ctx.value, mixed: ctx.mixed, siblings, setValue: ctx.setValue, fields: ctx.fields, disabled: ctx.disabled },
    'form',
    ctx.settles,
  );
}
