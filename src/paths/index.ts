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
export { pointInPath, type PointInPathOptions } from './hitTest';
export {
  translatePath,
  translatePolygonInPlace,
  scalePathToBounds,
} from './transform';
export { traceToContext } from './canvas';
export { createPathLayer, type CreatePathLayerOpts } from './pathLayer';
export {
  flattenCubic,
  flattenQuadratic,
  DEFAULT_FLATTEN_TOLERANCE,
} from './flatten';
export { composePath, decomposePath } from './compose';
export { unionBoundsPath } from './unionBoundsPath';
export { pathPoseGeometry } from './poseGeometry';
