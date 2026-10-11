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
} from '@weasel-js/prefs';
import { PrefActionButton } from './PrefActionButton';
import { drawsRows, drawsSeveral } from './compound';
import { ListLeaf } from './ListLeaf';
import { MapEditor } from './MapEditor';
import { ObjectLeaf } from './ObjectLeaf';
import { UnionPicker } from './UnionPicker';
import { PropertyControl } from '../Properties/PropertyField';
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
  setValue: (value: unknown) => void;
  /** Whether this leaf is currently auto — not pinned, computed by the owner. */
  auto: boolean;
  /** Toggle this leaf's auto state. */
  setAuto: (next: boolean) => void;
  /** The form's fields, which a `field` leaf names one of. */
  fields?: readonly PrefFieldChoice[];
}

/**
 * Renders the control cell for one preference leaf. Returning `null`
 * collapses the row.
 */
export type PrefRenderer = (ctx: PrefRenderContext) => ReactNode;

export interface WalkCtx {
  values: unknown;
  onChange: (path: string, value: unknown) => void;
  renderers?: Record<string, PrefRenderer>;
  auto?: ReadonlySet<string>;
  onAutoChange?: (path: string, next: boolean) => void;
  inheritHint?: (path: string) => string | undefined;
  canInherit?: (path: string) => boolean;
  fields?: readonly PrefFieldChoice[];
  /** The leaf whose value lives at a path, anywhere in the form's schema: what an alias is resolved against. */
  leafAt?: (path: string) => PrefLeaf | undefined;
  /** Paths of the rows whose labels are drawn as changed. */
  changed?: ReadonlySet<string>;
  /** Path of the row or group the form marks as selected. */
  selected?: string | null;
  /** The drop the form is drawing. */
  drop?: PrefDrop | null;
}

export function PrefRow({ ctx, path, pref }: { ctx: WalkCtx; path: string; pref: PrefLeaf }) {
  if (pref.kind !== 'alias' || ctx.renderers?.alias) return <LeafRow ctx={ctx} path={path} pref={pref} />;
  const alias = pref as PrefAlias;
  const target = prefAliasTarget(alias, ctx.leafAt ?? (() => undefined));
  if (target) return <LeafRow ctx={ctx} path={path} pref={prefAliasedLeaf(alias, target.leaf)} at={target.path} />;
  // An alias of nothing is a wiring fault, shown where it sits and not dropped from the form.
  return (
    <div className={s.rowSlot} {...selectionAttrs(path, ctx, true)}>
      <PropertyRow label={alias.name === '' ? 'Alias' : alias.name} description={alias.description} className={s.row}>
        <span className={s.unrenderable}>(alias: no pref at {alias.of === '' ? 'an empty path' : alias.of})</span>
      </PropertyRow>
    </div>
  );
}

/** One leaf's row. `at` is where its value lives when that is not the row's own `path`: the target of an alias. */
function LeafRow({ ctx, path: own, pref, at }: { ctx: WalkCtx; path: string; pref: PrefLeaf; at?: string }) {
  const path = at ?? own;
  // A placeholder shows what its node shows where it was dragged from.
  const from = at ?? dropValuePath(ctx.drop, own);
  const stored = prefValueAtPath(ctx.values, from);
  const inherited = ctx.auto?.has(from) ?? false;
  const { onAutoChange } = ctx;
  const toggles = onAutoChange !== undefined && pref.manual !== true && (ctx.canInherit?.(path) ?? true);
  const setAuto = (next: boolean): void => {
    if (toggles) onAutoChange(path, next);
  };
  const renderCtx: PrefRenderContext = {
    path,
    pref,
    value: stored !== undefined ? stored : pref.default,
    setValue: (v) => ctx.onChange(path, v),
    auto: inherited,
    setAuto,
    ...(ctx.fields ? { fields: ctx.fields } : {}),
  };

  const custom = ctx.renderers?.[pref.kind];
  // Text among the rows, holding no value: its name is the line and its description the note under it.
  if (pref.kind === 'label' && !custom) {
    return (
      <div className={`${s.rowSlot} ${s.labelRow}`} data-wide="" {...selectionAttrs(own, ctx, true)}>
        <span className={s.labelText}>{pref.name}</span>
        {pref.description !== '' && <span className={s.paneDesc}>{pref.description}</span>}
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
      changed={ctx.changed?.has(own)}
      description={pref.description}
      layout={stacked ? 'block' : 'inline'}
      className={s.row}
      group={drawsSeveral(pref)}
      // The owner passes an inherited leaf's value already resolved, so the
      // control keeps drawing it; editing it pins, through `onChange`.
      auto={inherited}
      autoControl="dimmed"
      onAutoChange={toggles ? setAuto : undefined}
      hint={inherited ? ctx.inheritHint?.(path) : undefined}
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
): ReactNode {
  const custom = renderers?.[ctx.pref.kind];
  return custom ? custom(ctx) : renderBuiltin(ctx, renderers, siblings);
}

function renderBuiltin(
  ctx: PrefRenderContext,
  renderers: Record<string, PrefRenderer> | undefined,
  // The object a nested leaf is a field of — what an enum `encoding` and a
  // font's weight and slant read against. Undefined for a top-level leaf.
  siblings?: Record<string, unknown>,
): ReactNode {
  const { pref, value, setValue } = ctx;
  const object = (of: PrefRenderContext): ReactNode => (
    <ObjectLeaf ctx={of} renderField={(field, held) => renderPrefControl(field, renderers, held)} />
  );
  if (pref.kind === 'object') return object(ctx);
  if (pref.kind === 'list')
    return <ListLeaf ctx={ctx} renderers={renderers} renderItem={(item) => renderPrefControl(item, renderers)} />;
  if (pref.kind === 'map') {
    const map = pref as PrefMap;
    return (
      <MapEditor
        pref={map}
        value={value}
        onChange={setValue}
        renderValue={(held, set, name, key) =>
          renderPrefControl({ ...ctx, path: `${ctx.path}.${key}`, pref: { ...map.item, name }, value: held, setValue: set }, renderers)
        }
      />
    );
  }
  if (pref.kind === 'union') {
    return (
      <UnionPicker pref={pref as PrefUnion} value={value} onChange={setValue}>
        {(variant) => object({ ...ctx, pref: variant })}
      </UnionPicker>
    );
  }
  if (pref.kind === 'action') return <PrefActionButton pref={pref as PrefAction} path={ctx.path} />;
  const field = prefFieldProps(pref, { value, siblings, setValue, fields: ctx.fields });
  if (field === null) {
    // App-defined kind with no `renderers` entry: labeled placeholder, not a
    // crash — a missing wiring should be visible and recoverable.
    return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
  switch (field.kind) {
    // A form stores what was settled on: a number once it is entered, a color
    // once its gesture ends.
    case 'number':
      return (
        <PropertyControl
          {...field}
          name={pref.name}
          onInput={settledOnly}
          steppers={field.accepts === undefined}
        />
      );
    case 'color':
      return <PropertyControl {...field} name={pref.name} onInput={settledOnly} />;
    default:
      return <PropertyControl {...field} name={pref.name} />;
  }
}

const settledOnly = (): void => {};
