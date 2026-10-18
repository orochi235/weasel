import type { MenuEntry, MenuItemEntry } from '@weasel-js/menu';
import {
  isPrefLeaf, prefAliasedLeaf, prefAliasTarget, prefIsEnabled, prefIsShown, prefLeafAt,
  type PrefAction, type PrefBoolean, type PrefConditionReader, type PrefEnum, type PrefGroup,
  type PrefGroupAs, type PrefLeaf,
} from '@weasel-js/prefs';
import type { Action } from '../interactions/actions/action';
import type { ActionDeps } from '../interactions/actions/invoker';
import { actionItems, type ActionItem } from '../interactions/actions/actionItems';
import { actionShortcuts } from '../interactions/actions/actionShortcuts';
import { evaluateActive, evaluateEnabled } from '../interactions/actions/actionEnabled';
import { isDev } from '@weasel-js/react';
import type { MenuDef } from './types';
import type { Point } from '@weasel-js/geom';

/** What resolving reads: the registered actions, each one's deps, how to run
 *  one, and the values behind the schema's boolean and enum leaves. */
export interface MenuSources {
  actions(): readonly Action[];
  depsFor(action: Action): ActionDeps | undefined;
  trigger(id: string, params?: Record<string, unknown>): boolean;
  /** The value at a leaf's dotted path. Booleans and enums are left out of a
   *  menu without both this and `onChange`, and `showIf`/`enableIf` are
   *  checked only with it. */
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

function itemOf(ctx: Ctx, it: ActionItem, key: string, label: string, off: boolean, access?: string): MenuItemEntry {
  const deps = ctx.src.depsFor(it.action);
  const point = ctx.at ? { worldX: ctx.at.x, worldY: ctx.at.y } : {};
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

function groupRows(ctx: Ctx, group: PrefGroup, prefix: string, off: boolean): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const [k, node] of Object.entries(group.children)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (ctx.read && !prefIsShown(node, ctx.read)) continue;
    const disabled = off || (ctx.read !== undefined && !prefIsEnabled(node, ctx.read));
    if (isPrefLeaf(node)) {
      out.push(...leafRows(ctx, node, path, path, disabled));
    } else if (node.as !== undefined && SUBMENU_AS.has(node.as)) {
      const entries = tidy(groupRows(ctx, node, path, disabled));
      if (entries.length) {
        out.push({ kind: 'submenu', key: path, label: node.name, ...(node.icon ? { icon: node.icon } : {}), ...withAccess(node.access), entries });
      }
    } else {
      out.push(sep(`${path}/<`), ...groupRows(ctx, node, path, disabled), sep(`${path}/>`));
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
 * item per action in its group, a boolean a checked item and an enum radio
 * rows (both through `src.values`/`src.onChange`); a group drawn `as` a
 * `menu`, `page`, `tab`, or `panel` is a submenu, and any other group's rows
 * sit inline between separators. Leaves a menu cannot edit are left out.
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
  return tidy(groupRows(ctx, schema, '', false));
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
