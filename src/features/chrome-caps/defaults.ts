import type { VisibilityRules } from './types';
import {
  actionIs,
  focused,
  gesturing,
  selectionAtLeast,
} from './conditions';

/**
 * Kit-shipped defaults. Merged with the consumer's `chromeVisibility`
 * map at resolve time; consumer entries take precedence per id.
 *
 * Read this table as the canonical "when does each chrome part show"
 * spec. Before chrome-caps these rules lived inline inside affordance
 * `regions()` methods and overlay-layer `draw()` early-returns — the
 * point of the migration is to centralize them here.
 */
export const defaultVisibilityRules: VisibilityRules = {
  // Static selection chrome — visible while a selection exists.
  'selection.outline':         selectionAtLeast(1),

  // Handles hide during an action so the moving / resizing object
  // isn't visually crowded; they reappear on commit. Single mode
  // shows per-object corners; multi mode shows union-bounds corners
  // (the affordance's `pickRenderTarget` picks the appropriate target).
  'selection.resize-handles':  selectionAtLeast(1).andNot(gesturing),
  // Rotation handle visible whenever any selection is focused — single
  // mode pivots around the selected node's center; multi mode pivots
  // around the union AABB center (the rotation action's
  // `useUnionPivot: ids.length > 1` branch handles the dispatch).
  'selection.rotation-handle': selectionAtLeast(1).and(focused).andNot(gesturing),

  // Transient action chrome — only shown during the matching action.
  'action.marquee':            actionIs('marquee'),
  'action.lasso':              actionIs('lasso'),
  'action.move-ghosts':        actionIs('move'),

  // Snap system — guides during any action (move/resize/rotate snap
  // into siblings); targets visible only when a snap is engaged.
  'snap.guides':               gesturing,
  // 'snap.targets' — no default; consumer-driven for now.

  // 'grid' / 'debug.*' — no default; visibility is currently driven by
  // dedicated boolean props on <SceneCanvas>. They'll move into this
  // table as they migrate, but the rules table doesn't need to assert
  // them today.
};
