/**
 * @weasel-js/paint — the kit's paint vocabulary. Plain data, no renderer.
 *
 * @packageDocumentation
 */
export type { TextureHandle } from './texture';
export type {
  CommandFill, CommandPaint, CommandPaintUnits, CommandStroke, InCommandUnits, PosedPaint, SolidPaint,
} from './commandPaint';
export { isSolidPaint } from './commandPaint';
export { isPaint } from './isPaint';
export type { StrokeTrim, TrimAt, TrimPace } from './strokeTrim';
export { strokeTrimKey } from './strokeTrim';
export { paintKey, strokeKey, fillHasInk, strokeHasInk } from './paintKey';
export { INHERIT, resolveFill, resolveStroke } from './resolvePaint';
export type { Inherit, PaintedFill, PaintedStroke } from './resolvePaint';
export { DEFAULT_MITER_LIMIT } from './paint';
export type {
  Paint,
  PaintUnits,
  GradStop,
  GradientPaint,
  GradientKind,
  StrokeAlign,
  KitMarkerKey,
  MarkerKey,
  MarkerRef,
  Fill,
  Stroke,
  StrokeDashStyle,
  StrokeNib,
  Region,
  ScreenLength,
} from './paint';
export { alignedStrokeRect, alignedStrokeRectHolds } from './alignedStrokeRect';
export {
  TILE_KINDS,
  isImagePatternPaint,
  isPatternPaint,
  isTileKind,
  isTilePaint,
  patternPlacementOf,
  tileSpecOf,
  type ImagePatternPaint,
  type PatternPaint,
  type PatternPlacement,
  type ResolvablePatternKind,
  type TexturePaint,
  type TileExtent,
  type TileKind,
  type TilePaint,
  type TilePatternSpec,
} from './patternPaint';
export {
  composePatternTransform,
  decomposePatternTransform,
  type PatternTransform,
  type PatternTransformParts,
} from './patternTransform';
export { scaleVertexWidth, vertexHalfWidths, vertexWidthFromSides, widestHalfWidth } from './vertexWidth';
export type { HalfWidths, VertexWidth, VertexWidthSides } from './vertexWidth';
export {
  resolveScreenLength,
  STROKE_DASH_RATIOS,
  dashForStrokeStyle,
  dashPattern,
  dashPhase,
  scaledDash,
  MAX_DASH_RUNS,
  strokeDashStyleOf,
} from './paint';
export {
  srgbU8ToOklab,
  srgbFloatToOklab,
  oklabToSrgbU8,
  lerpOklab,
  oklabToOklch,
  oklchToOklab,
  lerpOklch,
  lerpColorArray,
  oklchDegToHex,
  hexToOklchDeg,
  srgbToLinear,
  linearToSrgb,
  linearSrgbToOklab,
  oklabToLinearSrgb,
  interpolateSrgb,
  type ColorInterpolationSpace,
  type ColorSpace,
  type OklchDeg,
} from './colorSpaces';
export { hslToSrgb, srgbToHsl } from './hsl';
export { lerpHueDeg, type HueInterpolation } from './hue';
export { mixOklab, mixRgba, mixRgbaWeighted } from './mix';
export { contrastLineColor, contrastRatio, luminanceContrast, relativeLuminance, wcagLevels } from './contrast';
export { lerpFill, lerpPaint, lerpStroke } from './lerpPaint';
export { byteHex, parseHexBytes, hexToRgbBytes, rgbaHex } from './hex';
export {
  parseColor,
  parseColorBytes,
  tryParseColor,
  normalizeHex,
  tryNormalizeHex,
  hexToRgba,
  rgbaToHex,
} from './color';
export type { HexForm } from './color';
export {
  isGradientPaint,
  resolveGradientStops,
  sampleResolvedStops,
  sampleGradientStops,
  withGradientKind,
  gradientGeometry,
  gradientForBounds,
  type ResolvedGradientStop,
} from './gradient';
export {
  resolvePaletteColor,
  resolvePaletteColors,
  colorLiteralToCss,
  cssColorNotation,
  colorLiteralToHex,
  cssColorLiteral,
  hexToColorLiteral,
  type ColorLiteral,
  type ColorRef,
  type ColorFn,
  type ColorFnContext,
  type ColorSeqFn,
  type ColorSource,
  type ExternalColors,
  type Palette,
  type PaletteEntry,
} from './palette';
