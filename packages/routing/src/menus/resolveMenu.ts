import type { MenuEntry } from '@weasel-js/menu';
import type { Action } from '../interactions/actions/action';
import type { ActionDeps } from '../interactions/actions/invoker';
import { actionItems } from '../interactions/actions/actionItems';
import { actionShortcuts } from '../interactions/actions/actionShortcuts';
import { evaluateActive, evaluateEnabled } from '../interactions/actions/actionEnabled';
import type { MenuDef, MenuDefEntry } from './types';

/** What resolving reads: the registered actions, each one's deps, and how to run one. */
export interface MenuSources {
  actions(): readonly Action[];
  depsFor(action: Action): ActionDeps | undefined;
  trigger(id: string, params?: Record<string, unknown>): boolean;
}

type Ctx = {
  src: MenuSources;
  byId: Map<string, Action>;
  at?: { x: number; y: number };
  params?: Record<string, unknown>;
};

function itemOf(
  ctx: Ctx, action: Action, key: string, label: string, icon: unknown, own?: Readonly<Record<string, unknown>>,
): MenuEntry {
  const deps = ctx.src.depsFor(action);
  const point = ctx.at ? { worldX: ctx.at.x, worldY: ctx.at.y } : {};
  return {
    kind: 'item',
    key,
    label,
    icon,
    shortcut: actionShortcuts(action, own)[0],
    disabled: !evaluateEnabled(action, deps, ctx.at).enabled,
    checked: evaluateActive(action, deps),
    run: () => { ctx.src.trigger(action.id, { ...ctx.params, ...own, ...point }); },
  };
}

function rowsOf(ctx: Ctx, e: MenuDefEntry, path: string, at: string): MenuEntry[] {
  if ('submenu' in e) {
    const key = `${path}/${at}:${e.submenu}`;
    const entries = sectionsOf(ctx, e.sections, key);
    return entries.length ? [{ kind: 'submenu', key, label: e.label, entries }] : [];
  }
  const id = 'action' in e ? e.action : e.actionVariants;
  const action = ctx.byId.get(id);
  if (!action || action.invoker?.timing !== 'immediate') return [];
  if ('actionVariants' in e) {
    return actionItems(action).map((it) => itemOf(ctx, action, `${path}/${at}:${it.key}`, it.label, it.icon, it.params));
  }
  return [itemOf(ctx, action, `${path}/${at}:${action.id}`, e.label ?? action.label, action.icon, e.params)];
}

function sectionsOf(ctx: Ctx, sections: MenuDefEntry[][], path: string): MenuEntry[] {
  const out: MenuEntry[] = [];
  sections.forEach((section, i) => {
    const rows = section.flatMap((e, j) => rowsOf(ctx, e, path, `${i}.${j}`));
    if (!rows.length) return;
    if (out.length) out.push({ kind: 'separator', key: `${path}/sep${i}` });
    out.push(...rows);
  });
  return out;
}

/** Turn a declared menu into model entries. `at` is the world point it was
 *  opened at and reaches `enabled` and every item's params; `params` go to
 *  every item, under the item's own. */
export function resolveMenu(
  def: MenuDef,
  src: MenuSources,
  at?: { x: number; y: number },
  params?: Record<string, unknown>,
): MenuEntry[] {
  const byId = new Map(src.actions().map((a) => [a.id, a]));
  return sectionsOf({ src, byId, at, params }, def.sections, def.id);
}
