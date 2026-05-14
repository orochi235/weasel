/** World-space bounding rect for hit-testing handles. Uses `width`/`height` to
 *  match `cornerResizeHandles` and `rotationHandle` expectations. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** Synthetic id used by `<Canvas selectionMode="multi">` to address the
 *  union-AABB target when 2+ real ids are selected. The selection-overlay
 *  layer asks `previewBounds(MULTI_RESIZE_TARGET_ID)` for the union rect; the
 *  select tool synthesizes it from `getSelection()` + `boundsOf` so callers
 *  don't have to special-case it. Exported so `Canvas.tsx` (and any consumer
 *  wiring its own selection-overlay layer) can reference the same constant. */
export const MULTI_RESIZE_TARGET_ID = '__weasel:multi-selection';
