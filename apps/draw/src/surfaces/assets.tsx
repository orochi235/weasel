import { pref, type PrefGroup } from '@weasel-js/prefs';
import { FILE_ACTIONS } from '../fileCommands';
import { LOUPE_SCHEMA, useLoupeBinding } from '../LoupeProvider';
import { PANEL_ASSETS } from './panelAssets';
import type { SurfaceAsset, SurfaceKind } from './types';

const ALL: readonly SurfaceKind[] = ['bar', 'panel', 'menu'];

/** One run of an asset: every action in the registry group `group`. */
const run = (group: string): PrefGroup => pref.group('', { actions: pref.actions(group) }, { as: 'section' });

const LEAD = { lead: 'label' } as const;

const PATH = pref.group('Path', { path: run('path'), anchors: run('anchors'), effects: run('pathEffects') }, LEAD);

const PATHFINDER = pref.group('Pathfinder', { pathfinder: run('pathfinder') }, LEAD);

const ARRANGE = pref.group('Arrange', {
  reorder: run('reorder'),
  align: run('align'),
  distribute: run('distribute'),
  flip: run('flip'),
}, LEAD);

/** A command-row asset of every action in one registry group. */
const commandRun = (id: string, label: string, group: string): SurfaceAsset => ({
  id, label, schema: pref.group(label, { actions: pref.actions(group) }), surfaces: ALL, defaultSurface: 'bar', row: 'command',
});

const FILE = pref.group('File', {
  open: pref.action(FILE_ACTIONS.open, { description: 'Open SVG…' }),
  import: pref.action(FILE_ACTIONS.import, { description: 'Add an SVG to this document…' }),
  save: pref.action(FILE_ACTIONS.save, { description: 'Save as SVG' }),
});

/** The command row's assets, in the row's order. `CommandBar` gives each its slot. */
export const COMMAND_ASSETS: readonly SurfaceAsset[] = [
  { id: 'file', label: 'File', schema: FILE, surfaces: ALL, defaultSurface: 'bar', row: 'command' },
  commandRun('undo', 'Undo', 'history'),
  commandRun('clipboard', 'Clipboard', 'clipboard'),
  commandRun('edit', 'Edit', 'edit'),
  commandRun('structure', 'Structure', 'structure'),
  commandRun('view', 'View', 'view'),
  commandRun('text', 'Text', 'text'),
  commandRun('compound', 'Compound path', 'compound'),
  commandRun('record', 'Record', 'record'),
  commandRun('app', 'App', 'app'),
];

/**
 * Everything WeaselDraw can show as a toolbar, a panel, or a menu, in the order each surface lists them: bars and
 * menus left to right in the command strip, panels top to bottom in the right sidebar.
 */
export const SURFACE_ASSETS: readonly SurfaceAsset[] = [
  ...COMMAND_ASSETS,
  { id: 'arrange', label: 'Arrange', schema: ARRANGE, surfaces: ALL, defaultSurface: 'bar' },
  { id: 'pathfinder', label: 'Pathfinder', schema: PATHFINDER, surfaces: ALL, defaultSurface: 'bar' },
  { id: 'path', label: 'Path', schema: PATH, surfaces: ALL, defaultSurface: 'bar' },
  { id: 'loupe', label: 'Loupe', schema: LOUPE_SCHEMA, useBinding: useLoupeBinding, surfaces: ALL, defaultSurface: 'bar' },
  ...PANEL_ASSETS,
];
