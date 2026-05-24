import type { ModeDefinition } from '../modeDefinition';

export const NORMAL: ModeDefinition = {
  id: 'normal',
  kind: 'soft',
  allows: [
    'selection',
    'creates-paths',
    'creates-shapes',
    'creates-text',
    'samples-color',
    'applies-fill',
    'edits-page',
  ],
  scoping: false,
};

export const PATH_EDIT: ModeDefinition = {
  id: 'path-edit',
  kind: 'soft',
  allows: ['edits-anchors'],
  scoping: true,
  workspace: { tint: '#3b82f6', gradient: 'bottom-up', intensity: 0.12 },
  entry: { trigger: 'double-click-target', shortcut: 'Enter' },
  exit: { shortcut: 'Escape' },
};

export const ISOLATION: ModeDefinition = {
  id: 'isolation',
  kind: 'soft',
  allows: [
    'selection',
    'creates-paths',
    'creates-shapes',
    'creates-text',
    'samples-color',
    'applies-fill',
  ],
  scoping: true,
  workspace: { tint: '#8b5cf6', gradient: 'bottom-up', intensity: 0.12 },
  entry: { trigger: 'double-click-target' },
  exit: { shortcut: 'Escape' },
};

export const FREE_TRANSFORM: ModeDefinition = {
  id: 'free-transform',
  kind: 'strict',
  allows: ['transforms-selection'],
  scoping: false,
  workspace: { tint: '#f59e0b', gradient: 'bottom-up', intensity: 0.12 },
  entry: { shortcut: 'Meta+T' },
  commit: { shortcut: 'Enter' },
  cancel: { shortcut: 'Escape' },
};

export const TEXT_EDIT: ModeDefinition = {
  id: 'text-edit',
  kind: 'soft',
  allows: ['edits-text'],
  scoping: false,
  workspace: { tint: '#10b981', gradient: 'bottom-up', intensity: 0.12 },
  entry: { trigger: 'double-click-target' },
  exit: { shortcut: 'Escape' },
};

export const CROP: ModeDefinition = {
  id: 'crop',
  kind: 'strict',
  allows: ['edits-page'],
  scoping: false,
  workspace: { tint: '#ef4444', gradient: 'bottom-up', intensity: 0.12 },
  entry: { shortcut: 'C' },
  commit: { shortcut: 'Enter' },
  cancel: { shortcut: 'Escape' },
};

export const DEFAULT_MODES: readonly ModeDefinition[] = [
  NORMAL,
  PATH_EDIT,
  ISOLATION,
  FREE_TRANSFORM,
  TEXT_EDIT,
  CROP,
];

export function byId(id: string): ModeDefinition {
  const m = DEFAULT_MODES.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown mode id: ${id}`);
  return m;
}
