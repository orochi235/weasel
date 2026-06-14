// Re-export the canonical kit-wide Bounds; the chrome/handle code uses the
// same `{x, y, width, height, rotation?}` shape that lives in viewport
// helpers, with rotation indicating an oriented selection box.
export type { Bounds } from '../../../core/viewport/fitViewToBounds';

// `MULTI_RESIZE_TARGET_ID` moved to `core/selection` (it's a selection-derived
// concept consumed by affordances + the overlay layer, so it belongs at the
// bottom of the layering). Re-exported here so `useSelectTool`'s public
// re-export and existing `tools/` import paths stay stable.
export { MULTI_RESIZE_TARGET_ID } from '../../../core/selection/selectionTarget';
