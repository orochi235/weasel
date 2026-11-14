import { type ReactNode } from 'react';
import {
  prefAliasName,
  prefLeafValue,
  prefValueAtPath,
  type PrefAlias,
  type PrefAliasTargets,
  type PrefLeaf,
  type PrefsSource,
  prefDrawsSeveral,
} from '@weasel-js/prefs';
import type { BarCell, BarLeafNode } from '../PrefsBar/barNodes';
import type { ControlForm } from '../ActionButton/controlForm';
import { prefDrawsActionRow } from './registeredActions';
import { aliasOfNothing, prefDrawsNoControl, PrefWords } from './PrefWords';
import { rowWidthOf } from './compound';
import type { EntryAt } from './entry';
import { leafAtValues } from './leafAtValues';
import { ObjectLeaf } from './ObjectLeaf';
import { controlIsGroup, PropertyControl } from '../Properties/PropertyField';
import { PropertyRow } from '../Properties/PropertyRow';
import { RowScope } from '../Properties/rowScope';
import type { LiveControl } from './commitPolicy';
import { leafField } from './leafField';
import { renderLeaf, renderLeafControl, type LeafParts } from './renderLeaf';
import type { PrefFieldChoice } from './schema';
import { dropValuePath, type PrefDrop } from './drop';
import { HiddenBadge, marksHidden } from './hidden';
import { withRowControl } from './surfaceControls';
import { autoTracked, rowReset } from './reset';
import { selectionAttrs } from './selection';
import { SplitBody, SplitHead, SplitMarks, SplitToggle, splitRowState } from './SplitRow';
import type { SplitCtx } from './splitRows';
import s from './Prefs.module.css';

import type { LeafContext, LeafRenderer } from './renderContext';

export type { LeafContext, LeafRenderer };

/** What a prefs form hands every row it draws: the values, the callbacks, and how the form is set up. */
export interface WalkCtx {
  /** Where the form reads, writes, and resets its leaves. */
  source: PrefsSource;
  values: unknown;
  onChange: (path: string, value: unknown) => void;
  renderers?: Record<string, LeafRenderer>;
  auto?: ReadonlySet<string>;
  mixed?: ReadonlySet<string>;
  onAutoChange?: (path: string, next: boolean) => void;
  /** Puts the leaf or the group at a path back as its schema says, where the owner does that itself. */
  onReset?: (path: string) => void;
  inheritHint?: (path: string) => string | undefined;
  canInherit?: (path: string) => boolean;
  fields?: readonly PrefFieldChoice[];
  /** The schema the form's aliases point into, as its conditions leave it: what an alias row is drawn from. */
  targets?: PrefAliasTargets;
  /** Paths of the rows whose labels are drawn as changed. */
  changed?: ReadonlySet<string>;
  /** What is wrong with a row's value, by its path. */
  errors?: ReadonlyMap<string, ReactNode>;
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
  /** Paths of the actions whose `activeIf` holds. */
  active?: ReadonlySet<string>;
  /** Paths of the leaves, fields, and groups a failed `showIf` hides, in a form that draws them marked. */
  hidden?: ReadonlySet<string>;
  /** The form draws a leaf marked `hidden` (`PrefsForm`'s `showHidden`). */
  showHidden?: boolean;
  /** The form draws a group with no row in it (`PrefsForm`'s `showEmpty`). */
  keepEmpty?: boolean;
  /** Answers the conditions that read an entry of a list or a map, for that entry. */
  entryAt?: EntryAt;
  /** Which live controls write only the value an edit settles on. */
  settles?: Readonly<Record<LiveControl, boolean>>;
  /** How long live text waits for the next keystroke before it is written, in ms. */
  textWaitMs?: number;
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
): { renderCtx: LeafContext; toggles: boolean } {
  const path = at ?? own;
  // A placeholder shows what its node shows where it was dragged from.
  const from = at ?? dropValuePath(ctx.drop, own);
  const stored = prefValueAtPath(ctx.values, from);
  const mixed = ctx.mixed?.has(from) ?? false;
  const { onAutoChange } = ctx;
  const inside = at === undefined ? undefined : ctx.targets;
  const entryAt = inside?.entryAt ?? ctx.entryAt;
  const toggles = autoTracked(ctx, path);
  const value = mixed ? undefined : prefLeafValue(pref, stored);
  const reset = rowReset(ctx, path, pref);
  const renderCtx: LeafContext = {
    path,
    pref: leafAtValues(pref, ctx.values),
    source: ctx.source,
    value,
    each: mixed ? [] : [value],
    values: ctx.values,
    ...(ctx.changed?.has(path) ? { changed: true } : {}),
    mixed,
    setValue: (v) => ctx.onChange(path, v),
    update: (fn) => ctx.source.update(path, fn),
    ...(reset ? { reset } : {}),
    mixedAt: (at, below = false) => pathIsMixed(ctx.mixed, from + at.slice(path.length), below),
    setValueAt: ctx.onChange,
    auto: ctx.auto?.has(from) ?? false,
    setAuto: (next) => {
      if (toggles) onAutoChange?.(path, next);
    },
    ...(ctx.fields ? { fields: ctx.fields } : {}),
    disabled: ctx.disabled?.has(own) ?? false,
    // The row answers by the form's own schema, at its own path; what is inside an alias's by its target's.
    disabledAt: inside?.disabledAt ?? ((at) => ctx.disabled?.has(at) ?? false),
    ...(ctx.active?.has(own) ? { active: true } : {}),
    ...(ctx.active ? { activeAt: (at: string) => ctx.active!.has(at) } : {}),
    ...(ctx.hidden ? { hidden: ctx.hidden.has(own), hiddenAt: inside?.hiddenAt ?? ((at: string) => ctx.hidden!.has(at)) } : {}),
    ...(entryAt ? { entryAt } : {}),
    ...(ctx.settles ? { settles: ctx.settles } : {}),
    ...(ctx.textWaitMs ? { textWaitMs: ctx.textWaitMs } : {}),
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
    {/* An inherited leaf's value comes already resolved, so the control keeps drawing it; an edit pins. */}
    <RowScope changed={ctx.changed?.has(path)} error={ctx.errors?.get(path)} auto={inherited}
      onAutoChange={toggles ? setAuto : undefined} onReset={renderCtx.reset}>
    <PropertyRow
      label={pref.name}
      mixed={renderCtx.mixedAt?.(path, true)}
      description={pref.description}
      layout={stacked ? 'block' : 'inline'}
      className={stacked ? `${s.row} ${s.rowStacked}` : s.row}
      group={rowIsGroup(renderCtx, ctx.renderers)}
      hint={marked || split ? <>{marked && <HiddenBadge />}{inheritHint}{split && <SplitMarks levels={split.shape.levels} />}</> : inheritHint}
      disabled={renderCtx.disabled}
      disabledReason={pref.disabledReason}
    >
      <span className={width === 'filled' ? `${s.rowControl} ${s.rowControlFilled}` : s.rowControl}>
        {control}
        {split && <SplitToggle state={split} onToggle={toggleSplit} />}
      </span>
    </PropertyRow>
    </RowScope>
    {members}
    </div>
  );
}

