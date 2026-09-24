/** @weasel-js/paint — the kit's paint vocabulary. Plain data, no renderer. */
export type { TextureHandle } from './texture';
export type {
  FillStyle,
  GradientUnits,
  TilePatternSpec,
  GradStop,
  GradientFill,
  GradientKind,
  StrokeAlign,
  KitMarkerKey,
  MarkerKey,
  MarkerRef,
  Stroke,
  StrokeDashStyle,
  Region,
  ScreenLength,
} from './paint';
export {
  alignedStrokeRect,
  resolveScreenLength,
  STROKE_DASH_RATIOS,
  dashForStrokeStyle,
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
  type ColorSpace,
  type OklchDeg,
} from './colorSpaces';
export { contrastLineColor } from './contrast';
export {
  resolvePaletteColor,
  resolvePaletteColors,
  colorLiteralToHex,
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
