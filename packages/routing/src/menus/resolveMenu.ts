import type { MenuEntry } from '@weasel-js/menu';
import {
  isPrefLeaf, PREF_SCOPE, prefAliasedLeaf, prefAliasTarget, prefConditionHolds, prefDisplayBounds, prefLeafAt,
  prefNumberAt, prefScopeIn, prefScopeUnder, prefUnitAccepts, prefValueAtPath, resolvePrefUnit,
  type PrefConditionJudge, type PrefOwner,
  type PrefAction, type PrefBoolean, type PrefColor, type PrefConditionReader, type PrefEnum, type PrefGroup,
  type PrefGroupAs, type PrefLeaf, type PrefNumber, type PrefString,
} from '@weasel-js/prefs';
import type { Action } from '../interactions/actions/action';
import type { ActionDeps } from '../interactions/actions/invoker';
import { actionItems, type ActionItem } from '../interactions/actions/actionItems';
import { actionShortcuts } from '../interactions/actions/actionShortcuts';
import { evaluateActive, evaluateEnabled } from '../interactions/actions/actionEnabled';
import { actionSettingsParams, readActionSettings } from '../interactions/actions/actionSettings';
import { endlessAllows } from '@weasel-js/quantity';
import { isDev } from '@weasel-js/react';
import type { MenuDef } from './types';
import type { Point } from '@weasel-js/geom';

/** What resolving reads: the registered actions, each one's deps, how to run
 *  one, and the values behind the schema's value leaves. */
export interface MenuSources {
  actions(): readonly Action[];
  depsFor(action: Action): ActionDeps | undefined;
  trigger(id: string, params?: Record<string, unknown>): boolean;
  /** The value at a leaf's dotted path. Booleans, enums, and numbers are left
   *  out of a menu without both this and `onChange`, colors and strings without
   *  this, and `showIf`/`enableIf` are checked only with it. */
  values?(path: string): unknown;
  onChange?(path: string, value: unknown): void;
  /** The schema an `alias` leaf's `of` is read in. Default: the menu's own. */
  over?: PrefGroup;
}

type Ctx = {
  src: MenuSources;
  byId: Map<string, Action>;
  root: PrefGroup;
  read?: PrefConditionReader;
  at?: Point;
  params?: Record<string, unknown>;
};

const SUBMENU_AS: ReadonlySet<PrefGroupAs> = new Set(['menu', 'page', 'tab', 'panel']);
const noop = () => {};
const withAccess = (access?: string): { access?: string } => (access ? { access } : {});
const sep = (key: string): MenuEntry => ({ kind: 'separator', key });

function itemOf(ctx: Ctx, it: ActionItem, key: string, label: string, off: boolean, access?: string): MenuEntry {
  const deps = ctx.src.depsFor(it.action);
  const point = ctx.at ? { worldX: ctx.at.x, worldY: ctx.at.y } : {};
  if (it.action.settings) return settingsOf(ctx, it, key, label, off || !evaluateEnabled(it.action, deps, ctx.at).enabled, access);
  return {
    kind: 'item',
    key,
    label,
    ...withAccess(access),
    icon: it.icon,
    shortcut: actionShortcuts(it.action, it.params)[0],
    disabled: off || !evaluateEnabled(it.action, deps, ctx.at).enabled,
    checked: evaluateActive(it.action, deps),
    run: () => { ctx.src.trigger(it.action.id, { ...ctx.params, ...it.params, ...point }); },
  };
}

/** An action carrying settings as a submenu of its form's rows, read when the
 *  menu resolves; each change triggers the action with the params it makes. */
