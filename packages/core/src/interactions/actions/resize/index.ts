export type { UseResizeOptions } from '../../gestures/resizeOptions';
export {
  RECT_POSE_DESCRIPTOR,
  ROTATED_POSE_DESCRIPTOR,
  poseDescriptorForNode,
  type PoseDescriptor,
  type TranslateLead,
} from '../../../core/geometry/poseDescriptor';
export {
  cornerResizeHandles,
  hitCornerHandle,
  fixedCornerOf,
  handlePoint,
  resizeHandlesFor,
  isCornerHandle,
  CORNER_ANCHORS,
  RESIZE_HANDLE_ANCHORS,
  EDGE_HANDLE_MIN_RADII,
  type CornerHandle,
  type CornerAnchor,
  type HandleEdge,
  type ResizeHandleAnchor,
  type ResizeHandleLayout,
} from '../../../core/geometry/resizeHandles';
export * from './behaviors';

export { AUTO_POSE_DESCRIPTOR, isPathLike, isRectPose } from 'core/geometry/autoPoseDescriptor';
