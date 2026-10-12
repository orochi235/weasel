import type { VisibilityRules } from './types';
import type { Rule } from '@weasel-js/routing';

/**
 * Kit-shipped defaults. Merged with the consumer's `chromeVisibility` map
 * at resolve time; consumer entries take precedence per id.
 *
 * Gating is written in terms of **capabilities, not mode ids**. A
 * capability rule keeps holding when a new mode is added that permits the
 * same thing; a mode rule has to be found and edited every time.
 */
export const defaultVisibilityRules: VisibilityRules = {
  // Off whenever an anchor-editing overlay has taken over the visuals.
  'selection.outline': {
    all: [
      { selection: { atLeast: 1 } },
      { capability: { not: 'edits-anchors' } },
    ],
  } as Rule,

  // Handles hide during an action so the moving / resizing object isn't
  // visually crowded; they reappear on commit.
  'selection.resize-handles': {
    all: [
      { selection: { atLeast: 1 } },
      { not: { gesturing: true } },
      { capability: 'transforms-selection' },
      { resizable: true },
    ],
  } as Rule,

  'selection.rotation-handle': {
    all: [
      { selection: { atLeast: 1 } },
      { focused: true },
      { not: { gesturing: true } },
      { capability: 'transforms-selection' },
    ],
  } as Rule,

  // Transient action chrome — only shown during the matching action.
  'action.marquee':     { actionIs: 'marquee' } as Rule,
  'action.lasso':       { actionIs: 'lasso' } as Rule,
  'action.move-ghosts': { actionIs: 'move' } as Rule,

  // Path-edit chrome — gated on there actually being an edited path, not on
  // `{ mode: 'path-edit' }`: consumers with no mode registry report mode
  // `'normal'`, and one defining its own anchor-editing mode uses another id.
  // A state selector rather than a `capability:` one on purpose: the
  // capability says the user *may* edit anchors, which is not the same as
  // a path *being* edited.
  'path-edit.anchors': { editingAnchors: true } as Rule,
  'path-edit.overlay': { editingAnchors: true } as Rule,

  // Snap system — guides during any action; targets consumer-driven for now.
  'snap.guides': { gesturing: true } as Rule,
  // 'snap.targets' — no default; consumer-driven for now.

  // 'grid' / 'debug.*' — no default; visibility is driven by dedicated
  // boolean props on <SceneCanvas>.
};
