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
export { paintKey, strokeKey, fillHasInk, strokeHasInk } from './paintKey';
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
export {
  TILE_KINDS,
  isPatternPaint,
  isTileKind,
  isTilePaint,
  patternPlacementOf,
  tileSpecOf,
  type PatternPaint,
  type PatternPlacement,
  type TexturePaint,
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
  alignedStrokeRect,
  resolveScreenLength,
  STROKE_DASH_RATIOS,
  dashForStrokeStyle,
  dashPattern,
  MAX_DASH_RUNS,
  strokeDashStyleOf,
} from './paint';
export {
  srgbU8ToOklab,
  srgbFloatToOklab,
  oklabToSrgbU8,
  lerpOklab,
  mixOklab,
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
  srgbToHsl,
  hslToSrgb,
  interpolateSrgb,
  type ColorInterpolationSpace,
  type HueInterpolation,
  type ColorSpace,
  type OklchDeg,
} from './colorSpaces';
export { contrastLineColor, contrastRatio, wcagLevels } from './contrast';
export { lerpFill, lerpPaint, lerpStroke } from './lerpPaint';
export { parseHexBytes, hexToRgbBytes } from './hex';
export {
  parseColor,
  parseColorToRgba255,
  resolveColor,
  normalizeHex,
  hexToRgba,
  rgbaToHex,
} from './color';
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
