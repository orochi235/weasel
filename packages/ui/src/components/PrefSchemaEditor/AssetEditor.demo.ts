import type { PrefAlias, PrefGroup } from '@weasel-js/prefs';
import { actionCatalog } from '@weasel-js/ui/components/PrefSchemaEditor';
import type { EditorAction, Workspace } from '@weasel-js/ui/components/PrefSchemaEditor';

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

/** The actions the story's editor is given. */
export const DEMO_ACTIONS: readonly EditorAction[] = [
  { key: 'edit.undo', label: 'Undo', shortcut: '⌘Z' },
  { key: 'edit.redo', label: 'Redo', shortcut: '⇧⌘Z' },
  { key: 'view.zoom.in', label: 'Zoom in', shortcut: '⌘=' },
  { key: 'view.zoom.out', label: 'Zoom out', shortcut: '⌘-' },
  { key: 'view.grid', label: 'Toggle grid' },
  { key: 'align:left', label: 'Align left' },
  { key: 'align:right', label: 'Align right' },
  { key: 'export', label: 'Export' },
];

/** A dialog, a panel that takes edits, one that takes none, and the catalog of {@link DEMO_ACTIONS}: what the story and the layout tests draw. */
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
    { id: 'actions', label: 'Actions', kind: 'actions', root: actionCatalog(DEMO_ACTIONS) },
  ],
};
