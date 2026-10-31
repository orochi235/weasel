import type { ModeDefinition } from '../modeDefinition';

/** The default mode: everything except anchor and text editing, no scoping,
 *  no workspace tint. */
export const NORMAL: ModeDefinition = {
  id: 'normal',
  label: 'Normal',
  description: 'Select, draw and arrange anything on the page.',
  kind: 'soft',
  allows: [
    'creates-selection',
    'transforms-selection',
    'creates-paths',
    'creates-shapes',
    'creates-text',
    'samples-color',
    'applies-fill',
    'edits-page',
  ],
  scoping: false,
};

/** Editing the anchors of a path. Scoped to the target, entered by
 *  double-clicking a `path` or with Enter, left with Escape. It starts on
 *  core's `anchors` tool. */
export const PATH_EDIT: ModeDefinition = {
  id: 'path-edit',
  label: 'Path Edit',
  description: "Move a path's anchors and handles.",
  kind: 'soft',
  allows: ['edits-anchors'],
  scoping: true,
  workspace: { tint: '#3b82f6', gradient: 'bottom-up', intensity: 0.12 },
  entry: { trigger: 'double-click-target', targets: ['path'], shortcut: 'Enter' },
  exit: { shortcut: 'Escape' },
  discard: { shortcut: 'Meta+Escape' },
  defaultTool: 'anchors',
};

/** A transaction that transforms the selection: the whole session is one undo
 *  step, committed with Enter or discarded with Escape. */
export const FREE_TRANSFORM: ModeDefinition = {
  id: 'free-transform',
  label: 'Free Transform',
  description: 'Move, scale and rotate the selection as one undoable step.',
  kind: 'strict',
  allows: ['transforms-selection'],
  scoping: false,
  workspace: { tint: '#f59e0b', gradient: 'bottom-up', intensity: 0.12 },
  entry: { shortcut: 'Meta+T' },
  commit: { shortcut: 'Enter' },
  cancel: { shortcut: 'Escape' },
};

/** Editing the text of one node. Entered by double-clicking it, left with
 *  Escape. It names no targets: the text edit opening is what enters it. */
export const TEXT_EDIT: ModeDefinition = {
  id: 'text-edit',
  label: 'Text Edit',
  description: "Edit a text node's content.",
  kind: 'soft',
  allows: ['edits-text'],
  scoping: false,
  workspace: { tint: '#10b981', gradient: 'bottom-up', intensity: 0.12 },
  entry: { trigger: 'double-click-target' },
  exit: { shortcut: 'Escape' },
  discard: { shortcut: 'Meta+Escape' },
};

/** A transaction that changes the page extents, committed with Enter or
 *  discarded with Escape. */
export const CROP: ModeDefinition = {
  id: 'crop',
  label: 'Crop',
  description: 'Change the page extents as one undoable step.',
  kind: 'strict',
  allows: ['edits-page'],
  scoping: false,
  workspace: { tint: '#ef4444', gradient: 'bottom-up', intensity: 0.12 },
  entry: { shortcut: 'C' },
  commit: { shortcut: 'Enter' },
  cancel: { shortcut: 'Escape' },
};

/** The modes this package ships, ready to hand to `createModeRegistry`. */
export const DEFAULT_MODES: readonly ModeDefinition[] = [
  NORMAL,
  PATH_EDIT,
  FREE_TRANSFORM,
  TEXT_EDIT,
  CROP,
];

/** Look up one of the `DEFAULT_MODES` by id. Throws on an unknown id. For an
 *  app's own mode set, use the registry's `byId` instead. */
export function byId(id: string): ModeDefinition {
  const m = DEFAULT_MODES.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown mode id: ${id}`);
  return m;
}
