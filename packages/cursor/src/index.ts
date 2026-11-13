export { bakeCursor, quantizeCursorAngle } from './bake';
export type { BakeOptions } from './bake';
export { cursorFor, cursorGlyph, cursorVariants } from './registry';
export type { CursorForOptions, CursorGlyphOptions, CursorVariant } from './registry';
export { markedGlyph, placeCursorPath } from './mark';
export { resolveCursor, resolveCursorTier } from './resolve';
export { brushRing } from './brushRing';
export type { BrushRingUnit } from './brushRing';
export type { CursorSpec, CursorGlyphSpec, ResolvedCursor } from './resolve';
export {
  chromeLineWidthScale,
  cursorPaintMatrix,
  cursorPaintOps,
  cursorWorldSize,
} from './paint';
export type { CursorMatrix, CursorPaintOp, PaintOptions, PaintPlacement } from './paint';
export { GLYPHS, MARKS } from './glyphs';
export type { CursorGlyphName, CursorMarkName } from './glyphs';
export {
  CURSOR_ANGLE_STEPS,
  CURSOR_HALO,
  CURSOR_HALO_WIDTH,
  CURSOR_INK,
  CURSOR_MAX_CSS_PX,
  haloFitsInBox,
  rotationFitsInBox,
} from './types';
export type { CursorGlyph, CursorMark, CursorMarkSlot, CursorPath } from './types';

// Painted-cursor store — the slot a surface's painted cursor lives in, shared
// between whoever decides it and the layer that draws it.
export { createPaintedCursorState } from './paintedCursorState';
export type { PaintedCursor, PaintedCursorFrame, PaintedCursorState } from './paintedCursorState';
export { createCursorSink } from './cursorSink';
export type { CursorSink, CursorSinkTarget } from './cursorSink';
