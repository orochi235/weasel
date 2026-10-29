/**
 * `@weasel-js/kernel3d` — poses, an orbit camera, ray picking, and
 * screen-projected chrome over core's scene graph and dispatcher.
 *
 * It hosts a renderer rather than owning one: a consumer brings its own and
 * the kernel hands it poses. Nothing here touches WebGL.
 *
 * @packageDocumentation
 */

export {
  MAX_PITCH, DEFAULT_ORBIT_LIMITS, createCamera, cameraEye, cameraView, cameraViewProjection,
  clampCamera, orbitBy, dollyBy, dollyToward, panBy,
  type Camera3d, type OrbitLimits,
} from './camera';
export { UNIT_CUBE, pose3, poseMatrix, aabbOfPose, type Pose3 } from './pose3';
export { POSE3_COMPOSITION } from './composePose3';
export {
  screenToNdc, ndcToScreen, rayThroughScreenPoint, projectAabbToScreen,
  type ChromeBox, type ScreenBox,
} from './screen';
export {
  screenBoxOf, createNodeAtPoint, createAreaSelect, createSnap,
  createPoseDescriptor, worldPoseOf,
  type NodeBounds, type Node3d, type Scene3d, type Snap3dOptions, type Viewport3d,
  type ViewportSource, type World3d,
} from './deps';
export { createInsert, type Footprint } from './insert';
export { projectPoint } from './project';
export {
  aimOf3d, aimSpace3d, cameraOfAim3d, type Aim3d, type Aim3dOptions, type Frustum3d,
} from './aim';
export {
  alignPlaneSource, boxSnapSource, groundGridSource, type GroundGridSourceOptions,
} from './snap/sources';
export { projectSnapMarks, type ScreenLine, type ScreenPoint } from './snap/marks';
export { collectOverlayBoxes } from './overlays';
export {
  orbitAction, panAction, dollyAction, pinchDollyAction, homeAction, useOrbitTool,
} from './tools';
export type { Camera3dDep } from './cameraDep';
export { kernel3dKitSettingsSchema, type Orbit3dKitSettings } from './kitSettings';
// Reaches the `declare module '@weasel-js/core'` block that adds `camera3d` to
// `DepSchema`. Type-only: the module has no runtime side effect, and a bare
// import would be emitted and then dropped under `sideEffects: false`.
import type {} from './cameraDep';
