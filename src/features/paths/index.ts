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
export { PathBuilder, polygonFromPoints, rectPath } from './builder';
export { boundsOfPath } from './bounds';
export { countPathAnchors } from './anchors';
export { pointInPath, type PointInPathOptions } from './hitTest';
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
export { createPathLayer, type CreatePathLayerOpts } from './pathLayer';
export {
  flattenCubic,
  flattenQuadratic,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
  DEFAULT_FLATTEN_TOLERANCE,
} from './flatten';
export { composePath, decomposePath } from './compose';
export { unionBoundsPath } from './unionBoundsPath';
export { pathPoseDescriptor } from './poseDescriptor';
export { pathOriginProjection } from './originProjection';
export {
  createPenPreviewLayer,
  type CreatePenPreviewLayerOptions,
  type PenPreviewStyle,
} from './penPreviewLayer';
export {
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
} from './booleans';
