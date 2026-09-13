/**
 * `@weasel-js/kernel3d` — poses, an orbit camera, ray picking and
 * screen-projected chrome over core's scene graph and dispatcher.
 *
 * It hosts a renderer rather than owning one: a consumer brings its own and
 * the kernel hands it poses. Nothing here touches WebGL, and nothing here
 * needs core to change — `Scene` is generic over its pose, the dispatcher
 * keeps passing two numbers, and each dep rebuilds the ray from the camera it
 * closes over.
 *
 * Direction: `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`.
 */

export {
  MAX_PITCH, createCamera, cameraEye, cameraView, cameraViewProjection, orbitBy, dollyBy,
  type Camera3d,
} from './camera';
export { UNIT_CUBE, pose3, poseMatrix, aabbOfPose, type Pose3 } from './pose3';
export {
  screenToNdc, ndcToScreen, rayThroughScreenPoint, projectAabbToScreen,
  type ChromeBox, type ScreenBox, type ViewportRect,
} from './screen';
export {
  screenBoxOf, createNodeAtPoint, createAreaSelect, createSnap, createInsert,
  createPoseDescriptor,
  type Footprint, type NodeBounds, type Node3d, type Scene3d, type Viewport3d,
  type ViewportSource, type World3d,
} from './deps';
export { collectOverlayBoxes } from './overlays';
export { orbitAction, dollyAction, useOrbitTool } from './tools';
export type { Camera3dDep } from './cameraDep';
// Reaches the `declare module '@weasel-js/core'` block that adds `camera3d` to
// `DepSchema`. Type-only: the module has no runtime side effect, and a bare
// import would be emitted and then dropped under `sideEffects: false`.
import type {} from './cameraDep';