/** What a form draws its own way around the one leaf switch: an object leaf's rows, and a field's control. */
function formParts(renderers: Record<string, LeafRenderer> | undefined): LeafParts {
  return {
    surface: 'form',
    renderers,
    object: (ctx) => (
      <ObjectLeaf
        ctx={ctx}
        renderField={(field, held, on) => renderPrefControl(field, renderers, held, on)}
        isGroup={(field, held) => rowIsGroup(field, renderers, held)}
        rowWidth={(leaf) => rowWidthOf(leaf, renderers)}
      />
    ),
    control: (field, _ctx, name) =>
      field.kind === 'number'
        ? <PropertyControl {...field} name={name} steppers={field.accepts === undefined} />
        : <PropertyControl {...withRowControl(field, 'form')} name={name} />,
  };
}

const within = (ctx: LeafContext, siblings: Record<string, unknown> | undefined): LeafContext =>
  (siblings === undefined ? ctx : { ...ctx, siblings });

/** A leaf's control with no row around it, as it is drawn nested in another's value: by the app's renderer for its
 *  kind, where it has one. `siblings` is the object it is a field of. */
export function renderPrefControl(
  ctx: LeafContext,
  renderers: Record<string, LeafRenderer> | undefined,
  siblings?: Record<string, unknown>,
  surface: ControlForm = 'row',
): ReactNode {
  return renderLeafControl(within(ctx, siblings), formParts(renderers), surface);
}

function renderBuiltin(ctx: LeafContext, renderers: Record<string, LeafRenderer> | undefined): ReactNode {
  return renderLeaf(ctx, formParts(renderers));
}

/** Whether a leaf's row is a group and not a `<label>`: its control is several, or one a label may not wrap. */
function rowIsGroup(
  ctx: LeafContext,
  renderers: Record<string, LeafRenderer> | undefined,
  siblings?: Record<string, unknown>,
): boolean {
  if (prefDrawsSeveral(ctx.pref)) return true;
  const custom = renderers?.[ctx.pref.kind];
  if (custom) return typeof custom.group === 'function' ? custom.group(ctx) : custom.group === true;
  const field = leafField(within(ctx, siblings), 'form');
  return field !== null && controlIsGroup(field);
}
