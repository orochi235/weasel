import { jointAxes, type ClipBinder, type Pose, type Skeleton, type Target } from '@weasel-js/animator';
import type { PoseDescriptor } from '../core/geometry/poseDescriptor';
import { scenePoseTarget, type PoseCascade, type PoseTargetScene } from './poseTarget';

/** Options for `sceneClipTargets`. */
export interface SceneClipTargetsOptions<TPose> {
  /** Rigs by the name a clip calls them: a track naming `rig:<name>` moves that rig's pose. */
  rigs?: Readonly<Record<string, { readonly target: Target<Pose> }>>;
  /** As `scenePoseTarget` takes them. */
  descriptor?: PoseDescriptor<TPose>;
  cascade?: PoseCascade<TPose>;
}

/**
 * A `ClipBinder.target` over a scene. `pose:<node id>` is that node's pose target, the one
 * `scenePoseTarget` answers, and `rig:<name>` is the target of the rig given under that
 * name. Any other name is `undefined`, for a caller to resolve itself first or after.
 */
export function sceneClipTargets<TPose>(
  scene: PoseTargetScene<TPose>,
  options: SceneClipTargetsOptions<TPose> = {},
): NonNullable<ClipBinder['target']> {
  return (name) => {
    if (name.startsWith('pose:')) return scenePoseTarget(scene, name.slice(5), options.descriptor, options.cascade);
    if (name.startsWith('rig:')) return options.rigs?.[name.slice(4)]?.target;
    return undefined;
  };
}

/**
 * A `ClipBinder.axes` beside `sceneClipTargets`, given the same rigs: on a `rig:<name>`
 * target, a track's `axes` are joint names, resolved against that rig's skeleton by
 * `jointAxes`. Any other target is `undefined`.
 */
export function sceneClipAxes(
  rigs: Readonly<Record<string, { readonly skeleton: Skeleton }>>,
): NonNullable<ClipBinder['axes']> {
  return (target, names) => {
    const rig = target.startsWith('rig:') ? rigs[target.slice(4)] : undefined;
    return rig && jointAxes(rig.skeleton, names);
  };
}
