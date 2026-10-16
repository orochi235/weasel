/** Geometric constraints on a path's anchors and the solver that keeps them. */

export {
  constraintAnchors, constraintFits, mapConstraintAnchors,
  type AnchorPair, type PathConstraint, type PathConstraintKind,
} from './types';
export {
  CONSTRAINT_TOLERANCE, solveConstraints, unsatisfiedConstraints,
  type ConstraintPoint, type SolveConstraintsOptions, type SolveConstraintsResult,
  type UnsatisfiedConstraintsOptions,
} from './solve';
export {
  anchorsBefore, constrainPathEdit, pathAnchorPoints, remapConstraints, solvePathConstraints,
  type ConstrainPathEditOptions, type ConstrainedPathEdit, type SolvePathConstraintsResult,
} from './pathConstraints';
