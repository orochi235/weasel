import { pref, type PrefGroup } from '@weasel-js/prefs';
import { LayersPanel } from '../LayersPanel';
import { LOUPE_SCHEMA, useLoupeBinding } from '../LoupeProvider';
import { ColorsPanel, HistoryPanel, PropertiesPanel } from '../sidebarPanels';
import type { SurfaceAsset, SurfaceKind } from './types';

const ALL: readonly SurfaceKind[] = ['bar', 'panel', 'menu'];

/** One run of an asset: every action in the registry group `group`. */
const run = (group: string): PrefGroup => pref.group('', { actions: pref.actions(group) }, { as: 'section' });

const LEAD = { lead: 'label' } as const;

const PATH = pref.group('Path', { path: run('path'), anchors: run('anchors') }, LEAD);

const PATHFINDER = pref.group('Pathfinder', { pathfinder: run('pathfinder') }, LEAD);

const ARRANGE = pref.group('Arrange', {
  reorder: run('reorder'),
  align: run('align'),
  distribute: run('distribute'),
  flip: run('flip'),
}, LEAD);

/**
 * Everything WeaselDraw can show as a toolbar, a panel, or a menu, in the order each surface lists them: bars and
 * menus left to right in the command strip, panels top to bottom in the right sidebar.
 */
export const SURFACE_ASSETS: readonly SurfaceAsset[] = [
  { id: 'arrange', label: 'Arrange', schema: ARRANGE, surfaces: ALL, defaultSurface: 'bar' },
  { id: 'pathfinder', label: 'Pathfinder', schema: PATHFINDER, surfaces: ALL, defaultSurface: 'bar' },
  { id: 'path', label: 'Path', schema: PATH, surfaces: ALL, defaultSurface: 'bar' },
  { id: 'loupe', label: 'Loupe', schema: LOUPE_SCHEMA, useBinding: useLoupeBinding, surfaces: ALL, defaultSurface: 'bar' },
  {
    id: 'properties', label: 'Properties', surfaces: ['panel'], defaultSurface: 'panel',
    render: (host, chrome) => <PropertiesPanel host={host} chrome={chrome} />,
  },
  {
    id: 'colors', label: 'Colors', surfaces: ['panel'], defaultSurface: 'panel',
    render: (_host, chrome) => <ColorsPanel chrome={chrome} />,
  },
  {
    id: 'layers', label: 'Layers', surfaces: ['panel'], defaultSurface: 'panel',
    render: (host, chrome) => (
      <LayersPanel
        scene={host.scene}
        selection={host.selection}
        measurements={host.measurements}
        backgroundColor={host.backgroundColor}
        docSelected={host.docSelected}
        setDocSelected={host.setDocSelected}
        chrome={chrome}
      />
    ),
  },
  {
    id: 'history', label: 'History', surfaces: ['panel'], defaultSurface: 'panel',
    render: (host, chrome) => <HistoryPanel host={host} chrome={chrome} />,
  },
];
