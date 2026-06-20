export type {
  AlignBounds,
  AlignAnchor,
  AlignMatchResult,
  AlignBoundsProjection,
  DeriveAlignmentGuidesOptions,
  AlignmentBehaviorBase,
} from './types';
export { deriveAlignmentGuides } from './derive';
export { matchAlignment, MOVE_ANCHORS, RECT_ALIGN_PROJECTION } from './match';
export {
  alignMoveBehavior,
  alignInsertBehavior,
  alignResizeBehavior,
  type AlignMoveArgs,
} from './behaviors';
