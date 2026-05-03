/**
 * UI chrome — small render/hit-test helpers for the boilerplate every canvas
 * editor ends up writing (resize handles, hit-tests, etc). Behavior-free:
 * these helpers don't render or wire interactions; they just compute the
 * layout consumers were going to compute anyway.
 */
export { cornerResizeHandles, hitCornerHandle } from './cornerHandles';
export type { CornerHandle } from './cornerHandles';
