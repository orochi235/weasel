export type {
  AlignAnchor,
  AlignMatchResult,
  DeriveAlignmentGuidesOptions,
  AlignmentBehaviorBase,
} from './types';
export { deriveAlignmentGuides } from './derive';
export { matchAlignment, MOVE_ANCHORS } from './match';
export {
  alignMoveBehavior,
  alignInsertBehavior,
  alignResizeBehavior,
  type AlignMoveArgs,
} from './behaviors';
