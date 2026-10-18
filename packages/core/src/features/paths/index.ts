/**
 * Path primitives. Exported through the top-level barrel; this file exists
 * so internal callers can import the whole module under one path.
 *
 * The path data model and the math over it live in `@weasel-js/geom`;
 * re-exported by name (never `export *`, which esbuild cannot enumerate
 * across a package boundary).
 *
 * @packageDocumentation
 */

export {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  PATH_CMD_LENGTHS,
  pathCommandCoordCount,
  type Path,
  type PolygonPath,
  type RectPath,
  type PathFillRule,
  PathBuilder,
  polygonFromPoints,
  polylineFromPoints,
  rectPath,
  asPolygonPath,
  ellipsePath,
  regularPolygonPath,
  starPath,
  linePath,
  boundsOfPath,
  splitCubicAtT,
  fitCubicThroughDeletion,
  type Point,
  pointInPath,
  strokeHitTest,
  type PointInPathOptions,
  type StrokeHitTestOptions,
  pathContainsPoint,
  pathContainsRect,
  pathIntersectsRect,
  pathContainsPolygon,
  pathIntersectsPolygon,
  pathDistanceToPoint,
  pointAlongPath,
  type PathStation,
  type PointAlongPathOptions,
  measurePath,
  type MeasurePathOptions,
  type PathMeasure,
  blendPaths,
  prepareBlend,
  type BlendPathsOptions,
  type PathBlend,
  bendAlongPath,
  type BendAlongPathOptions,
  repeatAlongPath,
  stationsAlongPath,
  type RepeatAlongPathOptions,
  type RepeatStation,
  translatePath,
  scalePathToBounds,
  transformPath,
  flattenCubic,
  flattenQuadratic,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
  DEFAULT_FLATTEN_TOLERANCE,
  pathFromD,
  composePath,
  decomposePath,
  splitSubpaths,
  splitByClosure,
  hasOpenSubpath,
  unionBoundsPath,
  pathSignedArea,
  reversePath,
  resolveCorners,
  resolveCornersWithSources,
  remapPerAnchor,
  type ResolvedCorners,
  cornerFrames,
  cornerFrameAt,
  type CornerFrame,
  cornerAt,
  cornerSpecAt,
  hasCorners,
  withCorner,
  withoutCorners,
  type CornerSpec,
  CORNER_KEYWORDS,
  CORNER_FIT_TOLERANCE,
  cornerShapeK,
  cornerKeywordOf,
  cornerShapePieces,
  isCornerShape,
  nextCornerShape,
  type CornerKeyword,
  type CornerPiece,
  type CornerShape,
  type CornerShapeFrame,
} from '@weasel-js/geom';
export {
  splitPathBySegment,
  splitPathByPolyline,
  snipPathByPolyline,
  snipPathsAtCrossings,
  type SnipAtCrossingsOptions,
  type SplitBySegmentOptions,
} from '@weasel-js/geom/booleans';
export {
  bezierCubic,
  bezierQuadratic,
  nurbs,
  spiro,
  CURVE_REPS,
  type SharedAnchor,
  type CurveRepKind,
  type CurveRepresentation,
  type Discriminator,
} from '@weasel-js/geom/curves';
export {
  circlePath, squarePath, rectMarkerPath, roundRectPath,
  countPathAnchors, pathToAnchors, anchorsToPath, isAnchorSmooth, nearestSegmentT, type PenAnchor,
} from '@weasel-js/geom';
export {
  anchorAt,
  anchorCount,
  anchorsInRect,
  anchorsUnderBrush,
  deleteAnchorsAt,
  editAnchorSet,
  editAnchorSetTracked,
  flatAnchorIndex,
  handleAlongItsAngle,
  handleAtItsLength,
  insertAnchorOnSegment,
  locateAnchor,
  makeHandlesSymmetric,
  moveHandleTo,
  openSubpathAt,
  remapPointValues,
  retractHandles,
  segmentAt,
  translateAnchorBy,
  type AnchorRect,
  type AnchorSet,
  type PointOrigin,
  type SegmentHit,
} from '@weasel-js/geom';
export {
  averageAnchorsAt, closestOpenEnds, joinAnchorsAt, joinSubpathEnds, simplifyAnchorsAt, simplifyPath,
  simplifySpan, simplifySubpath, subpathEndAt,
  type AverageAxis, type JoinOptions, type SimplifyPathOptions, type SubpathEnd,
} from '@weasel-js/geom';
export { pathInPoseFrame, pathInWorld, worldEditToStorage, type PathInWorldPose } from '@weasel-js/geom';
export { poseRotationOf, rotatePathAround, type PoseRotation } from '@weasel-js/geom';
export {
  poseFrameOf, poseFrameInverseOf, poseLinearOf, pathThroughPoseFrame, type PoseLinear,
} from '@weasel-js/geom';
export {
  extendToMeet, smudgePath, type SmudgePathOptions, intersectSegments, lengthenOpenEnd, openEndRay, openPathEnds, pathCrossings, pathSegments, trimPathAt,
  type ExtendToMeetOptions, type OpenPathEnd, type PathCrossing, type PathSegment, type PathStop, type SegmentCrossing, type TrimPathOptions, type TrimResult,
} from '@weasel-js/geom';
export {
  createPathSnapIndex, findPathSnap, PATH_SNAP_KINDS,
  type PathSnapHit, type PathSnapIndex, type PathSnapKind, type PathSnapQuery,
} from '@weasel-js/geom';
export {
  createPathSnapper, DEFAULT_PATH_SNAP_RADIUS, type PathSnapMark, type PathSnapOptions, type PathSnapper,
} from './pathSnap/pathSnapper';
export {
  createPathSnapMarkerLayer, pathSnapGlyph, PATH_SNAP_LABELS, type PathSnapMarkerStyle,
} from './pathSnap/pathSnapMarkerLayer';
export { createPathLayer, type CreatePathLayerOpts } from './pathLayer';
export { pathPoseDescriptor } from 'core/geometry/pathPoseDescriptor';
export { pathOriginProjection } from './originProjection';
export {
  createPenPreviewLayer,
  type CreatePenPreviewLayerOptions,
  type PenPreviewStyle,
} from './penPreviewLayer';
export {
  createPathEditingOverlayLayer,
  type CreatePathEditingOverlayLayerOptions,
  type PathEditingOverlayStyle,
} from './pathEditingOverlayLayer';
export {
  GEOMETRY_BOUND_DATA,
  withoutGeometryBoundData,
  type FinishedPathEdit,
  type PathEditDrag,
  type PathEditDragStart,
  type PathEditExtension,
  type PathEditFinishCtx,
  type PathEditHandleMove,
  type PathEditMark,
  type PathEditMarksCtx,
  type PathEditOther,
  type PathEditPart,
  type PathEditStore,
  type PathEditTarget,
} from './pathEditExtension';
export type { AnchorMarkerShape, PathForm, PathRepresentation } from './pathRepresentation';
export {
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
  trianglesToPath,
} from '@weasel-js/geom/booleans';
export { strokeToPath, type StrokeToPathOptions } from '@weasel-js/stroke';
export { offsetPath, type OffsetPathOptions } from '@weasel-js/stroke';
