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
