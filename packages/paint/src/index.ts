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
} from './paint';
export {
  alignedStrokeRect,
  STROKE_DASH_RATIOS,
  dashForStrokeStyle,
  strokeDashStyleOf,
} from './paint';