function settingsOf(ctx: Ctx, it: ActionItem, key: string, label: string, off: boolean, access?: string): MenuEntry {
  const settings = it.action.settings!;
  const state = off ? null : readActionSettings(it.action, ctx.src.depsFor(it.action));
  const mixed = new Set(state?.mixed ?? []);
  const values = (path: string): unknown => (mixed.has(path) ? undefined : prefValueAtPath(state?.values, path));
  const onChange = (path: string, value: unknown): void => {
    const params = actionSettingsParams(settings, path, value);
    if (params) ctx.src.trigger(it.action.id, { ...ctx.params, ...it.params, ...params });
  };
  const form: Ctx = {
    ...ctx,
    src: { ...ctx.src, values, onChange, over: settings.schema },
    root: settings.schema,
    read: (path, from) => (from === 'item' ? undefined : values(path)),
  };
  const entries = state ? tidy(groupRows(form, settings.schema, '', ROOT)) : [];
  return {
    kind: 'submenu',
    key,
    label,
    ...(it.icon ? { icon: it.icon } : {}),
    ...withAccess(access),
    ...(entries.length === 0 ? { disabled: true } : {}),
    entries,
  };
}

/** The items a registry key names: an action's (one per variant), or the one
 *  variant `id:variant` picks. */
function itemsNamed(ctx: Ctx, name: string): ActionItem[] {
  const action = ctx.byId.get(name);
  if (action) return actionItems(action);
  const colon = name.indexOf(':');
  const owner = colon > 0 ? ctx.byId.get(name.slice(0, colon)) : undefined;
  return owner ? actionItems(owner).filter((it) => it.key === name) : [];
}

function actionRows(ctx: Ctx, leaf: PrefAction, key: string, off: boolean): MenuEntry[] {
  const own = leaf.label || leaf.name;
  if (leaf.action === undefined) {
    // A menu holds no code, so it can be saved as data: a leaf with only `run` is a dead row.
    if (!own) return [];
    if (isDev()) console.warn(`weasel: menu row "${key}" names no registered action, so it does nothing`);
    return [{ kind: 'item', key, label: own, disabled: true, run: noop }];
  }
  const items = itemsNamed(ctx, leaf.action);
  if (items.length === 1) return [itemOf(ctx, items[0]!, key, own || items[0]!.label, off, leaf.access)];
  return items.map((it) => itemOf(ctx, it, `${key}/${it.key}`, it.label, off));
}

function siblingsOf(ctx: Ctx, path: string): Record<string, unknown> | undefined {
  const dot = path.lastIndexOf('.');
  const parent = dot < 0 ? undefined : ctx.src.values!(path.slice(0, dot));
  return parent && typeof parent === 'object' ? parent as Record<string, unknown> : undefined;
}

function booleanRows(ctx: Ctx, leaf: PrefBoolean, key: string, path: string, off: boolean): MenuEntry[] {
  const { values, onChange } = ctx.src;
  if (!values || !onChange) return [];
  const stored = values(path);
  const on = leaf.encoding ? leaf.encoding.read(stored, siblingsOf(ctx, path)) : stored === true;
  const write = (v: boolean) => (leaf.encoding ? leaf.encoding.write(v, siblingsOf(ctx, path)) : v);
  return [{
    kind: 'item', key, label: leaf.name, ...withAccess(leaf.access), checked: on,
    disabled: off || leaf.readout === true,
    run: leaf.readout ? noop : () => onChange(path, write(!on)),
  }];
}

function enumRows(ctx: Ctx, leaf: PrefEnum, key: string, path: string, off: boolean): MenuEntry[] {
  const { values, onChange } = ctx.src;
  if (!values || !onChange) return [];
  const stored = values(path);
  const current = leaf.encoding ? leaf.encoding.read(stored, siblingsOf(ctx, path)) : stored;
  if (leaf.readout) {
    const shown = leaf.options.find((o) => o.value === current)?.label ?? '—';
    return [{ kind: 'item', key, label: `${leaf.name}: ${shown}`, disabled: true, run: noop }];
  }
  const write = (v: string) => (leaf.encoding ? leaf.encoding.write(v, siblingsOf(ctx, path)) : v);
  return [
    sep(`${key}/<`),
    ...leaf.options.map((o): MenuEntry => ({
      kind: 'item', key: `${key}/${o.value}`, label: o.label, checked: o.value === current,
      disabled: off || o.disabled === true, run: () => onChange(path, write(o.value)),
    })),
    sep(`${key}/>`),
  ];
}

