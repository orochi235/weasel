/**
 * `@weasel-js/rig` — the rigging tools for a weasel canvas: the bone tool, which
 * draws and edits the skeleton in a node's `data.skeleton`, and the weight tool,
 * which paints how much each joint weighs the points of the paths under it into
 * their `data.skin`. `useRigTools` builds both for `<SceneCanvas tools>`.
 *
 * @packageDocumentation
 */
export { RIG_TOOLS, type RigToolId } from './toolSets';
export { rigOfSelection, useRigTools, type UseRigToolsOptions } from './useRigTools';
export { useBoneTool, type UseBoneToolOptions } from './bone/useBoneTool';
export { createRigEditState, type RigEditState } from './bone/rigEditState';
export { placedRig, type PlacedRig } from './bone/placedRig';
export { createBoneOverlay, JOINT_RADIUS_PX } from './bone/boneOverlay';
export { useWeightTool, type UseWeightToolOptions } from './weight/useWeightTool';
export { createWeightOverlay, POINT_RADIUS_PX } from './weight/weightOverlay';
export { weighedPaths, type WeighedPath, type WeightEnv } from './weight/weightActions';
export { rigKitSettingsSchema, type RigKitTargetSettings } from './kitSettings';
