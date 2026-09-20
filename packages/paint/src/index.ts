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
  oklabToSrgbU8,
  lerpOklab,
  oklabToOklch,
  oklchToOklab,
  lerpOklch,
  lerpColorArray,
  type ColorSpace,
} from './colorSpaces';
