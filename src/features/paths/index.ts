/**
 * Path primitives. Exported through the top-level barrel; this file exists
 * so internal callers can import the whole module under one path.
 */

export {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  PATH_CMD_LENGTHS,
  type Path,
  type PolygonPath,
  type RectPath,
  type PathFillRule,
} from './types';
export {
  PathBuilder,
  polygonFromPoints,
  rectPath,
  ellipsePath,
  regularPolygonPath,
  starPath,
  linePath,
} from './builder';
export { boundsOfPath } from './bounds';
export { countPathAnchors, pathToAnchors, anchorsToPath, isAnchorSmooth, nearestSegmentT, type PenAnchor } from './anchors';
export { splitCubicAtT, fitCubicThroughDeletion, type Point } from './cubicMath';
export { pointInPath, strokeHitTest, type PointInPathOptions, type StrokeHitTestOptions } from './hitTest';
export {
  pathContainsPoint,
  pathContainsRect,
  pathIntersectsRect,
  pathContainsPolygon,
  pathIntersectsPolygon,
} from './pathHitTest';
export { pathDistanceToPoint } from './pathDistance';
export {
  polygonContainsRectCenter,
  polygonContainsRect,
  polygonIntersectsRect,
} from './polygonHitTestRect';
export {
  translatePath,
  translatePolygonInPlace,
  scalePathToBounds,
} from './transform';
export { pathInPoseFrame, pathInWorld, worldEditToStorage, type PathInWorldPose } from './pathInWorld';
export { poseRotationOf, rotatePathAround, type PoseRotation } from './poseRotation';
export { createPathLayer, type CreatePathLayerOpts } from './pathLayer';
export {
  flattenCubic,
  flattenQuadratic,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
  DEFAULT_FLATTEN_TOLERANCE,
} from './flatten';
export { composePath, decomposePath } from './compose';
export { splitSubpaths } from './splitSubpaths';
export { splitPathByLine, type SplitByLineOptions } from './splitByLine';
export { unionBoundsPath } from './unionBoundsPath';
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
export { transformPath } from './transformPath';
export * from './curves';
