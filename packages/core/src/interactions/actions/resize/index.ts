export type { UseResizeOptions } from './options';
export {
  RECT_POSE_DESCRIPTOR,
  ROTATED_POSE_DESCRIPTOR,
  poseDescriptorForNode,
  type PoseDescriptor,
} from './geometry';
export {
  cornerResizeHandles,
  hitCornerHandle,
  fixedCornerOf,
  cornerPoint,
  handlePoint,
  isCornerHandle,
  CORNER_ANCHORS,
  RESIZE_HANDLE_ANCHORS,
  EDGE_HANDLE_MIN_RADII,
  type CornerHandle,
  type CornerAnchor,
  type HandleEdge,
  type ResizeHandleAnchor,
} from './cornerHandles';
export * from './behaviors';

export { AUTO_POSE_DESCRIPTOR, isPathLike, isRectPose } from 'core/geometry/autoPoseDescriptor';
