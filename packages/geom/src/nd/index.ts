/** `@weasel-js/geom/nd` — geometry over plain number arrays, in any
 *  dimension, so a tuple `[x, y, z]` passes as it is: the port-curve rule,
 *  flats (points, lines and planes as affine subspaces), and the snap
 *  resolver built on them. The root barrel and `./3d` wrap the port-curve
 *  functions in their own vector types.
 *
 * @packageDocumentation
 */
export { PORT_REACH, cubicAt, portControls, portCurvePoints } from '../portCurve';
export {
  closestBetweenFlats, closestOnFlat, flatDim, intersectFlats,
  type Flat, type Vec,
} from '../snap/flat';
export {
  resolveSnap,
  type ProbeRole, type SnapCandidate, type SnapProblem, type SnapProbe, type SnapResolution, type SnapTier,
} from '../snap/resolve';
export { stepLine } from '../snap/stepLine';
