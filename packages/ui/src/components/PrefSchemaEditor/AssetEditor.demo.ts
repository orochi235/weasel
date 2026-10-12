import type { PrefAlias, PrefGroup } from '@weasel-js/prefs';
import type { Workspace } from './workspace';

const pointer = (of: string): PrefAlias => ({ kind: 'alias', name: '', description: '', default: undefined, of });

const SETTINGS: PrefGroup = {
  name: 'Settings',
  children: {
    view: {
      name: 'View',
      description: 'What the canvas draws.',
      children: {
        grid: { kind: 'boolean', name: 'Show grid', description: 'Draw the alignment grid.', default: true },
        snap: { kind: 'boolean', name: 'Snap', description: 'Snap to the grid.', default: false },
        zoomStep: { kind: 'number', name: 'Zoom step', description: 'Wheel zoom increment (%).', default: 10, min: 1, max: 50 },
      },
    },
    export: {
      name: 'Export',
      description: 'What a saved file carries.',
      children: {
        format: { kind: 'enum', name: 'Format', description: 'File type written by Export.', default: 'svg', options: [{ value: 'svg', label: 'SVG' }, { value: 'png', label: 'PNG' }] },
        scale: { kind: 'number', name: 'Scale', description: 'Pixels per unit.', default: 2, min: 1, max: 8 },
      },
    },
  },
};

/** A dialog, a panel that takes edits, and one that takes none: what the story and the layout tests draw. */
export const DEMO_WORKSPACE: Workspace = {
  assets: [
    { id: 'settings', label: 'Settings', kind: 'schema', root: SETTINGS },
    {
      id: 'canvas', label: 'Canvas', kind: 'layout', over: 'settings',
      root: { name: 'Canvas', children: { zoomStep: pointer('view.zoomStep'), lines: { name: 'Grid', as: 'section', children: { grid: pointer('view.grid'), snap: pointer('view.snap') } } } },
    },
    {
      id: 'export', label: 'Export', kind: 'layout', over: 'settings', readOnly: true,
      root: { name: 'Export', children: { format: pointer('export.format'), scale: pointer('export.scale') } },
    },
  ],
};
