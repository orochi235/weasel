export type {
  AlignAnchor,
  AlignMatchResult,
  DeriveAlignmentGuidesOptions,
  AlignmentBehaviorBase,
  SpacingEdge,
  SpacingMatchResult,
} from './types';
export { deriveAlignmentGuides } from './derive';
export { matchAlignment, MOVE_ANCHORS } from './match';
export { matchSpacing, measureGaps } from './spacing';
export {
  alignMoveBehavior,
  alignInsertBehavior,
  alignResizeBehavior,
  type AlignMoveArgs,
} from './behaviors';
