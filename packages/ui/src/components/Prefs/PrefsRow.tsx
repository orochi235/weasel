import { type ReactNode } from 'react';
import {
  prefAliasedLeaf,
  prefAliasTarget,
  prefValueAtPath,
  type PrefAction,
  type PrefAlias,
  type PrefLeaf,
  type PrefMap,
  type PrefUnion,
  prefDrawsSeveral,
} from '@weasel-js/prefs';
import { renderBarLeaf, withBarLabel, type LeafSurface } from '../Bar/renderBarLeaf';
import { PrefActionButton } from './PrefActionButton';
import { PrefMixed } from './PrefMixed';
import { prefDrawsNoControl, PrefWords } from './PrefWords';
import { drawsRows } from './compound';
import { ListLeaf } from './ListLeaf';
import { MapEditor } from './MapEditor';
import { ObjectLeaf } from './ObjectLeaf';
import { UnionPicker } from './UnionPicker';
import { controlIsGroup, PropertyControl, type PropertyControlProps } from '../Properties/PropertyField';
import { PropertyRow } from '../Properties/PropertyPanel';
import { prefFieldProps } from './prefField';
import type { PrefFieldChoice } from './schema';
import { dropValuePath, type PrefDrop } from './drop';
import { selectionAttrs } from './selection';
import s from './Prefs.module.css';

/** What a {@link PrefRenderer} is given for the leaf it is rendering. */
export interface PrefRenderContext {
  /** Dotted path of the leaf within the schema root. */
  path: string;
  /** The schema node. App renderers narrow this to their own kind shape. */
  pref: PrefLeaf;
  /** Current value — `values` at `path`, falling back to `pref.default`. */
  value: unknown;
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
}

/**
 * Renders the control cell for one preference leaf. Returning `null`
 * collapses the row.
 */
export type PrefRenderer = ((ctx: PrefRenderContext) => ReactNode) & {
  /** The control is several, or one a `<label>` may not wrap: its row is a group, and each control carries its own name. */
  group?: boolean;
};

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
  /** The leaf whose value lives at a path, anywhere in the form's schema: what an alias is resolved against. */
  leafAt?: (path: string) => PrefLeaf | undefined;
  /** Paths of the rows whose labels are drawn as changed. */
  changed?: ReadonlySet<string>;
  /** Paths of the rows and groups the form marks as selected. */
  selected?: readonly string[];
  /** The one of `selected` the form brings into view and opens the page of. */
  lead?: string | null;
  /** The drop the form is drawing. */
  drop?: PrefDrop | null;
  /** Paths of the leaves, fields, and groups a failed `enableIf` disables. */
  disabled?: ReadonlySet<string>;
}

/**
 * The leaf a form draws for `pref`, and where its value lives when that is not the leaf's own path: an alias is
 * drawn as the leaf it points at. Null for an alias of nothing.
 */
export function shownLeaf(ctx: WalkCtx, pref: PrefLeaf): { pref: PrefLeaf; at?: string } | null {
  if (pref.kind !== 'alias' || ctx.renderers?.alias) return { pref };
  const alias = pref as PrefAlias;
  const target = prefAliasTarget(alias, ctx.leafAt ?? (() => undefined));
  return target ? { pref: prefAliasedLeaf(alias, target.leaf), at: target.path } : null;
}

export function PrefRow({ ctx, path, pref }: { ctx: WalkCtx; path: string; pref: PrefLeaf }) {
  const shown = shownLeaf(ctx, pref);
  if (shown) return <LeafRow ctx={ctx} path={path} pref={shown.pref} at={shown.at} />;
  const alias = pref as PrefAlias;
  // An alias of nothing is a wiring fault, shown where it sits and not dropped from the form.
  return (
    <div className={s.rowSlot} {...selectionAttrs(path, ctx, true)}>
      <PropertyRow label={alias.name === '' ? 'Alias' : alias.name} description={alias.description} className={s.row}>
        <span className={s.unrenderable}>(alias: no pref at {alias.of === '' ? 'an empty path' : alias.of})</span>
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
  const toggles = onAutoChange !== undefined && pref.manual !== true && (ctx.canInherit?.(path) ?? true);
  const renderCtx: PrefRenderContext = {
    path,
    pref,
    value: mixed ? undefined : stored !== undefined ? stored : pref.default,
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
    disabledAt: (at) => ctx.disabled?.has(at) ?? false,
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

  const custom = ctx.renderers?.[pref.kind];
  if (prefDrawsNoControl(pref) && !custom) {
    return (
      <div className={s.rowSlot} data-wide="" {...selectionAttrs(own, ctx, true)}>
        <PrefWords pref={pref} />
      </div>
    );
  }
  const control = custom ? custom(renderCtx) : renderBuiltin(renderCtx, ctx.renderers);
  if (custom && control === null) return null;

  const stacked = drawsRows(pref);

  // `block` leaves own their chrome (embedded editors with their own
  // header) — no label/tooltip row.
  if (pref.block) return <div className={s.rowSlot} data-wide="" {...selectionAttrs(own, ctx, true)}>{control}</div>;

  return (
    <div className={s.rowSlot} data-wide={pref.kind === 'object' || stacked || Array.isArray(pref.default) ? '' : undefined} {...selectionAttrs(own, ctx, true)}>
    <PropertyRow
      label={pref.name}
      changed={ctx.changed?.has(path)}
      description={pref.description}
      layout={stacked ? 'block' : 'inline'}
      className={stacked ? `${s.row} ${s.rowStacked}` : s.row}
      group={rowIsGroup(renderCtx, ctx.renderers)}
      // The owner passes an inherited leaf's value already resolved, so the
      // control keeps drawing it; editing it pins, through `onChange`.
      auto={inherited}
      autoControl="dimmed"
      onAutoChange={toggles ? setAuto : undefined}
      hint={inherited ? ctx.inheritHint?.(path) : undefined}
      disabled={renderCtx.disabled}
    >
      <span className={s.rowControl}>{control}</span>
    </PropertyRow>
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
    />
  );
  if (pref.kind === 'object') return object(ctx);
  if (ctx.mixed && (pref.kind === 'list' || pref.kind === 'map')) return <PrefMixed />;
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
        renderValue={(held, set, name, key) =>
          renderPrefControl({ ...ctx, path: `${ctx.path}.${key}`, pref: { ...map.item, name }, value: held, setValue: set }, renderers)
        }
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
  const field = leafField(ctx, siblings);
  if (field === null) {
    // App-defined kind with no `renderers` entry: labeled placeholder, not a
    // crash — a missing wiring should be visible and recoverable.
    return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
  if (field.kind === 'number') {
    return <PropertyControl {...field} name={pref.name} steppers={field.accepts === undefined} />;
  }
  return <PropertyControl {...field} name={pref.name} />;
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

/**
 * A leaf as one control's props, writing the way a form stores: what was
 * settled on, a number once it is entered and a color once its gesture ends.
 * Null for a leaf that is not one control.
 */
function leafField(ctx: PrefRenderContext, siblings: Record<string, unknown> | undefined): PropertyControlProps | null {
  const field = prefFieldProps(ctx.pref, { value: ctx.value, mixed: ctx.mixed, siblings, setValue: ctx.setValue, fields: ctx.fields, disabled: ctx.disabled });
  return field?.kind === 'number' || field?.kind === 'color' ? { ...field, onInput: settledOnly } : field;
}

const settledOnly = (): void => {};
