import type { VisibilityRules } from './types';
import type { Rule } from './rule';

/**
 * Kit-shipped defaults. Merged with the consumer's `chromeVisibility` map
 * at resolve time; consumer entries take precedence per id.
 *
 * Written as literal Rule trees rather than fluent chains so the inputs
 * each rule depends on are immediately visible. The fluent atoms compile
 * to the same trees; either form is valid in a VisibilityRules entry.
 *
 * Mode gating: selection chrome is suppressed in `path-edit` because the
 * path-editing overlay takes over visually. Path-edit-specific chrome
 * ids (`path-edit.*`) are positively gated to that mode. This replaces
 * the old `suppressedIds` set, which only the selection-outline path
 * honored.
 */
export const defaultVisibilityRules: VisibilityRules = {
  // Static selection chrome — visible while a selection exists, but off
  // in path-edit (the path-editing overlay takes over).
  'selection.outline': {
    selection: { atLeast: 1 },
    mode: { not: 'path-edit' },
  } as Rule,

  // Handles hide during an action so the moving / resizing object isn't
  // visually crowded; they reappear on commit. Also off in path-edit, and
  // when the selection isn't resizable (consumer `resizable` predicate).
  'selection.resize-handles': {
    all: [
      { selection: { atLeast: 1 } },
      { not: { gesturing: true } },
      { mode: { not: 'path-edit' } },
      { resizable: true },
    ],
  } as Rule,

  // Rotation handle visible whenever any selection is focused — single
  // mode pivots around the selected node's center; multi mode pivots
  // around the union AABB center. Off in path-edit and during action.
  'selection.rotation-handle': {
    all: [
      { selection: { atLeast: 1 } },
      { focused: true },
      { not: { gesturing: true } },
      { mode: { not: 'path-edit' } },
    ],
  } as Rule,

  // Transient action chrome — only shown during the matching action.
  'action.marquee':     { actionIs: 'marquee' } as Rule,
  'action.lasso':       { actionIs: 'lasso' } as Rule,
  'action.move-ghosts': { actionIs: 'move' } as Rule,

  // Path-edit chrome — gated positively to path-edit mode.
  'path-edit.anchors': { mode: 'path-edit' } as Rule,
  'path-edit.overlay': { mode: 'path-edit' } as Rule,

  // Snap system — guides during any action; targets consumer-driven for now.
  'snap.guides': { gesturing: true } as Rule,
  // 'snap.targets' — no default; consumer-driven for now.

  // 'grid' / 'debug.*' — no default; visibility currently driven by
  // dedicated boolean props on <SceneCanvas>. They'll move into this
  // table as they migrate.
};
