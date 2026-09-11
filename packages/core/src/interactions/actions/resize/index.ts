export type { UseResizeOptions } from './options';
export { RECT_POSE_DESCRIPTOR, ROTATED_POSE_DESCRIPTOR, type PoseDescriptor } from './geometry';
export {
  cornerResizeHandles,
  hitCornerHandle,
  fixedCornerOf,
  cornerPoint,
  CORNER_ANCHORS,
  type CornerHandle,
  type CornerAnchor,
} from './cornerHandles';
export * from './behaviors';

export { AUTO_POSE_DESCRIPTOR, isPathLike, isRectPose } from './autoPoseDescriptor';