/** A number row, in the units the leaf shows: its value, bounds, and step convert from the stored unit, and
 *  what is set converts back. An infinity is a value only where an `endless` end stands for it. */
function numberRows(ctx: Ctx, given: PrefNumber, key: string, path: string, off: boolean): MenuEntry[] {
  const { values, onChange } = ctx.src;
  if (!values || !onChange) return [];
  const leaf = prefNumberAt(given, values);
  const unit = leaf.unit && resolvePrefUnit(leaf.unit);
  const stored = values(path);
  const { min, max, step, endless } = prefDisplayBounds(leaf);
  const disabled = off || leaf.readout === true;
  return [{
    kind: 'number', key, label: leaf.name, ...withAccess(leaf.access),
    ...(leaf.icon ? { icon: leaf.icon } : {}),
    ...(disabled ? { disabled } : {}),
    value: typeof stored === 'number' && (Number.isFinite(stored) || endlessAllows(leaf.endless, stored))
      ? (unit ? unit.toDisplay(stored) : stored)
      : undefined,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    step,
    ...(unit?.suffix === undefined ? {} : { suffix: unit.suffix }),
    ...(leaf.display ? { display: leaf.display } : {}),
    ...(endless ? { endless } : {}),
    ...(leaf.infinity === undefined ? {} : { infinity: leaf.infinity }),
    ...(unit ? { accepts: prefUnitAccepts(unit) } : {}),
    set: (shown) => onChange(path, unit ? unit.fromDisplay(shown) : shown),
  }];
}

const textAt = (ctx: Ctx, path: string): string | undefined => {
  const v = ctx.src.values?.(path);
  return typeof v === 'string' && v !== '' ? v : undefined;
};

/** A color row: read-only, whether or not the leaf is a readout. */
function colorRows(ctx: Ctx, leaf: PrefColor, key: string, path: string, off: boolean): MenuEntry[] {
  if (!ctx.src.values) return [];
  return [{ kind: 'color', key, label: leaf.name, ...withAccess(leaf.access), ...(off ? { disabled: true } : {}), value: textAt(ctx, path) }];
}

/** A string row is edited in place; a readout, or one nothing writes, reads as its name and value, as an enum readout does. */
function stringRows(ctx: Ctx, leaf: PrefString, key: string, path: string, off: boolean): MenuEntry[] {
  const { values, onChange } = ctx.src;
  if (!values) return [];
  if (leaf.readout || !onChange) {
    return [{ kind: 'item', key, label: `${leaf.name}: ${textAt(ctx, path) ?? '—'}`, ...withAccess(leaf.access), disabled: true, run: noop }];
  }
  const stored = values(path);
  return [{
    kind: 'text', key, label: leaf.name, ...withAccess(leaf.access),
    ...(leaf.icon ? { icon: leaf.icon } : {}),
    ...(off ? { disabled: true } : {}),
    value: typeof stored === 'string' ? stored : undefined,
    set: (text) => onChange(path, text),
  }];
}

/** `key` names the row; `path` is where its value lives, which differs from
 *  `key` only for a leaf reached through an alias. */
function leafRows(ctx: Ctx, leaf: PrefLeaf, key: string, path: string, off: boolean): MenuEntry[] {
  switch (leaf.kind) {
    case 'action': return actionRows(ctx, leaf as PrefAction, key, off);
    case 'actions': {
      const group = (leaf as { group: string }).group;
      return ctx.src.actions()
        .filter((a) => a.group === group)
        .flatMap((a) => actionItems(a).map((it) => itemOf(ctx, it, `${key}/${it.key}`, it.label, off)));
    }
    case 'boolean': return booleanRows(ctx, leaf as PrefBoolean, key, path, off);
    case 'enum': return enumRows(ctx, leaf as PrefEnum, key, path, off);
    case 'number': return numberRows(ctx, leaf as PrefNumber, key, path, off);
    case 'color': return colorRows(ctx, leaf as PrefColor, key, path, off);
    case 'string': return stringRows(ctx, leaf as PrefString, key, path, off);
    case 'separator': return [sep(key)];
    case 'label':
      return [{ kind: 'item', key, label: leaf.name, ...withAccess(leaf.access), disabled: true, run: noop }];
    case 'alias': {
      const alias = leaf as Parameters<typeof prefAliasTarget>[0];
      const target = prefAliasTarget(alias, (p) => prefLeafAt(ctx.src.over ?? ctx.root, p));
      return target ? leafRows(ctx, prefAliasedLeaf(alias, target.leaf), key, target.path, off) : [];
    }
    default: return [];
  }
}

