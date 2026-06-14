/** Synthetic id used by `<Canvas selectionMode="multi">` to address the
 *  union-AABB target when 2+ real ids are selected. The selection-overlay
 *  layer and the affordance hit-tester both resolve it to `ChromeState`'s
 *  `unionBounds`; consumers wiring their own selection-overlay layer can
 *  reference the same constant.
 *
 *  Lives in `core/selection` (next to `ChromeState`) because it's a
 *  selection-derived concept, not a tool concept — `affordances/`,
 *  `features/selection/`, and `tools/` all consume it, so it must sit at
 *  the bottom of the layering (`core` → `affordances` → `tools` →
 *  `features`). */
export const MULTI_RESIZE_TARGET_ID = '__weasel:multi-selection';
