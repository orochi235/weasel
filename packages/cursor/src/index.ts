export { bakeCursor, quantizeCursorAngle } from './bake';
export type { BakeOptions } from './bake';
export { cursorFor } from './registry';
export { resolveCursor, resolveCursorTier } from './resolve';
export type { CursorSpec, CursorGlyphSpec, ResolvedCursor } from './resolve';
export {
  chromeLineWidthScale,
  cursorPaintMatrix,
  cursorPaintOps,
  cursorWorldSize,
} from './paint';
export type { CursorMatrix, CursorPaintOp, PaintOptions, PaintPlacement } from './paint';
export { GLYPHS } from './glyphs';
export type { CursorGlyphName } from './glyphs';
export {
  CURSOR_ANGLE_STEPS,
  CURSOR_HALO,
  CURSOR_HALO_WIDTH,
  CURSOR_INK,
  CURSOR_MAX_CSS_PX,
  haloFitsInBox,
  rotationFitsInBox,
} from './types';
export type { CursorGlyph, CursorPath } from './types';
