/**
 * The one switch from a leaf's kind to what draws it, for every params surface. A surface hands in the parts
 * that are its own: how an object leaf lays out its fields, and how a one-control field is sized.
 */
import type { ReactNode } from 'react';
import { prefVariantOf, type PrefAction, type PrefActions, type PrefAlias, type PrefLeaf, type PrefMap, type PrefUnion } from '@weasel-js/prefs';
import { renderBarLeaf, withBarLabel, type LeafSurface } from '../Bar/renderBarLeaf';
import type { PropertyControlProps } from '../Properties/PropertyField';
import type { ParamsSurface } from './commitPolicy';
import { entryConditions } from './entry';
import { leafField } from './leafField';
import { ListLeaf } from './ListLeaf';
import { MapEditor } from './MapEditor';
import { PrefActionButton, PrefActionRows } from './PrefActionButton';
import { PrefMixed } from './PrefMixed';
import { aliasOfNothing, prefDrawsNoControl, PrefWords } from './PrefWords';
import type { LeafContext, LeafRenderer } from './renderContext';
import { UnionPicker } from './UnionPicker';
import s from './Prefs.module.css';

/** What a surface draws its own way, around the one switch. */
export interface LeafParts {
  /** Which surface's control policy the fields follow. */
  surface: ParamsSurface;
  renderers?: Record<string, LeafRenderer>;
  /** An object leaf's fields, and a union's chosen variant's. */
  object: (ctx: LeafContext) => ReactNode;
  /** A one-control field, sized the surface's way. `name` is its accessible name. */
  control: (field: PropertyControlProps, ctx: LeafContext, name: string) => ReactNode;
  /** A field of an object leaf over a selection: its paint's "None" removes the field. */
  nested?: boolean;
}

/** What a leaf drawn inside this one's value is told: an entry of a list or a map, holding one value of its own,
 *  under the conditions over that entry. */
export function entryContext(
  ctx: LeafContext, key: string | number, item: PrefLeaf, value: unknown, set: (next: unknown) => void, name?: string,
): LeafContext {
  const path = `${ctx.path}.${key}`;
  const { item: drawn, ...conditions } = entryConditions(ctx, path, item, value);
  return {
    ...ctx,
    ...conditions,
    path,
    pref: name === undefined ? drawn : { ...drawn, name },
    value,
    mixed: false,
    unset: value === undefined,
    each: [value],
    siblings: undefined,
    eachSiblings: undefined,
    mixedAt: undefined,
    setValueAt: undefined,
    setValue: set,
    update: (fn) => set(fn(value)),
    drafts: undefined,
    reset: undefined,
    inherit: undefined,
  };
}

/** A leaf drawn inside another's value: by the surface's renderer for its path or its kind, else the built-in. */
export function renderNestedLeaf(ctx: LeafContext, parts: LeafParts, name = ctx.pref.name): ReactNode {
  const custom = parts.renderers?.[ctx.path] ?? parts.renderers?.[ctx.pref.kind];
  return custom ? custom(ctx) : renderLeaf(ctx, { ...parts, nested: true }, name);
}

/** A built-in leaf's control: its bar form where `bar`, else its row form. `name` is its accessible name. */
export function renderLeaf(ctx: LeafContext, parts: LeafParts, name = ctx.pref.name, bar: LeafSurface = 'row'): ReactNode {
  const { pref, value, mixed, setValue } = ctx;
  if (bar === 'bar') {
    return renderBarLeaf({
      leaf: pref,
      path: ctx.path,
      name,
      field: leafField(ctx, parts.surface, parts.nested),
      disabled: ctx.disabled,
      active: ctx.active,
      row: () => renderLeaf(ctx, parts, name),
    });
  }
  if (pref.kind === 'object') return parts.object(ctx);
  if (mixed && (pref.kind === 'list' || pref.kind === 'map')) {
    return <PrefMixed onReplace={ctx.disabled ? undefined : () => setValue(pref.kind === 'list' ? [] : {})} />;
  }
  if (pref.kind === 'list') {
    return (
      <ListLeaf
        ctx={ctx}
        drawsStrings={parts.renderers?.string !== undefined}
        renderItem={(item) => renderNestedLeaf(item, parts)}
      />
    );
  }
  if (pref.kind === 'map') {
    const map = pref as PrefMap;
    return (
      <MapEditor
        pref={map}
        value={value}
        onChange={setValue}
        disabled={ctx.disabled}
        renderValue={(held, set, entryName, key) => renderNestedLeaf(entryContext(ctx, key, map.item, held, set, entryName), parts)}
      />
    );
  }
  if (pref.kind === 'union') {
    const union = pref as PrefUnion;
    // Targets of different variants share no fields to draw.
    const split = mixed && (ctx.each.length < 2 || new Set(ctx.each.map((v) => prefVariantOf(union, v)?.[0])).size > 1);
    return (
      <UnionPicker pref={union} value={mixed ? ctx.each[0] : value} mixed={split} disabled={ctx.disabled} onChange={setValue}>
        {(variant, key) =>
          parts.object({
            ...ctx,
            pref: variant,
            // A target holding no object yet is built from the variant's default, which carries no tag.
            update: (fn) =>
              ctx.update((prev, siblings) => {
                const next = fn(prev, siblings);
                return next !== null && typeof next === 'object' ? { ...next, [union.tag]: key } : next;
              }),
          })
        }
      </UnionPicker>
    );
  }
  if (pref.kind === 'action') return <PrefActionButton pref={pref as PrefAction} path={ctx.path} disabled={ctx.disabled} active={ctx.active} />;
  if (pref.kind === 'actions') return <PrefActionRows pref={pref as PrefActions} path={ctx.path} disabled={ctx.disabled} />;
  if (prefDrawsNoControl(pref)) return <PrefWords pref={pref} />;
  // A surface draws a resolved alias as its target, so one that reaches here points at nothing.
  if (pref.kind === 'alias') return <span className={s.unrenderable}>{aliasOfNothing(pref as PrefAlias)}</span>;
  const field = leafField(ctx, parts.surface, parts.nested);
  // App-defined kind with no `renderers` entry: a labeled placeholder, not a crash.
  if (field === null) return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  return parts.control(field, ctx, name);
}

/** A leaf's renderer for its kind where the surface has one, else the built-in; for a bar, with its words. */
export function renderLeafControl(ctx: LeafContext, parts: LeafParts, bar: LeafSurface = 'row', name?: string): ReactNode {
  const custom = parts.renderers?.[ctx.pref.kind];
  if (!custom) return renderLeaf(ctx, parts, name, bar);
  return bar === 'bar' ? withBarLabel(ctx.pref, custom(ctx)) : custom(ctx);
}
