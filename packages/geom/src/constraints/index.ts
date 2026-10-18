/** Geometric constraints on a path's anchors and the solver that keeps them. */

export {
  constraintAnchors, constraintFits, mapConstraintAnchors,
  type AnchorPair, type PathConstraint, type PathConstraintKind,
} from './types';
export { solveConstraints, type SolveConstraintsOptions, type SolveConstraintsResult } from './solve';
export { CONSTRAINT_TOLERANCE, unsatisfiedConstraints, type UnsatisfiedConstraintsOptions } from './check';
export { constraintApplies, type ConstraintPoint, type HandleRef } from './points';
export {
  anchorsBefore, pathAnchorPoints, remapConstraints, segmentBetween, solvePathConstraints, withAnchorPoints,
  type SolvePathConstraintsResult,
} from './pathConstraints';
export {
  constrainPathEdit, constrainPathsEdit,
  type ConstrainPathEditOptions, type ConstrainedPathEdit, type ConstrainedPathsEdit, type PathLink, type PathsEditItem,
} from './pathsEdit';
export { conflictingConstraints, type ConflictingConstraintsOptions } from './conflicts';
