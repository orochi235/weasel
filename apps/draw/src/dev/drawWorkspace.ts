import { defaultNodeProperties } from '@weasel-js/core';
import type { PrefGroup, PrefGroupAs } from '@weasel-js/prefs';
import type { Asset, Workspace } from '@weasel-js/ui/components/PrefSchemaEditor';
import { DRAW_MENU_BAR } from '../menuBar';
import { DRAW_MENUS } from '../menus';
import { PREFS } from '../prefs';
import { SURFACE_ASSETS } from '../surfaces/assets';
import type { SurfaceKind } from '../surfaces/types';

const PREFS_ID = 'prefs';

/** A surface asset is drawn wherever the reader puts it; the editor previews it on the one it starts on. */
const AS: Record<SurfaceKind, PrefGroupAs | undefined> = { bar: 'bar', menu: 'menu', panel: undefined };

const MENU_LABELS: Record<string, string> = {
  'draw.selection': 'Selection',
  'draw.canvas': 'Canvas',
  'draw.layerRow': 'Layer row',
};

const drawnAs = (root: PrefGroup, as: PrefGroupAs | undefined, name: string): PrefGroup =>
  ({ ...root, name: root.name || name, ...(as ? { as } : {}) });

const surfaces: Asset[] = SURFACE_ASSETS.map((a) => ({
  id: `surface:${a.id}`, label: a.label, kind: 'layout', over: PREFS_ID, root: drawnAs(a.schema, AS[a.defaultSurface], a.label),
}));

const menuBar: Asset = { id: 'menubar', label: 'Menu bar', kind: 'layout', over: PREFS_ID, root: DRAW_MENU_BAR };

const menus: Asset[] = DRAW_MENUS.map((m) => {
  const label = MENU_LABELS[m.id] ?? m.id;
  return { id: `menu:${m.id}`, label, kind: 'layout', over: PREFS_ID, root: drawnAs(m.menu, 'menu', label) };
});

/** The app-defined leaf kinds the surface assets draw with their own code, which needs the running editor. */
export const DRAW_LEAF_KINDS: readonly string[] = [...new Set(SURFACE_ASSETS.flatMap((a) => [
  ...Object.keys(a.renderers?.panel ?? {}),
  ...Object.keys(a.renderers?.bar ?? {}),
]))];

const nodes: Asset[] = defaultNodeProperties.map((e) => ({
  id: `node:${e.name}`, label: `Node: ${e.name}`, kind: 'schema', root: e.schema,
}));

/**
 * Every schema WeaselDraw ships, as one workspace: its preferences and each node's properties as dialogs, and its
 * toolbar, panel, menu bar, and context-menu assets as layouts.
 */
export const DRAW_WORKSPACE: Workspace = {
  assets: [{ id: PREFS_ID, label: 'WeaselDraw preferences', kind: 'schema', root: PREFS }, ...nodes, ...surfaces, menuBar, ...menus],
};
