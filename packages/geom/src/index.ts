/** @weasel-js/geom — pure 2D geometry kernel. Barrel re-exports per tier. */
export { cross, dot, sub, len2, sign, approxEq, EPS } from './scalar';
export { identity, translate, scale, rotate, multiply, invert, applyToPoint, boxToBox, rotateAboutPoint, type Mat3 } from './mat3';
export { boundsOfCoords, unionBox, boxContainsPoint, rectToContour, type Box, type Rect } from './box';
export { PATH_COMMANDS, PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, PATH_CMD_LENGTHS, pathCommandCoordCount, forEachSegment, type PathCommandName, type PathCommandCode } from './commands';
export { cubicEvalAt, elevateQuadraticToCubic, flattenCubic, cubicBounds } from './curve';
export { pointInPolygon, segmentsCross, pointSegmentDist2 } from './polyline';
export { transformCoords } from './affine';
export { placeRect, clampRectWithin, type Placement, type PlacementSide, type PlacementAlign, type PlaceRectOptions, type PlacedRect } from './place';
