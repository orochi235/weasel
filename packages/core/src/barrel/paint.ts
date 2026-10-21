/**
 * Part of the `@weasel-js/core` barrel. Fills, strokes, paint kinds, and color.
 *
 * @packageDocumentation
 */

// ─── Tile / pattern fills ───────────────────────────────────────────────────
export { createTilePattern } from '@weasel-js/renderer';
export type { TilePatternOpts } from '@weasel-js/renderer';

// Mesh gradients live on `@weasel-js/core/mesh`, off the root barrel.
export {
  resolvePatternSpec,
  resolveFillPattern,
} from '@weasel-js/renderer';

// ─── Paint types: Paint, Stroke, gradients ──────────────────────────────
export {
  alignedStrokeRect,
  composePatternTransform,
  contrastLineColor,
  contrastRatio,
  dashForStrokeStyle,
  decomposePatternTransform,
  hexToRgbBytes,
  lerpFill,
  lerpPaint,
  lerpStroke,
  parseHexBytes,
  resolveScreenLength,
  scaleVertexWidth,
  strokeDashStyleOf,
  STROKE_DASH_RATIOS,
  vertexHalfWidths,
  vertexWidthFromSides,
  wcagLevels,
  widestHalfWidth,
} from '@weasel-js/paint';
export { resolveStrokeWidth } from '@weasel-js/stroke';
export type {
  ColorSpace,
  CommandPaint,
  CommandPaintUnits,
  CommandFill,
  CommandStroke,
  Paint,
  PosedPaint,
  SolidPaint,
  GradStop,
  GradientPaint,
  GradientKind,
  PaintUnits,
  PatternPaint,
  PatternPlacement,
  TexturePaint,
  TileKind,
  TilePaint,
  TilePatternSpec,
  PatternTransform,
  PatternTransformParts,
  Fill,
  Stroke,
  StrokeAlign,
  StrokeDashStyle,
  StrokeNib,
  HalfWidths,
  VertexWidth,
  VertexWidthSides,
  Region,
  KitMarkerKey,
  MarkerKey,
  MarkerRef,
  ScreenLength,
} from '@weasel-js/paint';
export {
  TILE_KINDS,
  isPatternPaint,
  isSolidPaint,
  isTileKind,
  isTilePaint,
  patternPlacementOf,
  tileSpecOf,
  isGradientPaint,
  sampleGradientStops,
  withGradientKind,
  gradientGeometry,
  gradientForBounds,
} from '@weasel-js/paint';
export { fillInPoseFrame, fillToBoundsFrame } from '@weasel-js/renderer';
export type { FillPoseBox } from '@weasel-js/renderer';
// A node's paint resolved into what a draw command takes.
export { commandFill, commandPaint, commandStroke } from '@weasel-js/renderer';

// ─── Utility: hex8 color helpers ────────────────────────────────────────────
export { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev } from '../util/color';

// ─── Default paint constants (fill/stroke/palette/ghost) ────────────────────

// ─── Paint kinds: the registry that makes Paint open ────────────────────
export {
  registerPaintKind,
  registerPaintKindLoader,
  getPaintKind,
  listGradientKinds,
  listPaintKinds,
  paintKindOf,
  patternFamily,
  seedTile,
  switchGradientKind,
  paintKindRegistry,
} from 'core/paint/paintKinds';
export { asPaint } from 'core/paint/paintKindEntry';
export { warmPaintKinds, isPaintKindKnown } from '@weasel-js/renderer';
export { usePaintKinds, useGradientKinds, usePaintKind } from '../core/usePaintKinds';
export type { PaintKindLoader } from 'core/paint/paintKinds';
export type { PaintKind, PaintKindEntry, PaintKindEditorProps, PaintKindFamily } from 'core/paint/paintKindEntry';
export type {
  PaintDrawKind,
  PaintBindContext,
  PaintProgram,
  PaintResources,
} from '@weasel-js/renderer';
export type { ProgramSource } from '@weasel-js/renderer';
export type { ShaderProgram } from '@weasel-js/renderer';

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
export { pathPaintOf } from '../canvas/nodeShapes/nodePaint';
export type { PathPaint } from '../canvas/nodeShapes/nodePaint';

// ─── Color helpers (parse / normalize / convert) ────────────────────────────
export {
  parseColor,
  parseColorToRgba255,
  resolveColor,
  normalizeHex,
  hexToRgba,
  rgbaToHex,
} from '@weasel-js/paint';