const ROOT: PrefOwner = { node: {}, scope: PREF_SCOPE, above: PREF_SCOPE };

function groupRows(ctx: Ctx, group: PrefGroup, prefix: string, owner: PrefOwner): MenuEntry[] {
  const { read } = ctx;
  const holds: PrefConditionJudge = (condition) => read === undefined || prefConditionHolds(condition, read);
  const out: MenuEntry[] = [];
  for (const [k, node] of Object.entries(group.children)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const sits = isPrefLeaf(node) ? prefScopeIn(owner, path, holds) : owner.scope;
    const scope = prefScopeUnder(sits, node, holds);
    if (!scope.shown) continue;
    const disabled = !scope.enabled;
    const inner: PrefOwner = { node, scope, above: sits };
    if (isPrefLeaf(node)) {
      out.push(...leafRows(ctx, node, path, path, disabled));
    } else if (node.as !== undefined && SUBMENU_AS.has(node.as)) {
      const entries = tidy(groupRows(ctx, node, path, inner));
      if (entries.length) {
        out.push({ kind: 'submenu', key: path, label: node.name, ...(node.icon ? { icon: node.icon } : {}), ...withAccess(node.access), entries });
      }
    } else {
      out.push(sep(`${path}/<`), ...groupRows(ctx, node, path, inner), sep(`${path}/>`));
    }
  }
  return out;
}

/** Drop leading, trailing, and doubled separators. */
function tidy(entries: MenuEntry[]): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const e of entries) {
    if (e.kind === 'separator' && (!out.length || out[out.length - 1]!.kind === 'separator')) continue;
    out.push(e);
  }
  if (out[out.length - 1]?.kind === 'separator') out.pop();
  return out;
}

/**
 * Draw a prefs schema as menu entries. Action leaves become items from the
 * registry (one per variant for a parametric action), an `actions` leaf one
 * item per action in its group, a boolean a checked item, an enum radio
 * rows, and a number and a string a row edited in place (all through `src.values`/`src.onChange`);
 * a color shows as a swatch, read-only, and so does a string as a disabled row when it is a readout
 * or nothing writes it. A group drawn `as` a
 * `menu`, `page`, `tab`, or `panel` is a submenu, and any other group's rows
 * sit inline between separators. Paint, field, compound, and app-defined leaves are left out.
 * `at` is the world point the menu was opened at and reaches `enabled` and
 * every action's params; `params` go to every action, under its own.
 */
export function resolveSchemaMenu(
  schema: PrefGroup,
  src: MenuSources,
  at?: Point,
  params?: Record<string, unknown>,
): MenuEntry[] {
  const values = src.values;
  const ctx: Ctx = {
    src,
    byId: new Map(src.actions().map((a) => [a.id, a])),
    root: schema,
    read: values ? (path, from) => (from === 'item' ? undefined : values(path)) : undefined,
    at,
    params,
  };
  return tidy(groupRows(ctx, schema, '', ROOT));
}

/** Turn a declared menu into model entries; see {@link resolveSchemaMenu}. */
export function resolveMenu(
  def: MenuDef,
  src: MenuSources,
  at?: Point,
  params?: Record<string, unknown>,
): MenuEntry[] {
  return resolveSchemaMenu(def.menu, src, at, params);
}
