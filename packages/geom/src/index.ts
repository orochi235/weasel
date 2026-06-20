/** @weasel-js/geom — pure 2D geometry kernel. Barrel re-exports per tier. */
export const GEOM_PACKAGE = '@weasel-js/geom';

export { cross, dot, sub, len2, sign, approxEq, EPS } from './scalar';
export { identity, translate, scale, rotate, multiply, invert, applyToPoint, boxToBox, rotateAboutPoint, type Mat3 } from './mat3';
export { boundsOfCoords, unionBox, boxContainsPoint, rectToContour, type Box } from './box';
export { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, PATH_CMD_LENGTHS, forEachSegment } from './commands';
