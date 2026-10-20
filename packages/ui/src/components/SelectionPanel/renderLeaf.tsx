/**
 * One `PrefLeaf` and its aggregated value in, its control out, sized and
 * composed the way a selection surface draws it. The control itself is
 * `PropertyControl`'s, through `prefFieldProps`. `ToolOptionsBar` renders a
 * tool's options through the same function.
 */
import type { ReactNode } from 'react';
import { type PrefAction, type PrefActions, type PrefAlias, type PrefMap, type PrefUnion, prefVariantOf } from '@weasel-js/prefs';
import { entryConditions } from '../Prefs/entry';
import { MapEditor } from '../Prefs/MapEditor';
import { PrefActionButton, PrefActionRows } from '../Prefs/PrefActionButton';
import { PrefMixed } from '../Prefs/PrefMixed';
import { aliasOfNothing, prefDrawsNoControl, PrefWords } from '../Prefs/PrefWords';
import { withRowControl } from '../Prefs/surfaceControls';
import { UnionPicker } from '../Prefs/UnionPicker';
import { renderBarLeaf, type LeafSurface } from '../Bar/renderBarLeaf';
import { PropertyControl } from '../Properties/PropertyField';
import { leafField } from './leafField';
import { ListLeaf } from './ListLeaf';
import { ObjectLeaf } from './ObjectLeaf';
import type { PropertyRenderContext, PropertyRenderer } from './renderContext';
import s from './SelectionPanel.module.css';

export interface RenderBuiltinOptions {
  /** Identifies the current selection, so a control holding per-selection
   *  scratch (the paint kind memory) is remounted rather than carried over. */
  selectionKey?: string;
  /** True for a field of an object leaf, which writes itself into its parent:
   *  "None" on a nested paint removes the field. */
  nested?: boolean;
  surface?: LeafSurface;
}

/** What the entry at `key` of the map `ctx` draws is told: one value of its own, under the conditions over that entry. */
function mapEntryContext(
  ctx: PropertyRenderContext, map: PrefMap, key: string, held: unknown, set: (next: unknown) => void,
): PropertyRenderContext {
  const { item, ...conditions } = entryConditions(ctx, `${ctx.path}.${key}`, map.item, held);
  return {
    ...ctx,
    ...conditions,
    path: `${ctx.path}.${key}`,
    pref: item,
    value: held,
    mixed: false,
    unset: held === undefined,
    siblings: undefined,
    each: [held],
    eachSiblings: undefined,
    setValue: set,
    update: (fn) => set(fn(held)),
  };
}

/** A built-in leaf's bar form, with its row form for what a bar opens it in. */
function renderBuiltinInBar(
  ctx: PropertyRenderContext,
  ariaLabel: string,
  renderers: Record<string, PropertyRenderer> | undefined,
  row: RenderBuiltinOptions,
): ReactNode {
  return renderBarLeaf({
    leaf: ctx.pref,
    path: ctx.path,
    name: ariaLabel,
    field: leafField(ctx, row.nested ?? false),
    disabled: ctx.disabled,
    row: () => renderBuiltin(ctx, ariaLabel, renderers, row),
  });
}

export function renderBuiltin(
  ctx: PropertyRenderContext,
  ariaLabel: string,
  renderers?: Record<string, PropertyRenderer>,
  { selectionKey = '', nested = false, surface = 'row' }: RenderBuiltinOptions = {},
): ReactNode {
  const { pref, value, mixed, setValue } = ctx;
  if (surface === 'bar') return renderBuiltinInBar(ctx, ariaLabel, renderers, { selectionKey, nested });
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
          const item = mapEntryContext(ctx, map, key, held, set);
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
  if (pref.kind === 'actions') return <PrefActionRows pref={pref as PrefActions} path={ctx.path} disabled={ctx.disabled} />;
  if (prefDrawsNoControl(pref)) return <PrefWords pref={pref} />;
  if (pref.kind === 'alias') {
    // The panel draws a resolved alias as its target, so one that reaches here points at nothing.
    return <span className={s.unrenderable}>{aliasOfNothing(pref as PrefAlias)}</span>;
  }
  const field = leafField(ctx, nested);
  if (field === null) {
    return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
  switch (field.kind) {
    case 'boolean':
      return (
        <PropertyControl
          {...withRowControl(field, 'panel')}
          name={ariaLabel}
          className={field.control === 'toggle' ? s.flagToggle : undefined}
        />
      );
    case 'number':
      return (
        <PropertyControl {...field} name={ariaLabel} className={field.control === 'slider' ? s.slider : undefined} />
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
              : undefined
          }
        />
      );
    case 'font-family':
    case 'font-weight':
      return <PropertyControl {...field} name={ariaLabel} />;
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
