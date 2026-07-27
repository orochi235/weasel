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
 * Gating is written in terms of **capabilities, not mode ids**. A
 * capability rule keeps holding when a new mode is added that permits the
 * same thing; a mode rule has to be found and edited every time. The one
 * exception is the `path-edit.*` chrome below, which is genuinely
 * mode-specific: it's the visual signature of that mode, not a statement
 * about what the user is allowed to do.
 *
 * Chrome that gates on the *absence* of a capability (the selection
 * outline, suppressed while an anchor-editing overlay owns the visuals)
 * uses `capability: { not: … }` for the same reason.
 */
export const defaultVisibilityRules: VisibilityRules = {
  // Static selection chrome — visible while a selection exists, but off
  // whenever an anchor-editing overlay has taken over the visuals (today:
  // path-edit mode; tomorrow: anything else that allows `edits-anchors`).
  'selection.outline': {
    all: [
      { selection: { atLeast: 1 } },
      { capability: { not: 'edits-anchors' } },
    ],
  } as Rule,

  // Handles hide during an action so the moving / resizing object isn't
  // visually crowded; they reappear on commit. Gated on the mode actually
  // permitting transforms — grabbing a resize handle in a mode that
  // forbids `transforms-selection` could only ever be a no-op — and on the
  // selection being resizable (consumer `resizable` predicate).
  'selection.resize-handles': {
    all: [
      { selection: { atLeast: 1 } },
      { not: { gesturing: true } },
      { capability: 'transforms-selection' },
      { resizable: true },
    ],
  } as Rule,

  // Rotation handle visible whenever any selection is focused — single
  // mode pivots around the selected node's center; multi mode pivots
  // around the union AABB center. Same transform gating as resize; also
  // off during an action.
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
