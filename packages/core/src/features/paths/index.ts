/**
 * Path primitives. Exported through the top-level barrel; this file exists
 * so internal callers can import the whole module under one path.
 *
 * The path data model and the math over it live in `@weasel-js/geom`;
 * re-exported by name (never `export *`, which esbuild cannot enumerate
 * across a package boundary).
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
  unionBoundsPath,
  pathSignedArea,
  reversePath,
} from '@weasel-js/geom';
export {
  splitPathBySegment,
  splitPathByPolyline,
  snipPathByPolyline,
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
export { circlePath, squarePath, rectMarkerPath, roundRectPath } from './markers';
export { countPathAnchors, pathToAnchors, anchorsToPath, isAnchorSmooth, nearestSegmentT, type PenAnchor } from './anchors';
export {
  anchorAt,
  anchorCount,
  anchorsInRect,
  deleteAnchorsAt,
  editAnchorSet,
  flatAnchorIndex,
  insertAnchorOnSegment,
  locateAnchor,
  moveHandleTo,
  openSubpathAt,
  segmentAt,
  translateAnchorBy,
  type AnchorRect,
  type AnchorSet,
  type SegmentHit,
} from './anchorEdits';
export { pathInPoseFrame, pathInWorld, worldEditToStorage, type PathInWorldPose } from './pathInWorld';
export { poseRotationOf, rotatePathAround, type PoseRotation } from 'core/geometry/poseRotation';
export { createPathLayer, type CreatePathLayerOpts } from './pathLayer';
export { pathPoseDescriptor } from './poseDescriptor';
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
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
} from './booleans';
