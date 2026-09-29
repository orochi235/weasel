/** @weasel-js/geom — pure 2D geometry kernel: scalars, affines, curves, the
 *  `Path` command stream and the math over it, and easing curves. Curve
 *  representations, tessellation and booleans live in subpaths. */
export { cross, dot, sub, len2, sign, approxEq, EPS } from './scalar';
export { identity, translate, scale, rotate, multiply, invert, applyToPoint, boxToBox, rotateAboutPoint, type Mat3 } from './mat3';
export { boundsOfCoords, unionBox, boxContainsPoint, boxContainsBox, rectToContour, type Box, type Rect } from './box';
export { PATH_COMMANDS, PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, PATH_CMD_LENGTHS, pathCommandCoordCount, forEachSegment, type PathCommandName, type PathCommandCode } from './commands';
export {
  cubicEvalAt, quadraticEvalAt, elevateQuadraticToCubic, cubicBounds,
  splitCubicAt, splitQuadraticAt, splitLineAt,
  type LineCoords, type QuadraticCoords, type CubicCoords,
} from './curve';
export { nearestOnLine, nearestOnQuadratic, nearestOnCubic, nearestOnPath, type CurveNearest, type PathNearest } from './nearest';
export { PORT_REACH, portControls, portCurvePoints } from './portCurve2';
export {
  DEFAULT_FLATTEN_TOLERANCE, flattenCubic, flattenQuadratic,
  flattenCubicWithArcLen, flattenQuadraticWithArcLen,
} from './flatten';
export { pointInPolygon, segmentsCross, pointSegmentDist2 } from './polyline';
export type { Path, PolygonPath, RectPath, PathFillRule } from './path';
export {
  PathBuilder, rectPath, polylineFromPoints, polygonFromPoints,
  ellipsePath, regularPolygonPath, starPath, linePath,
} from './paths/builder';
export { boundsOfPath } from './paths/bounds';
export { unionBoundsPath } from './paths/unionBoundsPath';
export { translatePath, scalePathToBounds } from './paths/transform';
export { transformPath } from './paths/transformPath';
export { composePath, decomposePath } from './paths/compose';
export { splitSubpaths } from './paths/splitSubpaths';
export { pathFromD } from './paths/pathFromD';
export { pointAlongPath, type PathStation, type PointAlongPathOptions } from './paths/pathAt';
export { pathDistanceToPoint } from './paths/pathDistance';
export { cubicPointAt, splitCubicAtT, fitCubicThroughDeletion, type Point } from './paths/cubicMath';
export { schneiderFit } from './paths/schneiderFit';
export {
  pointInPath, strokeHitTest,
  pathContainsPoint, pathContainsRect, pathIntersectsRect,
  pathContainsPolygon, pathIntersectsPolygon,
  polygonContainsPath, polygonIntersectsPath,
  type PointInPathOptions, type StrokeHitTestOptions,
} from './pathHitTest';
export { transformCoords } from './affine';
export { placeRect, clampRectWithin, type Placement, type PlacementSide, type PlacementAlign, type PlaceRectOptions, type PlacedRect } from './place';
export {
  linear, easeIn, easeOut, easeInOut,
  easeInQuad, easeOutQuad, easeInOutQuad,
  easeInCubic, easeOutCubic, easeInOutCubic,
  easeInQuart, easeOutQuart, easeInOutQuart,
  easeInQuint, easeOutQuint, easeInOutQuint,
  easeInSine, easeOutSine, easeInOutSine,
  easeInExpo, easeOutExpo, easeInOutExpo,
  easeInCirc, easeOutCirc, easeInOutCirc,
  easeInBack, easeOutBack, easeInOutBack,
  easeInElastic, easeOutElastic, easeInOutElastic,
  easeInBounce, easeOutBounce, easeInOutBounce,
  EASINGS, SPRING_PRESETS,
  type EasingFn, type EasingName, type SpringPreset, type SpringPresetName,
} from './easings';
export { cubicBezierEasing, resolveEasing, type BezierEasing, type EasingSpec } from './easingSpec';
