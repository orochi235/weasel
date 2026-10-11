/** Part of the `@weasel-js/core` barrel. Fills, strokes, paint kinds, and color. */

// ─── Tile / pattern fills ───────────────────────────────────────────────────
export { createTilePattern } from '../features/patterns';
export type { TilePatternOpts } from '../features/patterns';

// Mesh gradients live on `@weasel-js/core/mesh`, off the root barrel.
export {
  resolvePatternSpec,
  resolveFillPattern,
  isPatternSpec,
} from '../features/patterns/resolveSpec';

// ─── Paint types: FillStyle, Stroke, gradients ──────────────────────────────
export {
  alignedStrokeRect,
  composePatternTransform,
  contrastLineColor,
  dashForStrokeStyle,
  decomposePatternTransform,
  hexToRgbBytes,
  parseHexBytes,
  resolveScreenLength,
  strokeDashStyleOf,
  STROKE_DASH_RATIOS,
} from '@weasel-js/paint';
export { resolveStrokeWidth } from '../features/paths/tessellate/stroke';
export type {
  ColorSpace,
  CommandFill,
  CommandPaintUnits,
  CommandStroke,
  FillStyle,
  PosedFill,
  SolidFill,
  GradStop,
  GradientFill,
  GradientKind,
  GradientUnits,
  TilePatternSpec,
  PatternTransform,
  PatternTransformParts,
  Stroke,
  StrokeAlign,
  StrokeDashStyle,
  Region,
  KitMarkerKey,
  MarkerKey,
  MarkerRef,
  ScreenLength,
} from '@weasel-js/paint';
export {
  isGradientFill,
  sampleGradientStops,
  withGradientKind,
  gradientGeometry,
  gradientForBounds,
} from '../core/gradient';
export { fillInPoseFrame, fillToBoundsFrame } from '../core/fillInPoseFrame';
export type { FillPoseBox } from '../core/fillInPoseFrame';
// A node's paint resolved into what a draw command takes.
export { commandFill, commandStroke } from '../features/patterns/commandPaint';

// ─── Utility: hex8 color helpers ────────────────────────────────────────────
export { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev } from '../util/color';

// ─── Default paint constants (fill/stroke/palette/ghost) ────────────────────

// ─── Paint kinds: the registry that makes FillStyle open ────────────────────
export {
  registerPaintKind,
  registerPaintKindLoader,
  warmPaintKinds,
  isPaintKindKnown,
  asPaint,
  getPaintKind,
  listGradientKinds,
  listPaintKinds,
  paintKindOf,
  switchGradientKind,
  paintKindRegistry,
} from '../core/paintKinds';
export { usePaintKinds, useGradientKinds, usePaintKind } from '../core/usePaintKinds';
export type {
  PaintKind,
  PaintKindEntry,
  PaintKindEditorProps,
  PaintKindLoader,
  PaintBindContext,
  PaintProgram,
  PaintResources,
} from '../core/paintKinds';
export type { ProgramSource } from '../renderer/shaders/registerProgram';
export type { ShaderProgram } from '../renderer/shaders/ShaderProgram';

export {
  registerMarker, getMarker, listMarkers, markerRegistry,
} from '../core/strokeMarkers';
export type { MarkerEntry, MarkerCtx, MarkerPaint } from '../core/strokeMarkers';
export { markerInset, markerKeyOf, resolveMarkerSize, strokeInsets } from '../core/markerInset';
export { markerSites } from '../features/paths/markerSites';
export type { MarkerSite, MarkerSiteRequest } from '../features/paths/markerSites';
export { BUILTIN_MARKERS } from '../core/strokeMarkerShapes';
export { trimPolyline } from '@weasel-js/geom/tessellate';
export type { Polyline } from '@weasel-js/geom/tessellate';

export {
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_COLOR,
  DEFAULT_SHAPE_FILL,
  DEFAULT_PALETTE,
  cycleFill,
  GHOST_STROKE,
  solid,
  strokeOf,
  strokeWith,
  paintAlpha,
  paintWithAlpha,
  paintWithColor,
} from '../util/paint';

// ─── Color helpers (parse / normalize / convert) ────────────────────────────
export {
  parseColor,
  parseColorToRgba255,
  resolveColor,
  normalizeHex,
  hexToRgba,
  rgbaToHex,
} from '../renderer/math/color';
