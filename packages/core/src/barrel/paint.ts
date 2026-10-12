/** Part of the `@weasel-js/core` barrel. Fills, strokes, paint kinds, and color. */

// ─── Tile / pattern fills ───────────────────────────────────────────────────
export { createTilePattern } from 'renderer/patterns';
export type { TilePatternOpts } from 'renderer/patterns';

// Mesh gradients live on `@weasel-js/core/mesh`, off the root barrel.
export {
  resolvePatternSpec,
  resolveFillPattern,
  isPatternSpec,
} from 'renderer/patterns/resolveSpec';

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
export { resolveStrokeWidth } from '@weasel-js/stroke';
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
} from '@weasel-js/paint';
export { fillInPoseFrame, fillToBoundsFrame } from 'renderer/fillInPoseFrame';
export type { FillPoseBox } from 'renderer/fillInPoseFrame';
// A node's paint resolved into what a draw command takes.
export { commandFill, commandStroke } from 'renderer/patterns/commandPaint';

// ─── Utility: hex8 color helpers ────────────────────────────────────────────
export { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev } from '../util/color';

// ─── Default paint constants (fill/stroke/palette/ghost) ────────────────────

// ─── Paint kinds: the registry that makes FillStyle open ────────────────────
export {
  registerPaintKind,
  registerPaintKindLoader,
  getPaintKind,
  listGradientKinds,
  listPaintKinds,
  paintKindOf,
  switchGradientKind,
  paintKindRegistry,
} from 'core/paint/paintKinds';
export { asPaint } from 'core/paint/paintKindEntry';
export { warmPaintKinds, isPaintKindKnown } from 'renderer/paintKinds';
export { usePaintKinds, useGradientKinds, usePaintKind } from '../core/usePaintKinds';
export type { PaintKindLoader } from 'core/paint/paintKinds';
export type { PaintKind, PaintKindEntry, PaintKindEditorProps } from 'core/paint/paintKindEntry';
export type {
  PaintDrawKind,
  PaintBindContext,
  PaintProgram,
  PaintResources,
} from 'renderer/paintKinds';
export type { ProgramSource } from '../renderer/shaders/registerProgram';
export type { ShaderProgram } from '../renderer/shaders/ShaderProgram';

export {
  registerMarker, getMarker, listMarkers, markerRegistry,
} from '@weasel-js/stroke';
export type { MarkerEntry, MarkerCtx, MarkerPaint } from '@weasel-js/stroke';
export { markerInset, markerKeyOf, resolveMarkerSize, strokeInsets } from '@weasel-js/stroke';
export { markerSites } from '@weasel-js/stroke';
export type { MarkerSite, MarkerSiteRequest } from '@weasel-js/stroke';
export { BUILTIN_MARKERS } from '@weasel-js/stroke';
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
} from '@weasel-js/paint';
